#!/usr/bin/env bash
# set-dp-secrets.sh — pose les secrets runtime DelegPharma sur GitHub Actions ET le
# Worker Cloudflare, pour le CUTOVER après perte du .env OVH.
#
# Usage (une seule valeur lue à la fois, jamais affichée) :
#   ./scripts/set-dp-secrets.sh                          # source : ~/secrets-delegpharma.env
#   ./scripts/set-dp-secrets.sh /chemin/vers/env.ext      # source explicite
#   ./scripts/set-dp-secrets.sh --check                   # vérifie ce qui est POSÉ + si placeholder
#
# Règles de sécurité :
#   - Aucune valeur n'est affichée : seul le NOM + sha16 de la valeur.
#   - Refuse (exit 1) toute valeur contenant '<', '>', ou un mot placeholder
#     (CHANGEME / VOTRE_ / VOTRE / your- / XXXX / REPLACE / TEMPLATE / EXAMPLE).
#   - Idempotent : re-poser une même valeur est sans danger (écrasement identique).
#   - Ne touche pas PAY_MODE : il reste 'demo' dans wrangler.toml (bootstrap sûr)
#     tant que les clés réelles ne sont pas fournies. La bascule live se fait en
#     changeant PAY_MODE → 'cinetpay'/'paypal' UNIQUEMENT une fois les clés posées
#     et validées (webhook HMAC testé), jamais avant.
#
# Secrets gérés (clé du fichier env → pose GitHub + Worker Cloudflare) :
#   CINETPAY_APIKEY, CINETPAY_SITE_ID, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET,
#   OLLAMA_API_KEY, JWT_SECRET, NEON_DATABASE_URL.
#   (CF_ACCOUNT_ID / CF_API_TOKEN servent à Wrangler/GitHub mais NE sont PAS ici :
#    ils sont déjà posés et restent hors de ce flux de run.)
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEFAULT_SRC="$HOME/secrets-delegpharma.env"
WORKER="delegpharma"

# --placeholder detection ------------------------------------------------------
is_placeholder() {
  local v="$1"
  local upper
  upper="$(printf '%s' "$v" | tr 'a-z' 'A-Z')"
  case "$v" in
    *"<"*|*">"*) return 0 ;;
  esac
  case "$upper" in
    *CHANGEME*|*VOTRE*|*"YOUR-"*|*YOURKEY*|*XXXX*|*REPLACE*|*TEMPLATE*|*EXAMPLE*|*PLACEHOLDER*) return 0 ;;
  esac
  return 1
}

# --sha16 : première empreinte (jamais la valeur) ------------------------------
sha16() { printf '%s' "$1" | sha256sum | cut -c1-16; }

fail() { printf 'ERR: %s\n' "$*" >&2; exit 1; }

# --deps -----------------------------------------------------------------------
command -v gh >/dev/null 2>&1 || fail "gh introuvable (GitHub CLI)"
command -v wrangler >/dev/null 2>&1 || command -v npx >/dev/null 2>&1 || fail "wrangler/npx introuvable"
gh auth status 2>&1 | grep -q "Logged in to github.com" || fail "gh non authentifié (gh auth login)"

# --args -----------------------------------------------------------------------
CHECK=0
SRC="$DEFAULT_SRC"
if [ "${1:-}" = "--check" ]; then CHECK=1; shift; fi
if [ -n "${1:-}" ]; then SRC="$1"; fi
[ -f "$SRC" ] || fail "Fichier env introuvable : $SRC"

# --load : parseur ligne-à-ligne (JAMAIS d'évaluation du contenu, contrairement à
# `set -a; . file` qui casserait sur le `&` de la chaîne Neon et fausserait le check).
# Gère CRLF, commentaires `#`, valeurs avec/sans guillemets. Valeurs jamais affichées.
declare -A _env=()
while IFS= read -r _line_raw; do
  _line="${_line_raw%$'\r'}"
  case "$_line" in ''|\#*) continue ;; esac
  _key="${_line%%=*}" _val="${_line#*=}"
  case "$_val" in
    \"*\") _val="${_val%\"}"; _val="${_val#\"}" ;;   # "valeur"
    \'*\') _val="${_val%\'}"; _val="${_val#\'}" ;;   # 'valeur'
    \"*|\'*) : ;;                                     # guillemet orphelin → gardé tel quel
  esac
  _env["$_key"]="$_val"
done < "$SRC"

SECRETS=(CINETPAY_APIKEY CINETPAY_SITE_ID PAYPAL_CLIENT_ID PAYPAL_CLIENT_SECRET \
         OLLAMA_API_KEY JWT_SECRET NEON_DATABASE_URL)

# accès aux valeurs (jamais affichées)
envval() { printf '%s' "${_env[$1]-}"; }

if [ "$CHECK" -eq 1 ]; then
  printf '== État des secrets (%s) — empreintes uniquement ==\n' "$WORKER"
  for k in "${SECRETS[@]}"; do
    val="$(envval "$k")"
    if [ -z "$val" ]; then
      printf '  %-24s ABSENT du fichier env\n' "$k"
    elif is_placeholder "$val"; then
      printf '  %-24s PLACEHOLDER (à remplacer) sha16=%s\n' "$k" "$(sha16 "$val")"
    else
      printf '  %-24s OK  sha16=%s len=%d\n' "$k" "$(sha16 "$val")" "${#val}"
    fi
  done
  exit 0
fi

# --pose ------------------------------------------------------------------------
posesecret() {
  local name="$1" val="$2"
  [ -n "$val" ] || { printf 'SKIP %-22s (vide dans env — non posé)\n' "$name"; return 0; }
  is_placeholder "$val" && fail "$name : valeur placeholder '<'/'>'/CHANGEME… refusée — collez la VRAIE clé"
  # GitHub (Actions) :
  gh secret set "$name" --body "$val" >/dev/null
  # Worker (wrangler secret put lit stdin, jamais d'argument) :
  if command -v wrangler >/dev/null 2>&1; then printf '%s' "$val" | wrangler secret put "$name" --name "$WORKER" >/dev/null
  else printf '%s' "$val" | npx wrangler secret put "$name" --name "$WORKER" >/dev/null; fi
  printf 'OK   %-22s posé GitHub+Worker  sha16=%s len=%d\n' "$name" "$(sha16 "$val")" "${#val}"
}

printf '== Pose secrets DelegPharma ==\n'
posesecret CINETPAY_APIKEY       "$(envval CINETPAY_APIKEY)"
posesecret CINETPAY_SITE_ID      "$(envval CINETPAY_SITE_ID)"
posesecret PAYPAL_CLIENT_ID      "$(envval PAYPAL_CLIENT_ID)"
posesecret PAYPAL_CLIENT_SECRET  "$(envval PAYPAL_CLIENT_SECRET)"
posesecret OLLAMA_API_KEY        "$(envval OLLAMA_API_KEY)"
posesecret JWT_SECRET            "$(envval JWT_SECRET)"
posesecret NEON_DATABASE_URL     "$(envval NEON_DATABASE_URL)"
printf '== Terminé. PAY_MODE reste "demo" jusqu’à validation des clés. ==\n'
