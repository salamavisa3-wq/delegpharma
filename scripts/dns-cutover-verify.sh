#!/usr/bin/env bash
# dns-cutover-verify.sh — vérifie l'état de la bascule delegpharma.com → Cloudflare.
# Read-only, zéro secret : n'utilise que des queries DNS publiques + HTTPS.
#
# Usage :
#   ./scripts/dns-cutover-verify.sh          # affiche l'état (échec/ok par test)
#   ./scripts/dns-cutover-verify.sh --check # exit 0 si TOUT est basculé, 1 sinon (CI)
set -euo pipefail

DOMAIN="delegpharma.com"
APP_HOST="app.delegpharma.com"
EXPECTED_PREFIX_NS="ns.cloudflare.com"   # la bascule est « faite » quand NS = *.ns.cloudflare.com
EXPECTED_MX_COUNT=3

ok=0; fail=0
mark() { # $1=état(ok|fail) $2=message
  case "$1" in
    ok)   ok=$((ok+1));   printf '  ✅ %s\n' "$2" ;;
    fail) fail=$((fail+1)); printf '  ❌ %s\n' "$2" ;;
  esac
}

echo "== Bascule DNS $DOMAIN — vérification $(date -u +%Y-%m-%dT%H:%MZ) =="

# 1. Nameservers : plus aucun ns*.ovh.net, tous *.ns.cloudflare.com
mapfile -t NS < <(nslookup -type=NS "$DOMAIN" 2>/dev/null | grep -oE 'nameserver = [^ ]+' | awk '{print $3}' || true)
if [ "${#NS[@]}" -ge 2 ]; then
  printf '  NS actuels : %s\n' "${NS[*]}"
  ovh=0; cf=0
  for ns in "${NS[@]}"; do
    case "$ns" in *ovh.net*) ovh=$((ovh+1)) ;; *ns.cloudflare.com*) cf=$((cf+1)) ;; esac
  done
  if [ "$ovh" -eq 0 ] && [ "$cf" -ge 2 ]; then mark ok "NS basculés vers Cloudflare (${cf} ns.cloudflare.com)"
  else mark fail "NS pas encore basculés (OVH=${ovh}, CF=${cf}) — rollback non engagé, étape util. zone CF + registrar OVH"
  fi
else
  mark fail "Impossible de résoudre les NS de $DOMAIN"
fi

# 2. app.delegpharma.com : healthz 200 (le worker répond)
code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 15 "https://$APP_HOST/healthz" 2>/dev/null || echo 000)"
if [ "$code" = "200" ]; then mark ok "https://$APP_HOST/healthz → 200 (worker branché)"
else mark fail "https://$APP_HOST/healthz → $code (non branché : worker encore sur *.workers.dev, pas de custom domain)"
fi

# 3. Mail : les 3 MX OVH intacts (ne jamais casser le mail)
mapfile -t MX < <(nslookup -type=MX "$DOMAIN" 2>/dev/null | grep -oE 'mail exchanger = [^ ]+' | awk '{print $4}' || true)
if [ "${#MX[@]}" -ge "$EXPECTED_MX_COUNT" ]; then
  # au moins 3 MX, tous sur *.mail.ovh.net
  ovhmx=0
  for m in "${MX[@]}"; do case "$m" in *mail.ovh.net*) ovhmx=$((ovhmx+1)) ;; esac; done
  if [ "$ovhmx" -ge "$EXPECTED_MX_COUNT" ]; then mark ok "Mail préservé (${ovhmx} MX *.mail.ovh.net)"
  else mark fail "MX manquants/altérés (${#MX[@]} trouvés, ${ovhmx} sur mail.ovh.net)"
  fi
else
  mark fail "Aucun MX résolu → MAIL À RISQUE, ne pas poursuivre"
fi

# 4. Apex : redirection 301 vers app (après Redirect Rule CF)
apex="$(curl -sS -o /dev/null -w '%{http_code} %{redirect_url}' --max-time 15 "https://$DOMAIN/" 2>/dev/null || echo 000)"
if printf '%s' "$apex" | grep -q "^301.*app.delegpharma.com"; then mark ok "Apex → 301 vers app ✓"
elif printf '%s' "$apex" | grep -q "^200"; then mark fail "Apex répond 200 (pas encore de Redirect Rule CF)"
else mark fail "Apex : $apex"
fi

echo
echo "== Résultat : ok=$ok  fail=$fail =="
if [ "$fail" -gt 0 ]; then
  exit 1
fi
exit 0
