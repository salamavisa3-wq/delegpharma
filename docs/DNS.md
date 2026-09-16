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

### Étape 2 (action utilisateur, registrar OVH) — remplacer les NS
Le `--apply` a posé les records **AVANT** ça (MX d'abord), donc le mail ne tombe pas quand les
NS basculent. Le watch affiche les 2 NS CF à copier : OVHcloud → domaines →
delegpharma.com → **serveurs DNS** → remplacer `ns106.ovh.net` / `dns106.ovh.net`.

### Étape 3 (script) — custom domain + redirect, dès que la zone est `active`
Le watch (ou un second `--apply`) pose `PUT /accounts/:id/workers/domains`
(`app.delegpharma.com` → worker `delegpharma`) puis la Redirect Rule 301 apex + www → `app`.

### Étape 4 (script) — vérification propagation
`dns-cutover-verify.sh --check` en boucle jusqu'à **4/4** (NS CF, healthz app 200, 3 MX OVH,
apex 301). Propagation possible 24-72 h (TTL NS 24 h).

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
