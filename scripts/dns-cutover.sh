#!/usr/bin/env bash
# dns-cutover.sh — orchestrateur de bascule delegpharma.com → Cloudflare (zéro carte).
#
#   ./scripts/dns-cutover.sh            # PRÉ-VOL (lecture seule) : état + manifeste + blocages
#   ./scripts/dns-cutover.sh --apply    # exécute les étapes CF possibles (zone + records + custom domain + redirect)
#
# Credentials lus depuis ~/secrets-delegpharma.env (jamais affichés) : CF_API_TOKEN, CF_ACCOUNT_ID.
#
# CONTRAINTES VÉRIFIÉES (16/09/2026) :
#   - token CF = Workers:* → NE PEUT PAS créer la zone (POST /zones 403) : la zone delegpharma.com
#     DOIT être ajoutée au dashboard CF (Add a site, plan Free, zéro carte).
#   - token OVH = zone DNS delegpharma.com UNIQUEMENT → NE PEUT PAS changer les NS du registrar :
#     la bascule NS OVH→CF se fait au dashboard OVH (domaines → serveurs DNS).
#   - le custom domain Worker app.delegpharma.com exige la zone ACTIVE dans CE compte CF.
#   Le script ne déclenche jamais la bascule NS — décision utilisateur volontaire (rollback = re-pointer OVH).
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(dirname "$HERE")"
DOMAIN="delegpharma.com"
APP_HOST="app.delegpharma.com"
WORKER="delegpharma"
MANIFEST="$REPO/docs/cutover-records-delegpharma.md"
TMP=/tmp/dns-cutover.json

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
CF_ACCOUNT="${_env[CF_ACCOUNT_ID]-}"
[ -n "$CF_TOKEN" ] || { echo "ERR: CF_API_TOKEN introuvable dans $SRC" >&2; exit 1; }

# --appels ----------------------------------------------------------------------------
api() { # $1=method $2=path [$3=body] -> écrit $TMP, expose CF_CODE
  local body="${3:-}"
  if [ -n "$body" ]; then
    CF_CODE=$(curl -sS -o "$TMP" -w '%{http_code}' -X "$1" \
      "https://api.cloudflare.com/client/v4$2" -H "Authorization: Bearer $CF_TOKEN" \
      -H 'Content-Type: application/json' --data "$body")
  else
    CF_CODE=$(curl -sS -o "$TMP" -w '%{http_code}' -X "$1" \
      "https://api.cloudflare.com/client/v4$2" -H "Authorization: Bearer $CF_TOKEN")
  fi
}

cfj() { # $1=node expression imprimant depuis $TMP
  node -e "$1" "$TMP"
}
cfmsgs() { cfj '
  const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  if (r.errors && r.errors.length) console.log(r.errors.map(e=>e.message).join("; "));
'; }

echo "== Bascule DNS $DOMAIN -> Cloudflare :: $(date -u +%Y-%m-%dT%H:%MZ) =="

# --- 1. Zone présente dans le compte CF ? ---------------------------------------------
api GET "/zones?name=$DOMAIN"
if [ "$CF_CODE" != "200" ]; then echo "X Lecture zones CF echo : HTTP $CF_CODE ($(cfmsgs))"; fi
ZONE_INFO="$(cfj '
  const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  const z=(r.result||[])[0]; if (z) console.log(z.id+"|"+z.status+"|"+z.plan.name);
')"
if [ -n "$ZONE_INFO" ]; then
  ZONE_ID="${ZONE_INFO%%|*}"; REST="${ZONE_INFO#*|}"; ZONE_STATUS="${REST%%|*}"; ZONE_PLAN="${REST#*|}"
  echo "zone CF : $DOMAIN PRÉSENTE   id=${ZONE_ID:0:8}…   status=$ZONE_STATUS   plan=$ZONE_PLAN"
else
  ZONE_ID=""; ZONE_STATUS="absent"
  echo "zone CF : $DOMAIN ABSENTE du compte -> ÉTAPE UTILISATEUR (dashboard CF -> Add a site, plan Free, zéro carte)."
  echo "          (token CF Workers:* sans Zone:Edit -> impossible via API tant que le token n'est pas élargi.)"
fi

# --- 2. NS actuels --------------------------------------------------------------------
mapfile -t NS < <(nslookup -type=NS "$DOMAIN" 2>/dev/null | grep -oE 'nameserver = [^ ]+' | awk '{print $3}' || true)
ovh=0; cfns=0
for n in "${NS[@]}"; do case "$n" in *ovh.net*) ovh=$((ovh+1));; *ns.cloudflare.com*) cfns=$((cfns+1));; esac; done
if [ "$ovh" -eq 0 ] && [ "$cfns" -ge 2 ]; then echo "NS : deja basculés Cloudflare ($cfns) — bascule faite ?"
else echo "NS : encore OVH ($ovh) -> bascule NS = ÉTAPE UTILISATEUR (dashboard OVH -> serveurs DNS). Token OVH sans droit registrar."
fi

