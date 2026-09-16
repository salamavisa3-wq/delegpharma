# DNS — delegpharma.com (bascule vers Cloudflare Workers, cible zéro-carte)

ÉTAT AU 16/09/2026 — remplace l'ancien `DNS.md` (v1, périmé : pointait `app` vers le VPS
OVH `164.132.109.175` et `www` vers la vitrine systeme.io/CloudFront).

## Objectif

| Hôte | Cible actuelle (AVANT) | Cible (APRÈS bascule) |
|---|---|---|
| `app.delegpharma.com` | A → `164.132.109.175` (VPS **RÉSILIÉ** — mort) | Worker `delegpharma` (custom domain) |
| `delegpharma.com` (apex) | A → `146.59.209.152` (vitrine OVH) | Zone CF full → 301/Redirect Rule vers `app` |
| `www.delegpharma.com` | A → `146.59.209.152` | Redirect Rule CF vers `app` |
| `app.delegpharma.com` MX | `mx1/2/3.mail.ovh.net` | **à reproduire dans la zone CF avant bascule NS** |

## État vérifié (16/09, autoritaire `ns106.ovh.net`)

- NS : `dns106.ovh.net` / `ns106.ovh.net` (registrar OVH — à remplacer par les 2 NS CF).
- `app.delegpharma.com` A → `164.132.109.175` → **ne répond plus** (VPS résilié 16/09).
- `delegpharma.com` A → `146.59.209.152` (mutualisée OVH, vitrine marketing).
- MX OVH intacts (mail `*@delegpharma.com` géré par OVH — **ne pas casser**).
- Compte CF `Momosall2010` : zone `sakeurimmo.com` active (full, NS `adi.ns.cloudflare.com` +
  `gerardo.ns.cloudflare.com`). `delegpharma.com` **ABSENTE** du compte.

## Principe — pourquoi c'est à moitié manuel, et ce qui est fait

La création de zone CF (`Zone:Edit`) et le changement de NS chez le registrar OVH sont des
actions utilisateur (dashboard) : le token CF actuel n'a qu'un scope `Workers:*` (probe create
zone → `403`). Le reste est vérifiable/mesurable par script après la bascule
(`scripts/dns-cutover-verify.sh`). Aucune bascule de NS n'est déclenchée par un script — c'est
une décision volontaire et réversible (re-pointer NS OVH pour rollback).

## Procédure (ordre strict — le mail ne doit JAMAIS tomber)

### 1. Préparer la zone CF (action utilisateur, dashboard) — ~10 min
1. Cloudflare dashboard → **Add a site** → `delegpharma.com` (plan Free, zéro carte).
2. CF propose 2 nameservers : `XXX.ns.cloudflare.com` + `YYY.ns.cloudflare.com`.
3. **AVANT de toucher aux NS** : dans la zone neuve CF, créer les **mêmes records** que la zone
   OVH, au minimum :
   - **MX** `@` → `mx1.mail.ovh.net` (1) / `mx2` (5) / `mx3` (100) — MAIL, non négociable.
   - TXT SPF/DKIM éventuels (à copier depuis la zone OVH : OVHcloud → domaines →
     delegpharma.com → Zone DNS).
   - `www` → vitrine actuelle (`146.59.209.152`) si elle doit rester en l'état.
4. Ne PAS encore changer de NS.

### 2. Bascule DNS (action utilisateur, registrar OVH)
- OVHcloud → domaines → delegpharma.com → **serveurs DNS** → remplacer
  `ns106.ovh.net` / `dns106.ovh.net` par les 2 NS CF. Validé en ~24-72 h max (TTL 24 h NS).

### 3. Brancher le custom domain Worker (API CF — scriptable)
Une fois la zone `delegpharma.com` active dans le compte (étape 1), le custom domain se
branche comme sakeurimmo.com l'est déjà (Workers → Settings → Domains & Routes → Add Custom
Domain `app.delegpharma.com`, ou API `PUT /accounts/:id/workers/domains`).

### 4. Redirect apex/www → app (Redirect Rule CF)
Zone CF → Rules → Redirect Rules : `delegpharma.com` et `www.delegpharma.com` → 301
`https://app.delegpharma.com` (comme l'ancien 301 de la vitrine OVH).

## Vérifications (scriptables après bascule)

```bash
# Propagation / records
dig +short delegpharma.com NS            # → 2 NS *.ns.cloudflare.com
dig +short app.delegpharma.com           # → (résolu par CF) ; https://app.delegpharma.com/healthz → 200
dig +short delegpharma.com MX
curl -sS -o /dev/null -w '%{http_code}\n' https://app.delegpharma.com/healthz
curl -sS -o /dev/null -w '%{http_code}\n' -L https://delegpharma.com/healthz   # → 200 après redirect

# Auto : scripts/dns-cutover-verify.sh delegates all checks
```

## Rollback

Re-pointer les NS OVH (`ns106`/`dns106`) chez le registrar tant que la zone CF n'est pas
supprimée. Le worker reste joignable sur `delegpharma.momosall2010.workers.dev` quoi qu'il
arrive (filet).

## Règles

- **Zéro carte** : plan CF Free pour la zone, comme sakeurimmo.com.
- **Le mail ne tombe jamais** : MX reproduits dans CF AVANT la bascule NS (étape 1.3).
- Aucun secret dans ce runbook ; aucune action NS sans confirmation explicite.
