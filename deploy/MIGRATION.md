# Migration DelegPharma : VPS OVHcloud → vps-deploy (Oracle Cloud Free Tier)

Contexte : le VPS OVH actuel (`164.132.109.175`, `app.delegpharma.com`) est
injoignable (timeout total sur 80/443 le 15/09/2026 — pas un souci de
certificat SSL, celui-ci reste valide jusqu'au 2026-11-08). Fichiers de
déploiement préparés côté repo (`Dockerfile`, `docker-compose.yml`, workflows
GitHub) ; le provisionnement cloud reste une action utilisateur.

## ⚠️ Avant de commencer : statut Oracle Cloud

Sur un autre projet de cet environnement (SakeurImmo, 05/09/2026), **Oracle
Cloud a refusé la création de compte pour le Sénégal** (blocage de
vérification côté Oracle, pas une sanction). Si ce blocage tient toujours :
- Option de repli : Google Cloud Always Free (`gcp-provision.sh`, voir le
  skill `vps-deploy` Phase 0 Option B) — mais capacité plus faible
  (`e2-micro`, 1 Go RAM) et carte bancaire également requise à la
  vérification.
- DelegPharma (Express + Postgres en conteneur, sessions cookie, webhooks
  CinetPay/PayPal) ne se porte pas vers Cloudflare Workers sans réécriture
  significative (contrairement à SakeurImmo qui a fini sur Workers) — ce
  n'est pas une option équivalente ici.

**Vérifier en premier** (avant d'aller plus loin) : tenter la création d'un
compte/tenancy Oracle Cloud pour ce projet. Si refusé de nouveau, revenir
sur ce fichier pour arbitrer GCP vs. réparation du VPS OVH existant plutôt
qu'une migration complète.

## Fichiers déjà prêts dans ce repo

- `Dockerfile` — image Node 22 Alpine, `npm ci --omit=dev` dans `backend/`,
  sert `frontend/` en statique (pas de build, cohérent avec la prod OVH
  actuelle).
- `docker-compose.yml` — service `app` (port interne 10000, healthcheck
  `/healthz`) + `db` (Postgres 16, volume `pgdata`), réseau `caddy_net`
  externe (pas de `ports:` publiés).
- `.env.example` — ajout des variables `POSTGRES_USER/PASSWORD/DB` requises
  par le conteneur `db` (à côté des variables applicatives déjà existantes :
  CinetPay, PayPal, JWT_SECRET, légal).
- `.github/workflows/deploy.yml` — déploiement health-gated + rollback auto
  vers `/opt/apps/delegpharma`.
- `.github/workflows/healthcheck.yml` — ping externe `/healthz` toutes les
  15 min (filet de sécurité si le VPS lui-même est injoignable).

## Étapes restantes (action utilisateur)

1. **Compte cloud** — Oracle (voir avertissement ci-dessus) ou GCP.
   Instance Ubuntu 24.04, clé SSH ajoutée, ports 22/80/443 ouverts.
2. **Bootstrap hôte** (une fois) :
   ```bash
   ssh ubuntu@<IP> "mkdir -p /tmp/vps-deploy"
   scp -r "$HOME/.claude/skills/vps-deploy/scripts" "$HOME/.claude/skills/vps-deploy/templates" ubuntu@<IP>:/tmp/vps-deploy/
   ssh ubuntu@<IP> "sudo bash /tmp/vps-deploy/scripts/provision.sh deploy '<CLÉ_PUBLIQUE_DEPLOY>'"
   ```
3. **Onboarder l'app** :
   ```bash
   ssh deploy@<IP> "sudo bash /opt/scripts/onboard-app.sh delegpharma app.delegpharma.com node 10000"
   ```
4. **Compléter `/opt/apps/delegpharma/.env`** sur le serveur (jamais dans le
   repo) — copier depuis `/opt/delegpharma/backend/.env` sur l'ancien VPS OVH
   (CinetPay, PayPal, JWT_SECRET, légal) + ajouter `POSTGRES_*` et changer
   `DATABASE_URL` pour `host=db`.
5. Premier démarrage : `cd /opt/apps/delegpharma && docker compose up -d --build`.
6. **Secrets GitHub** (repo `salamavisa3-wq/delegpharma`) : `VPS_HOST`,
   `VPS_USER=deploy`, `VPS_PORT=22`, `VPS_SSH_KEY` (paire dédiée, générer avec
   `ssh-keygen -t ed25519 -f deploy_key -N ""`, clé publique ajoutée à
   `/home/deploy/.ssh/authorized_keys` sur le nouveau VPS).
7. **Bascule DNS** : `app.delegpharma.com` A record → nouvelle IP (garder
   l'ancien enregistrement en secours jusqu'à vérification complète).
8. **Vérifier** : `https://app.delegpharma.com/healthz` → 200, cert
   Let's Encrypt valide, `/api/tarifs` → 3 formules (test fonctionnel déjà
   utilisé lors du déploiement OVH initial).
9. **Sauvegarde + restauration testée** : `/opt/scripts/backup.sh` (cron auto
   3h30 posé par `onboard-app.sh`) puis `sudo -u deploy bash
   /opt/scripts/restore.sh delegpharma` au moins une fois.
10. Une fois validé en prod : décommissionner l'ancien VPS OVH (ou le garder
    en attente si le contrat court encore).

## Non touché par cette préparation

- `render.yaml` à la racine du repo — semble être un résidu d'un chemin de
  déploiement Render non utilisé (la prod réelle tourne sur OVH via
  systemd, pas Render). Laissé en place, à confirmer/supprimer séparément
  si l'utilisateur confirme qu'il est mort.
