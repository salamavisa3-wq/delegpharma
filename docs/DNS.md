# DNS — delegpharma.com (bascule vers Cloudflare Workers, cible zéro-carte)

ÉTAT AU 17/09 — **BASCULE TERMINÉE (verify 4/4)** : NS publics = `adi.ns.cloudflare.com` +
`gerardo.ns.cloudflare.com`, custom domain `app.delegpharma.com` → worker delegpharma (healthz 200),
apex + www → **301 → app** via le worker `delegpharma-redirect` (custom domain), 3 MX mail.ovh.net
préservés. La bascule NS a été soumise le 17/09 via API OVH (tâche `600432804`, HTTP 200) et la
propagation a convergé **le jour même**. remplace l'ancien `DNS.md` (v1, périmé : pointait `app` vers le VPS
OVH `164.132.109.175` et `www` vers la vitrine systeme.io/CloudFront).

## Objectif

| Hôte | Cible actuelle (AVANT) | Cible (APRÈS bascule) |
|---|---|---|
| `app.delegpharma.com` | A → `164.132.109.175` (VPS **RÉSILIÉ** — mort) | Worker `delegpharma` (custom domain) |
| `delegpharma.com` (apex) | A → `146.59.209.152` (vitrine OVH) | Zone CF full → 301/Redirect Rule vers `app` |
| `www.delegpharma.com` | A → `146.59.209.152` | Redirect Rule CF vers `app` |
| `app.delegpharma.com` MX | `mx1/2/3.mail.ovh.net` | **à reproduire dans la zone CF avant bascule NS** |

## État vérifié (17/09, fin de journée — cutover 4/4)

- **NS publics : `adi.ns.cloudflare.com` + `gerardo.ns.cloudflare.com`** (bascule API OVH
  `POST /nameServers/update`, tâche `600432804` ; propagation convergée le jour même).
- **Zone CF `delegpharma.com` ACTIVE** (id `f4feae61…`, plan Free, zéro carte).
- **Records dans CF** : MX×3 (`mx1/2/3.mail.ovh.net`), TXT SPF + GSC. **Les A @/www (vitrine
  `146.59.209.152`) ont été SUPPRIMÉS** (17/09) — l'apex et www sont servis par le custom domain
  du worker `delegpharma-redirect` (301 → app).
- **Custom domains CF** : `app.delegpharma.com` → worker `delegpharma` (healthz 200) ;
  `delegpharma.com` + `www.delegpharma.com` → worker `delegpharma-redirect` (301 → app).
- **Token CF Zone:DNS:Edit OK** (vérifié API 200, sha16 `dfa639b294abceaf` len 53 dans
  `~/secrets-delegpharma.env`) — custom domain Worker scriptable.
- ⚠️ Le token n'a PAS le droit Rulesets (403) ni Worker Routes (`method not allowed`) → la redirect
  apex/www passe par **custom domain Worker** (`PUT /accounts/:id/workers/domains`, prouvé 200), pas
  par Redirect Rule ni route Worker.

## Principe — pourquoi c'est à moitié manuel, et ce qui est fait

La création de zone CF (`Zone:Edit`) et le changement de NS chez le registrar OVH sont des
actions utilisateur (dashboard) : le token CF actuel n'a qu'un scope `Workers:*` (probe create
zone → `403`) ; le token OVH n'a que la zone DNS (probe registrar → `403`). Tout le reste est
automatisé par scripts :

- **`scripts/dns-cutover.sh`** — pré-vol (lecture seule) par défaut : état zone CF (présente ?
  status ? NS CF assignés ?), NS actuels, MX, healthz worker + app, manifeste des records à
  copier. En `--apply` : pose les records MX/SPF/A (idempotent, **dès que la zone existe**,
  pending ou active), puis guide étape 2 si pending, puis custom domain Worker + Redirect
  301 uniquement quand la zone est `active`.
- **`scripts/dns-cutover-watch.sh`** — enchaîne tout automatiquement : boucle de sondage qui
  détecte chaque précondition, pose les records AVANT la bascule NS (mail jamais cassé),
  guide les 2 étapes dashboard, pose custom domain + redirect quand la zone passe `active`,
  et boucle jusqu'à `dns-cutover-verify.sh --check` = 4/4. Modes `--once` / `--report`.
- **`scripts/dns-cutover-verify.sh`** — vérification finale read-only (4/4 attendu).

Aucune bascule de NS n'est déclenchée par un script — c'est une décision volontaire et
réversible (re-pointer NS OVH pour rollback).

