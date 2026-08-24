# Déploiement backend — VPS OVHcloud → app.delegpharma.com

Le backend (Node/Express + PostgreSQL) tourne sur un **VPS OVHcloud** derrière
`app.delegpharma.com`. Nginx reverse-proxie le HTTPS vers le service Node.

```
internet → app.delegpharma.com:443 (nginx, SSL Let's Encrypt)
             → 127.0.0.1:10000 (Node/Express, SPA + API)
             → PostgreSQL 16 local (socket/127.0.0.1:5432)
```

## 1. Prérequis

- VPS OVHcloud provisionné (VPS-1 suffit : 2 vCPU, 4 Go RAM) — Ubuntu 22.04/24.04, IP publique.
- Accès SSH (root ou utilisateur `sudo`), accès au gestionnaire DNS OVHcloud du domaine
  `delegpharma.com` (mutualisé `cluster031.hosting.ovh.net`).

## 2. Installation serveur

```bash
# Node.js 20 LTS (NodeSource)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs nginx postgresql certbot python3-certbot-nginx git

# PostgreSQL : user + base dédiés
sudo -u postgres psql
  CREATE USER delegpharma WITH PASSWORD 'CHANGE_ME';
  CREATE DATABASE delegpharma OWNER delegpharma;
  \q
```

## 3. Code + dépendances

```bash
# /opt/delegpharma, propriété d'un utilisateur applicatif (delegpharma)
sudo mkdir -p /opt/delegpharma && sudo chown -R $USER /opt/delegpharma
cd /opt/delegpharma
git clone https://github.com/salamavisa3-wq/delegpharma.git .
cd backend
npm ci --omit=dev
```

## 4. Fichier `.env` de production

`/opt/delegpharma/backend/.env` (hors git — mode 600) :

```ini
NODE_ENV=production
DATABASE_URL=postgresql://delegpharma:CHANGE_ME@127.0.0.1:5432/delegpharma
JWT_SECRET=<openssl rand -hex 32>
PORT=10000
COOKIE_SECURE=true

PAY_MODE=cinetpay
CINETPAY_APIKEY=<clé marchand>
CINETPAY_SITE_ID=<id site marchand>
APP_BASE_URL=https://app.delegpharma.com

# Identité légale / contact — obligatoire avant mise en prod réelle (site encaissant des
# paiements). Sans ces valeurs, /contact et /mentions-legales restent en texte de repli
# et /mentions-legales est légalement incomplète. Voir .env.example pour le détail.
SUPPORT_EMAIL=<email support>
SUPPORT_WHATSAPP=<numéro WhatsApp>
LEGAL_ENTITY_NAME=<raison sociale + forme juridique>
LEGAL_ADDRESS=<adresse enregistrée>
LEGAL_RC=<registre de commerce>
LEGAL_NINEA=<NINEA>
LEGAL_DIRECTOR_NAME=<directeur de la publication>
```

> Le schéma (14 tables) et les données de référence (14 régions / 79 districts, formules, comptes)
> sont créés **automatiquement au premier démarrage** (`initSchema()` + `seed()`/`seedExtras()`
> idempotents au boot). Aucune importation manuelle nécessaire.

## 5. Gestion de process — systemd

`/etc/systemd/system/delegpharma.service` :

```ini
[Unit]
Description=DelegPharma API + SPA
After=network.target postgresql.service

[Service]
User=delegpharma
WorkingDirectory=/opt/delegpharma/backend
EnvironmentFile=/opt/delegpharma/backend/.env
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now delegpharma
curl http://127.0.0.1:10000/api/health   # → {"ok":true,...}
```

## 6. Nginx + SSL

`/etc/nginx/sites-available/delegpharma` :

```nginx
server {
  listen 80;
  server_name app.delegpharma.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name app.delegpharma.com;

  # ssl_certificate / ssl_certificate_key → gérés par certbot
  location / {
    proxy_pass http://127.0.0.1:10000;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;   # trust proxy = 1 côté Express
  }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/delegpharma /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d app.delegpharma.com
```

## 7. DNS

Voir [`DNS.md`](DNS.md) — `app.delegpharma.com` doit pointer vers l'IP du VPS **avant** que
certbot puisse valider le domaine (A ou CNAME selon l'hébergeur DNS).

Vérification complète depuis un poste local :

```bash
curl https://app.delegpharma.com/api/health
curl -I https://app.delegpharma.com/            # 200, SPA
```

## 8. Redéploiement (script deploy)

```bash
#!/usr/bin/env bash
set -e
# Le dépôt appartient à l'utilisateur applicatif `delegpharma` (pas à ubuntu/root) :
# git doit tourner en `delegpharma`, sinon "dubious ownership" + Permission denied sur .git/.
sudo -u delegpharma git config --global --add safe.directory /opt/delegpharma
cd /opt/delegpharma
sudo -u delegpharma git pull --ff-only
cd backend
npm ci --omit=dev
sudo systemctl restart delegpharma
```

Optionnel : hook webhook Git (bouton « Redéployer ») ou cron `*/5 * * * * git pull`.

## 9. Sauvegarde

```bash
pg_dump -U delegpharma delegpharma | gzip > ~/backups/delegpharma-$(date +%F).sql.gz
```

Cron quotidien + rétention 14 jours. Les pièces jointes CRV sont en base64 dans `visite.docs`
(la sauvegarde SQL couvre tout).

## 10. Rollback

- **Application** : `git checkout <commit-précédent> && npm ci --omit=dev && systemctl restart`.
- **Données** : `psql delegpharma < backup.sql.gz` décompressé (arrêter le service pendant la restauration).
