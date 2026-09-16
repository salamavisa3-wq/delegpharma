# Migration DelegPharma : VPS OVH → Cloudflare Workers (zéro carte)

Migration réelle réalisée : **VPS OVH → stack 100 % sans carte** (skill
`vps-zero-carte`) — Cloudflare Workers (Express 5 via `nodejs_compat` +
`httpServerHandler`) + Static Assets (edge) + **Neon Postgres** + KV + GitHub
Actions. Zéro Google Cloud / Oracle / Render ; jamais de carte, jamais
d'upgrade payant (limite dure : 10 ms CPU/invocation Workers Free ; quota
dépassé → optimisation, jamais upscale). Repli validé 16/09 : R2 bloqué sur ce
compte sans carte → **PDFs → KV**, **backups → Artifacts GitHub**.

Cette page annule la préparation antérieure en **Oracle Cloud / GCP / Docker**
(ce chemin, qui concluait que « DelegPharma ne se porte pas vers Workers »,
est obsolète : l'adaptateur DB et le pattern HTTP l'ont porté sans réécriture
des 15 routeurs).

## Stack cible (en place dans le repo)

| Brique | Choix |
|---|---|
| Application | `backend/src/worker.js` → `httpServerHandler({port:3000})`, Express 5 inchangé |
| API | Les 15 routeurs (`backend/src/routes/`) — seuls `auth.js` (scrypt) et `crv.js` (PDF async) ont bougé |
| DB | Neon Postgres via `setDriver('neon')` dans `backend/src/db.js` (adaptateur partagé pg/neon ; schema `PgDDL` déjà utilisé en prod = zéro changement de schéma) |
| Auth | `node:crypto.scryptSync` N=4096 (≈11 ms, tient sous les 10 ms… à 1 ms près, paramètre mesuré) ; hash `$2b$` legacy → **403 PASSWORD_RESET** → reset gated `plateforme` |
| PDF CRV | Asynchrone : `pdf_jobs` (queue) en base → génération GitHub Actions (`pdf.yml`, pdfkit CPU illimité) → KV `delegpharma-pdfs` → servi par le Worker (`/pdfs/*`, jamais public) |
| Frontend | Static Assets edge (`wrangler.toml [assets]`, `run_worker_first`) ; SSR SEO conservé (lazy warm + fallback noindex soft-404) |
| Déploiement | `deploy.yml` (wrangler-action@v3 + `scripts/schema-init.mjs` schéma seul) |
| Backup | `backup.yml` (`pg_dump` Neon → gzip → **artifact GitHub**, rétention 14 j) |

## Secrets (jamais dans le code)

- `wrangler secret put` : `NEON_DATABASE_URL`, `JWT_SECRET`, `CINETPAY_APIKEY`,
  `CINETPAY_SITE_ID`, `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `OLLAMA_API_KEY`.
- GitHub Secrets : `NEON_DATABASE_URL`, `CF_API_TOKEN`, `CF_ACCOUNT_ID`.
- Variable GitHub : `KV_NAMESPACE_ID` (id public du namespace `delegpharma-pdfs`, pas un secret).
- Secrets R2 (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ENDPOINT`) retirés — repli KV/Artifacts.
- Les valeurs ne circulent jamais dans le chat ni dans git (comparaison par NOMS
  via `scripts/migrate-env.sh` du skill) ; si le `.env` prod est introuvable →
  régénérer `JWT_SECRET` (logout général, acceptable sur un SaaS down).

## À faire au cutover (action utilisateur)

1. **Récupérer le dump prod** (SSH OVH `~/backups/delegpharma-*.sql.gz` →
   `backups/`, gitignoré) + noter sa taille (décide Neon direct vs repli D1).
2. Poser les secrets (ci-dessus), tester en local `wrangler dev`, déployer.
3. `migration-data.yml` (one-shot) : restore dump → compteurs → reset des hash `$2b$`.
4. Bascule DNS : zone Cloudflare `delegpharma.com`, `app.delegpharma.com` →
   custom domain Worker, 301 `delegpharma.com`/`www` en Redirect Rule (remplace
   le 301 serveur), NS Cloudflare.
5. Vérifier santé / SSR / login / PDF, garder le dump pour rollback.
6. Offboarding OVH : résilier le VPS, retirer `OVH_*` de `scripts/.env`.

Voir le plan complet (Cloudflare migration) dans le dossier plans de la session.
