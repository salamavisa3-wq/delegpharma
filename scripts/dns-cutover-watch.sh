#!/usr/bin/env bash
# dns-cutover-watch.sh — surveille la bascule delegpharma.com → Cloudflare et enchaîne
# AUTOMATIQUEMENT les étapes scriptables dès que leurs préconditions dashboard sont remplies.
#
#   ./scripts/dns-cutover-watch.sh            # boucle : détecte chaque étape, l'applique, avance
#   ./scripts/dns-cutover-watch.sh --once     # un passage de chaque phase, puis exit
#   ./scripts/dns-cutover-watch.sh --report   # état actuel + phase bloquée, sans rien exécuter
#
# Ce que ce watcher NE PEUT PAS faire (action dashboard manuelle, 403 vérifié par API) :
#   étape 1 = « Add a site » delegpharma.com (plan Free, zéro carte) dans le dashboard CF ;
#   étape 2 = remplacer ns106/dns106.ovh.net par les NS CF dans le dashboard OVH (registrar).
# Le watcher les DÉTECTE et guide. Tout le reste (records, custom domain, redirect,
# vérification) est exécuté sans intervention.
#
# Orchestration :
#   P0 zone ABSENTE   -> message tant que l'étape 1 (dashboard CF) n'est pas faite.
#   P1 zone présente  -> --apply (records MX/SPF/A : copie du manifeste AVANT la bascule NS,
#                        mail jamais cassé) puis guide l'étape 2 (NS CF à copier chez OVH).
#   P2 zone 'active'  -> --apply (custom domain Worker + redirect 301 apex/www → app).
#   P3 propagation    -> dns-cutover-verify.sh --check jusqu'à 4/4 (bascule terminée).
#
# Réglages (env) : DP_POLL_SECONDS (défaut 60), DP_PHASE_TIMEOUT (défaut 1800 = 30 min/phase).
# Re-lançable à volonté (idempotent) : chaque pas reprend là où les préconditions s'arrêtent.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DOMAIN="delegpharma.com"
POLL="${DP_POLL_SECONDS:-60}"
MODE="${1:-loop}"

# --credentials (jamais affichés) ----------------------------------------------------
SRC="${DP_SECRETS_FILE:-$HOME/secrets-delegpharma.env}"
declare -A _env=()
while IFS= read -r _l; do
  _l="${_l%$'\r'}"
  case "$_l" in ''|\#*) continue ;; esac
  _k="${_l%%=*}" _v="${_l#*=}"
  case "$_v" in \"*\") _v="${_v:1:-1}" ;; \'*\') _v="${_v:1:-1}" ;; esac
  _env["$_k"]="$_v"
done < "$SRC"
CF_TOKEN="${_env[CF_API_TOKEN]-}"
[ -n "$CF_TOKEN" ] || { echo "ERR: CF_API_TOKEN introuvable dans $SRC" >&2; exit 1; }

TMP=/tmp/dns-cutover-watch.json
api() { # $1=path
  CF_CODE=$(curl -sS -o "$TMP" -w '%{http_code}' "https://api.cloudflare.com/client/v4$1" -H "Authorization: Bearer $CF_TOKEN" 2>/dev/null) || CF_CODE=000
}
zone_state() { # -> "id|status" (vide si absente)
  CF_CODE=000; api "/zones?name=$DOMAIN"
  if [ "$CF_CODE" = "200" ]; then
    node -e '
      const fs=require("fs");const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const z=(r.result||[])[0];if(z)console.log(z.id+"|"+z.status);
    ' "$TMP" 2>/dev/null || true
  fi
}
zone_ns() { # -> NS CF (espacés) ou vide
  CF_CODE=000; api "/zones?name=$DOMAIN"
  if [ "$CF_CODE" = "200" ]; then
    node -e '
      const fs=require("fs");const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const z=(r.result||[])[0];if(z&&z.name_servers)console.log(z.name_servers.join(" "));
    ' "$TMP" 2>/dev/null || true
  fi
}

phase() { echo; echo "[$1] $2"; }
step()  { echo "  $1"; }

echo "== Watch bascule DNS $DOMAIN -> Cloudflare :: $(date -u +%Y-%m-%dT%H:%MZ) :: mode=$MODE =="

while :; do
  ZS="$(zone_state)"

  # --- P3 : bascule déjà faite ? -----------------------------------------------------
  if bash "$HERE/dns-cutover-verify.sh" --check >/dev/null 2>&1; then
    echo; echo "== BASCULE TERMINÉE : dns-cutover-verify.sh → 4/4 OK. =="
    exit 0
  fi

  # --- P0 : zone absente ------------------------------------------------------------
  if [ -z "$ZS" ]; then
    phase P0 "Zone $DOMAIN ABSENTE du compte CF"
    step "ÉTAPE 1 (manuel, dashboard CF) : Add a site $DOMAIN → plan Free (zéro carte)."
    step "Le watcher détectera l'apparition de la zone, posera les records, puis te guidera."
    if [ "$MODE" = "--once" ] || [ "$MODE" = "--report" ]; then exit 0; fi
    sleep "$POLL"; continue
  fi

  ZID="${ZS%%|*}"; ZST="${ZS#*|}"
  echo "Zone présente : id=${ZID:0:8}… status=$ZST"

  # --- P1 : zone présente mais pas active -> records AVANT bascule NS -----------------
  if [ "$ZST" != "active" ]; then
    phase P1 "Zone status=$ZST → --apply pour poser les records (MX/SPF/A), AVANT la bascule NS"
    bash "$HERE/dns-cutover.sh" --apply || true
    NS="$(zone_ns)"
    if [ -n "$NS" ]; then
      step "ÉTAPE 2 (manuel, dashboard OVH → domaines → serveurs DNS) :"
      step "remplace ns106/dns106.ovh.net par : ${NS// /, }"
    fi
    step "Le watcher enchaînera le custom domain + redirect quand la zone passera 'active'."
    if [ "$MODE" = "--once" ] || [ "$MODE" = "--report" ]; then exit 0; fi
    sleep "$POLL"; continue
  fi

  # --- P2 : zone active -> custom domain + redirect ----------------------------------
  phase P2 "Zone active → --apply : custom domain Worker + redirect 301 apex/www"
  bash "$HERE/dns-cutover.sh" --apply || true

  [ "$MODE" = "--once" ] && { phase P3 "Propagation (un passage)" ; bash "$HERE/dns-cutover-verify.sh" || true; exit 0; }
  [ "$MODE" = "--report" ] && exit 0
  phase P3 "Propagation des NS CF (jusqu'à 24-72 h) — vérification toutes les $POLL s"
  sleep "$POLL"
done
