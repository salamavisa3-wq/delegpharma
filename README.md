# DelegPharma SaaS

SaaS de suivi des **délégués médicaux** au Sénégal : CRV (comptes rendus de visite), tournées,
campagnes, objectifs produit phare par zone, messagerie labo↔délégué, et **monétisation par
abonnement mensuel** (délégué → Essentiel / Standard / Premium) via **CinetPay** (Mobile Money).

Stack : **Node + Express 5 + PostgreSQL 16** (prod VPS OVHcloud) — **SQLite (`node:sqlite`) en dev local**.
Frontend : SPA vanilla (mobile-first, hash-routing), servie par le même service Express.
Repo : https://github.com/salamavisa3-wq/delegpharma

## Architecture cible

```
delegpharma.com ──► systeme.io (CloudFront dejc22hvp6w80.cloudfront.net)
                        vitrine + tarifs + tunnel d'inscription + CTA → app.delegpharma.com/#/inscription

app.delegpharma.com ──► VPS OVHcloud
                          nginx (443, SSL certbot) → Node/Express :10000
                          PostgreSQL 16 (base delegpharma)
```

| Point d'entrée | Hébergeur | Rôle |
|---|---|---|
| `delegpharma.com` / `www.delegpharma.com` | systeme.io via CloudFront | Vitrine, tarification, tunnel |
| `app.delegpharma.com` | VPS OVHcloud (nginx → Node) | API + application SPA |

## Monétisation (§3)

- **3 formules** (seedées) : Essentiel **5 000 F** / Standard **10 000 F** / Premium **15 000 F** — 30 jours.
- **Paiement** : agrégateur CinetPay (Mobile Money). Env `PAY_MODE=demo` → paiement simulé,
  validation manuelle par un rôle habilité (bouton « confirmer ») ; `PAY_MODE=cinetpay` → réel.
- **Cycle de vie** : `en_attente → actif → arrive_expiration → expire → resilie`.
  - échéance vérifiée paresseusement à chaque requête (`getSubscriptionState`) ;
  - `arrive_expiration` (≤ 3 j) → bannière + relance ; `expire` → **lecture seule** progressive ;
  - upgrade/downgrade : le paiement le plus récent fait foi, les autres abonnements passent `resilie`.
- **Idempotence** : `reference` UNIQUE + garde `WHERE ... AND statut='en_attente'` → double webhook =
  pas de double activation.

## Comptes démo

| Rôle | Login | Mot de passe |
|------|-------|--------------|
| Délégué Médical | dm.senegal | Dm@2026Deleg |
| Manager | manager.senegal | Manager@2026 |
| Laboratoire | labo.pharma | Labo@2026Pharma |
| Admin (tenant) | admin.deleg | Admin@2026Deleg |
| **Admin plateforme** (SaaS, tous labos) | admin.plateforme | Admin@2026Plateforme |
| **Professionnel de santé** (lecture seule) | ps.demo | Ps@2026Deleg |

> Les mots de passe démo sont à changer en production (bcrypt).

## Dev local (SQLite)

```bash
cd backend
npm install
npm run seed          # idempotent — 14 régions / 79 districts, tenant MEDIS, formules, comptes
JWT_SECRET="dev-secret" PORT=10000 npm start
```

Aucune `DATABASE_URL` requise → fichier jetable `data/delegpharma.db`.
Frontend servi sur `http://localhost:10000/`.

## Endpoints

**Public**
- `GET  /api/health`
- `POST /api/auth/login`, `POST /api/auth/inscription` (délégué self-signup)
- `GET  /api/tarifs` (3 formules), `GET /api/laboratoires` (pour l'inscription)
- `POST /api/webhooks/cinetpay` (notif CinetPay → vérif serveur + activation idempotente)

**Authentifié (cookie httpOnly `dp_token`, JWT)**
- `GET  /api/auth/me`
- Référentiel : `GET /api/regions`, `/api/districts?region_id=`, `/api/structures` (GET/POST/DELETE),
  `/api/professionnels` (GET/POST/PUT/DELETE), `GET /api/catalog`
- CRV : `GET|POST /api/visites`, `/visites/:id/submit`, `/validate`, `/refuse`, `/pdf`, `/doc/:n`
- Tournées : `GET|POST /api/tournees`, `/api/districts/:id/professionnels`
- Campagnes : `GET|POST /api/campagnes`
- Abonnement : `GET /api/abonnements/mon` (statut + historique), `POST /api/abonnements/initier`
  (paiement), `POST /api/abonnements/payer` (relance), `POST /api/abonnements/demo-confirmer`,
  `GET /api/abonnements/transactions`
- Objectifs : `GET|POST /api/objectifs` (+ progression réalisé vs objectif)
- Notifications : `GET|POST /api/notifications`, `POST /api/notifications/:id/lu`
- Revenus : `GET /api/revenus` (CA par formule, évolution mensuelle, par statut)
- Dashboard : `GET /api/dashboard`
- Export : `GET /api/export/visites.csv` (BOM UTF-8, filtres identiques à GET /api/visites)
- **Plateforme** (`/api/plateforme`, rôle plateforme) : `GET /api/plateforme/dashboard` (multi-labo, CA global)
- **Professionnel** (`/api/professionnel`, rôle professionnel) : `GET /visites` (les siennes), `GET /synthese`

## Configuration

Voir [`.env.example`](.env.example). Variables clés :

| Variable | Dev | Prod (VPS) |
|---|---|---|
| `DATABASE_URL` | *(absente → SQLite)* | `postgresql://delegpharma:…@localhost:5432/delegpharma` |
| `JWT_SECRET` | `dev-secret` | long aléatoire (`openssl rand -hex 32`) |
| `COOKIE_SECURE` | `false` | `true` |
| `PAY_MODE` | `demo` | `cinetpay` |
| `CINETPAY_APIKEY` / `CINETPAY_SITE_ID` | *(sandbox si testé)* | clés marchand CinetPay |
| `APP_BASE_URL` | `http://localhost:10000` | `https://app.delegpharma.com` |
| `PORT` | `10000` | `10000` |

> **Sécurité** : jamais de clé API côté client. `CINETPAY_APIKEY` vit uniquement sur le serveur
> (fichier `.env` du VPS, hors git).

## Déploiement

- VPS OVHcloud : voir [`docs/DEPLOIEMENT.md`](docs/DEPLOIEMENT.md).
- DNS delegpharma.com (systeme.io + app) : voir [`docs/DNS.md`](docs/DNS.md).
- Schéma de base documenté : voir [`docs/SCHEMA.md`](docs/SCHEMA.md).

## Notes techniques

- Un seul service Express sert l'API + le frontend statique (`frontend/` via `express.static`),
  fallback SPA pour toute route non-`/api`.
- Ordre de montage critique : les routes publiques (tarifs, laboratoires, webhook CinetPay)
  sont montées **avant** les routers qui font `router.use(requireAuth)` en tête.
- Règle zone → professionnel : le PS porte `structure_id` ; les filtres par zone passent par
  `structure.region_id / district_id`.
- Multi-driver `db.js` : SQLite en dev, PostgreSQL en prod (placeholders `$n`, `RETURNING id`).
