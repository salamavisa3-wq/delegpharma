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
#   - token OVH = zone DNS delegpharma.com (v2, 17/09) → peut SOUMETTRE la bascule NS :
#     POST /domain/delegpharma.com/nameServers/update (tâche 600432804, HTTP 200 le 17/09).
#   - le custom domain Worker app.delegpharma.com exige la zone ACTIVE dans CE compte CF.
#   Le script ne re-déclenche jamais la bascule NS — déjà soumise (rollback = re-POST ns106/dns106).
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
ZONE_NS="$(cfj '
  const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
  const z=(r.result||[])[0]; if (z && z.name_servers) console.log(z.name_servers.join(" "));
')"
if [ -n "$ZONE_INFO" ]; then
  ZONE_ID="${ZONE_INFO%%|*}"; REST="${ZONE_INFO#*|}"; ZONE_STATUS="${REST%%|*}"; ZONE_PLAN="${REST#*|}"
  echo "zone CF : $DOMAIN PRÉSENTE   id=${ZONE_ID:0:8}…   status=$ZONE_STATUS   plan=$ZONE_PLAN"
  [ -n "$ZONE_NS" ] && echo "  NS CF assignés (bascule soumise API OVH 17/09, tâche 600432804) : $ZONE_NS"
  # Probe : le token actuel peut-il poser des records dans cette zone ?
  api GET "/zones/$ZONE_ID/dns_records?per_page=1"
  case "$CF_CODE" in
    200) echo "  token CF : Zone:DNS:Edit OK -> --apply pourra poser records + redirect 301." ;;
    403) echo "  token CF : SANS Zone:DNS:Edit (403) -> pour --apply, élargir le token (Zone:DNS:Edit, scoped $DOMAIN)." ;;
    *)   echo "  token CF : probe dns_records HTTP $CF_CODE" ;;
  esac
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
else echo "NS : encore OVH ($ovh) -> bascule NS déjà soumise API OVH 17/09 (POST nameServers/update, tâche 600432804) ; propagation 24-72 h (TTL NS 24 h)."
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
  [ -n "$ZONE_ID" ] || { echo "X Zone absente (étape dashboard : Add a site delegpharma.com, plan Free) — rien à appliquer."; exit 1; }

  rec_count() { # $1=type $2=name -> imprime combien de records (type,name) existent déjà (lit TMP)
    local TYPE_R="$1" NAME_R="$2"
    TYPE_R="$TYPE_R" NAME_R="$NAME_R" cfj '
      const fs=require("fs");const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
      const T=process.env.TYPE_R,N=process.env.NAME_R;
      const hit=(x)=>x.type===T && (x.name===N || x.name===N+".");
      console.log((r.result||[]).filter(hit).length);
    '
  }
  add_rec() { # $1=type $2=name $3=content $4=priority(opt) — idempotent : ne POST que si absent
    local body="{\"type\":\"$1\",\"name\":\"$2\",\"content\":\"$3\"${4:+,\"priority\":$4}}"
    api GET "/zones/$ZONE_ID/dns_records?type=$1&name=$2"
    if [ "$CF_CODE" = "200" ] && [ "$(rec_count "$1" "$2")" -ge 1 ]; then
      echo "  [ok] DNS $1 $2 -> déjà présent"
    else
      api POST "/zones/$ZONE_ID/dns_records" "$body"
      if [ "$CF_CODE" = "200" ]; then echo "  [OK] DNS $1 $2 -> $3"
      elif [ "$CF_CODE" = "403" ]; then echo "  [X]  DNS $1 $2 -> HTTP 403 (token CF sans Zone:DNS:Edit — relancer après élargissement du token)"
      else echo "  [X]  DNS $1 $2 -> HTTP $CF_CODE ($(cfmsgs))"; fi
    fi
  }

  # Records : posables dès que la zone existe (même pending) — la copie du manifeste
  # OVH AVANT la bascule NS. Le mail (MX) ne doit jamais casser : on pose d'abord les MX.
  echo "Records essentiels (idempotents, zone status=$ZONE_STATUS) :"
  add_rec MX "@" "mx1.mail.ovh.net" 1
  add_rec MX "@" "mx2.mail.ovh.net" 5
  add_rec MX "@" "mx3.mail.ovh.net" 100
  add_rec TXT "@" "v=spf1 include:mx.ovh.com -all"
  add_rec TXT "@" "google-site-verification=1mblS75EDqOJvtI5mmg4BsepwuXoOPmu_TzpQ9G-H1c"
  # NB : PAS de A @/www — l'apex et www sont servis par le worker delegpharma-redirect (301 -> app,
  # custom domain posé plus bas). Les A vitrine OVH ont été volontairement supprimés (état final).

  if [ "$ZONE_STATUS" != "active" ]; then
    echo; echo "Zone status=$ZONE_STATUS -> bascule NS soumise 17/09 (API OVH, tâche 600432804) ;"
    echo "  propagation 24-72 h (TLT NS 24 h) puis la zone CF passera 'active' seule."
    echo "  Puis laisser un watcher relancer --apply (custom domain + redirect 301) automatiquement."
    exit 0
  fi

  echo "Custom domain Worker :"
  api PUT "/accounts/$CF_ACCOUNT/workers/domains" \
    "{\"hostname\":\"$APP_HOST\",\"service\":\"$WORKER\",\"environment\":\"production\"}"
  if [ "$CF_CODE" = "200" ]; then echo "  [OK] $APP_HOST -> worker $WORKER"
  else echo "  [X] custom domain -> HTTP $CF_CODE ($(cfmsgs))"; fi

  echo "Redirect 301 apex + www -> $APP_HOST :"
  # NB (vérifié 17/09) : l'API Redirect Rules (/rulesets) est 403 (token sans droit Rulesets) et les
  # Worker Routes sont "method not allowed" (token sans Zone>Worker Routes:Edit). Chemin PERMIS = binder
  # delegpharma.com + www comme custom domain du worker delegpharma-redirect (même endpoint que app,
  # prouvé 200). Les A @/www (vitrine OVH, proxied) sont supprimés AVANT le bind (conflit 100117).
  REDIR=delegpharma-redirect
  # 1) upload du worker 301 (syntaxe service-worker, idempotent)
  CF_CODE=$(curl -sS -m 60 -o "$TMP" -w '%{http_code}' -X PUT \
    "https://api.cloudflare.com/client/v4/accounts/$CF_ACCOUNT/workers/scripts/$REDIR" \
    -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/javascript" \
    --data-binary @"$HERE/redirect-worker.js")
  if [ "$CF_CODE" = "200" ]; then echo "  [OK] worker $REDIR (301 -> $APP_HOST) déployé"
  else echo "  [X]  upload worker $REDIR -> HTTP $CF_CODE ($(cfmsgs))"; fi
  # 2) custom domain apex + www (idempotent : skip si déjà bindé ; retire la A conflictante sinon)
  for h in "$DOMAIN" "www.$DOMAIN"; do
    api GET "/accounts/$CF_ACCOUNT/workers/domains"
    if H="$h" cfj '
        const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
        console.log((r.result||[]).some(d=>d.hostname===process.env.H));
      ' | grep -q true; then
      echo "  [ok] custom domain $h -> déjà bindé à un worker"
      continue
    fi
    api GET "/zones/$ZONE_ID/dns_records?type=A&name=$h"
    for rid in $(H2="$h" cfj '
        const fs=require("fs"); const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
        for (const d of (r.result||[])) if (d.name===process.env.H2) console.log(d.id);
      '); do
      api DELETE "/zones/$ZONE_ID/dns_records/$rid"
    done
    api PUT "/accounts/$CF_ACCOUNT/workers/domains" "{\"hostname\":\"$h\",\"service\":\"$REDIR\",\"environment\":\"production\"}"
    if [ "$CF_CODE" = "200" ]; then echo "  [OK] custom domain $h -> worker $REDIR"
    else echo "  [X]  custom domain $h -> HTTP $CF_CODE ($(cfmsgs))"; fi
  done

  echo; echo "== Vérification post-apply =="
  bash "$HERE/dns-cutover-verify.sh" || true
  echo; echo "IMPORTANT : bascule NS déjà soumise 17/09 via API OVH (tâche 600432804)."
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
| A | @ | — | | SUPPRIMÉ 17/09 : apex servi par le custom domain worker delegpharma-redirect (301 → app) |
| A | www | — | | SUPPRIMÉ 17/09 : www servi par le custom domain worker delegpharma-redirect (301 → app) |
| CNAME | app | (auto-géré par le custom domain Worker) | | ne PAS créer manuellement |

Le A app -> 164.132.109.175 (VPS mort) n'est PAS reproduit : remplacé par le custom domain Worker.
EOF
echo; echo "Manifeste de records écrit : $MANIFEST"
