#!/usr/bin/env bash
# ovh-dns.sh — ajoute le record A `app.delegpharma.com → <IP>` via l'API OVHcloud.
#
# Prérequis : clés API créées sur https://api.ovh.com/createToken/ avec la portée :
#   GET/POST /domain/zone/delegpharma.com/record/*
#   POST /domain/zone/delegpharma.com/refresh
#
# Creds : variables d'env, ou fichier .env à côté du script (jamais dans git/chat) :
#   OVH_APP_KEY=...   OVH_APP_SECRET=...   OVH_CONSUMER_KEY=...
#
# Usage :
#   ./scripts/ovh-dns.sh             # affiche les records A actuels du sous-domaine
#   ./scripts/ovh-dns.sh 164.132.109.175   # crée le record A `app` → IP, refresh, vérifie
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "$HERE/.env" ]; then set -a; . "$HERE/.env"; set +a; fi

OVH_ENDPOINT="${OVH_ENDPOINT:-https://eu.api.ovh.com/1.0}"
OVH_ZONE="${OVH_ZONE:-delegpharma.com}"
SUB="${OVH_SUB:-app}"
TTL="${OVH_TTL:-300}"

: "${OVH_APP_KEY:?OVH_APP_KEY manquant}"
: "${OVH_APP_SECRET:?OVH_APP_SECRET manquant}"
: "${OVH_CONSUMER_KEY:?OVH_CONSUMER_KEY manquant}"

TS="$(date +%s)"

# Signature OVHcloud : '$1$' + sha1hex(secret + consumer + timestamp + méthode + url + corps)
sig() {
  local meth="$1" url="$2" body="${3:-}"
  local s="$OVH_APP_SECRET+$OVH_CONSUMER_KEY+$TS+$meth+$url+$body"
  printf '1$1$%s' "$(printf '%s' "$s" | sha1sum | cut -d' ' -f1)"
}

API() {
  local meth="$1" path="$2" body="${3:-}"
  local url="$OVH_ENDPOINT$path"
  local sigv; sigv="$(sig "$meth" "$url" "$body")"
  curl -sS -X "$meth" "$url" \
    -H "X-Ovh-Application: $OVH_APP_KEY" \
    -H "X-Ovh-Consumer: $OVH_CONSUMER_KEY" \
    -H "X-Ovh-Timestamp: $TS" \
    -H "X-Ovh-Signature: $sigv" \
    -H "Content-Type: application/json" \
    ${body:+-d "$body"}
}

if [ $# -eq 0 ]; then
  echo "Records A actuels pour $SUB.$OVH_ZONE :"
  API GET "/domain/zone/$OVH_ZONE/record?subDomain=$SUB&fieldType=A"
  echo; exit 0
fi

IP="$1"
if ! printf '%s' "$IP" | grep -Eq '^[0-9]{1,3}(\.[0-9]{1,3}){3}$'; then
  echo "IP invalide : $IP" >&2; exit 1
fi

BODY="{\"fieldType\":\"A\",\"subDomain\":\"$SUB\",\"target\":\"$IP\",\"ttl\":$TTL}"
echo "Création record A : $SUB.$OVH_ZONE → $IP ..."
API POST "/domain/zone/$OVH_ZONE/record" "$BODY"; echo
echo "Refresh de la zone ..."
API POST "/domain/zone/$OVH_ZONE/refresh"; echo
echo "Vérification :"
API GET "/domain/zone/$OVH_ZONE/record?subDomain=$SUB&fieldType=A"; echo
echo
echo "Résolution publique (propagation ~TTL) : dig $SUB.$OVH_ZONE A +short"