# --- 3. Mail -------------------------------------------------------------------------
mapfile -t MX < <(nslookup -type=MX "$DOMAIN" 2>/dev/null | grep -oE 'mail exchanger = [^ ]+' | awk '{print $4}' || true)
if [ "${#MX[@]}" -ge 3 ]; then echo "Mail : ${#MX[@]} MX résolus (${MX[*]}…)"
else echo "Mail : ATTENTION ${#MX[@]} MX seulement"; fi

# --- 4. Worker + app ------------------------------------------------------------------
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://$WORKER.momosall2010.workers.dev/healthz" 2>/dev/null || echo 000)"
echo "Worker filet : $WORKER.momosall2010.workers.dev/healthz -> $code (200 attendu)"
codeapp="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 10 "https://$APP_HOST/healthz" 2>/dev/null || echo 000)"
echo "App : $APP_HOST/healthz -> $codeapp (200 une fois le custom domain branché)"

if [ "${1:-}" = "--apply" ]; then
  echo; echo "== APPLY =="
  [ -n "$ZONE_ID" ] || { echo "X Zone absente (étape dashboard) — rien à appliquer."; exit 1; }
  [ "$ZONE_STATUS" = "active" ] || { echo "X Zone présente mais status=$ZONE_STATUS (en attente de bascule NS) — attendre 'active'."; exit 1; }

  add_rec() { # $1=type $2=name $3=content $4=priority(opt)
    local body="{\"type\":\"$1\",\"name\":\"$2\",\"content\":\"$3\"${4:+,\"priority\":$4}}"
    api POST "/zones/$ZONE_ID/dns_records" "$body"
    if [ "$CF_CODE" = "200" ]; then echo "  [OK] DNS $1 $2 -> $3"
    else echo "  [X]  DNS $1 $2 -> HTTP $CF_CODE ($(cfmsgs))"; fi
  }
  echo "Records essentiels (idempotents à volonté) :"
  add_rec MX "@" "mx1.mail.ovh.net" 1
  add_rec MX "@" "mx2.mail.ovh.net" 5
  add_rec MX "@" "mx3.mail.ovh.net" 100
  add_rec TXT "@" "v=spf1 include:mx.ovh.com -all"
  add_rec A "@" "146.59.209.152"
  add_rec A "www" "146.59.209.152"

  echo "Custom domain Worker :"
  api PUT "/accounts/$CF_ACCOUNT/workers/domains" \
    "{\"hostname\":\"$APP_HOST\",\"service\":\"$WORKER\",\"environment\":\"production\"}"
  if [ "$CF_CODE" = "200" ]; then echo "  [OK] $APP_HOST -> worker $WORKER"
  else echo "  [X] custom domain -> HTTP $CF_CODE ($(cfmsgs))"; fi

  echo "Redirect 301 apex + www -> $APP_HOST :"
  api POST "/zones/$ZONE_ID/rulesets" \
    '{"phase":"http_request_dynamic_redirect","rules":[{"expression":"(http.host eq \"delegpharma.com\" or http.host eq \"www.delegpharma.com\")","description":"delegpharma apex/www -> app","action":"redirect","action_parameters":{"from_value":{"status_code":301,"target_url":{"expression":"concat(\"https://app.delegpharma.com\", http.request.uri.path)"}}}}]}'
  if [ "$CF_CODE" = "200" ]; then echo "  [OK] Redirect 301 apex/www"
  else echo "  [X]  Redirect -> HTTP $CF_CODE ($(cfmsgs))"; fi

  echo; echo "== Vérification post-apply =="
  bash "$HERE/dns-cutover-verify.sh" || true
  echo; echo "IMPORTANT : la bascule NS OVH->CF reste MANUELLE (dashboard OVH)."
  echo "Après propagation (24-72 h), relancer dns-cutover-verify.sh : 4/4 ok attendus."
fi

# --- Manifeste des records à reproduire dans CF ---------------------------------------
cat > "$MANIFEST" <<EOF
# Records à reproduire dans la zone Cloudflare delegpharma.com (générés $(date -u +%Y-%m-%dT%H:%MZ), source zone OVH autoritative)

| Type | Nom | Contenu | Priorité | Note |
|---|---|---|---|---|
| MX | @ | mx1.mail.ovh.net | 1 | MAIL — ne jamais casser |
| MX | @ | mx2.mail.ovh.net | 5 | MAIL |
| MX | @ | mx3.mail.ovh.net | 100 | MAIL |
| TXT | @ | v=spf1 include:mx.ovh.com -all | | SPF |
| TXT | @ | google-site-verification=1mblS75EDqOJvtI5mmg4BsepwuXoOPmu_TzpQ9G-H1c | | GSC |
| TXT | @ | 1|www.delegpharma.com | | jeton hosting OVH (peut être omis si la vitrine est arrêtée) |
| A | @ | 146.59.209.152 | | vitrine OVH (conservée jusqu'à validation de la bascule, puis couverte par la Redirect Rule) |
| A | www | 146.59.209.152 | | vitrine OVH |
| CNAME | app | (auto-géré par le custom domain Worker) | | ne PAS créer manuellement |

Le A app -> 164.132.109.175 (VPS mort) n'est PAS reproduit : remplacé par le custom domain Worker.
EOF
echo; echo "Manifeste de records écrit : $MANIFEST"