## ✅ PRÉREQUIS token CF avec `Zone:DNS:Edit` — RÉALISÉ le 17/09

Token `misty-wildflower-9b19` créé (dashboard CF, zéro carte, value jamais affichée) avec :
Policy 1 = `delegpharma.com` → **DNS Write** + **Workers Routes Write** (custom domain) ;
Policy 2 = Compte entier → **Workers Scripts Write**. Posé dans `~/secrets-delegpharma.env`
(`CF_API_TOKEN=…`, **confirmation sha16 `dfa639b294abceaf`, len 53**), vérifié API 200.
⚠️ Piège récurrent : après toute écriture PowerShell du fichier secrets, retirer le BOM UTF-8
(sinon la 1ʳᵉ clé est cassée) et les CRLF — `sed -i '1s/^\xef\xbb\xbf//; s/\r$//'`.

## Procédure automatisée (le mail ne doit JAMAIS tomber)

Tu peux relancer ceci en continu pendant que tu fais les 2 étapes dashboard ; il reprend seul
là où les préconditions le permettent :

```bash
bash scripts/dns-cutover-watch.sh        # boucle (Ctrl-C pour stopper, relance = reprend)
```

### Étape 1 (action utilisateur, dashboard CF) — Add a site `delegpharma.com`, plan Free
Le watch sonde `/zones?name=` et détecte l'apparition de la zone automatiquement. Dès qu'elle
est présente il passe à l'étape suivante. *(Alternative manuelle : `bash scripts/dns-cutover.sh`
puis `--apply` dès que la zone existe.)*

### Étape 2 (API OVH — FAITE le 17/09) — remplacer les NS
Le `--apply` a posé les records **AVANT** ça (MX d'abord), donc le mail ne tombe pas quand les
NS basculent. Le 17/09, la bascule a été soumise par **API OVH** (token `delegpharma-dns-cutover`,
consumer key créée via `auth.eu.ovhcloud.com/api/createToken`) : `POST /domain/delegpharma.com/
nameServers/update` → `{"nameServers":[{"host":"adi.ns.cloudflare.com"},{"host":"gerardo.ns.cloudflare.com"}]}`
→ HTTP 200, tâche `600432804`. ⚠️ **Routes réelles de l'API domain actuelles** : les droits demandés
« GET/PUT/POST /nameServers » n'existent PLUS (404) — les routes vraies sont `GET/POST
/nameServer` (singulier) et `POST /nameServers/update` (bascule en bloc). Token v2 avec droits
corrects (`GET /nameServer/*` + `POST /nameServers/update`) posé dans `~/secrets-delegpharma.env`
(clés `OVH_API_APPLICATION_KEY`/`_SECRET`/`_CONSUMER_KEY`).

### Étape 3 (script) — custom domain + redirect, dès que la zone est `active`
Le watch (ou un second `--apply`) pose `PUT /accounts/:id/workers/domains` :
`app.delegpharma.com` → worker `delegpharma`, puis `delegpharma.com` + `www.delegpharma.com` →
worker `delegpharma-redirect` (301 → app ; **les A @/www sont supprimés avant le bind** — sinon
conflit 100117 « Hostname already has externally managed DNS records »). Les Redirect Rules
(`/zones/{id}/rulesets`) et les Worker Routes sont **refusés par le token** (403 /
`method not allowed`, vérifié 17/09) — le custom domain Worker est le seul chemin autorisé.

### Étape 4 (script) — vérification propagation — **FAIT (4/4 le 17/09)**
`dns-cutover-verify.sh --check` : NS CF, healthz app 200, 3 MX OVH, apex 301. Le jour même la
propagation a convergé (bien avant les 24-72 h redoutés, TTL NS 24 h).

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

1. **NS** : re-`POST /domain/delegpharma.com/nameServers/update` avec `ns106.ovh.net` +
   `dns106.ovh.net` (token OVH déjà dans `~/secrets-delegpharma.env`).
2. **DNS apex/www** : supprimer les custom domains `delegpharma.com`/`www.delegpharma.com` du worker
   `delegpharma-redirect` et re-poser les A @/www → `146.59.209.152` (vitrine) si besoin.
Le worker reste joignable sur `delegpharma.momosall2010.workers.dev` quoi qu'il
arrive (filet).

## Règles

- **Zéro carte** : plan CF Free pour la zone, comme sakeurimmo.com.
- **Le mail ne tombe jamais** : MX reproduits dans CF AVANT la bascule NS (étape 1.3).
- Aucun secret dans ce runbook ; aucune action NS sans confirmation explicite.
