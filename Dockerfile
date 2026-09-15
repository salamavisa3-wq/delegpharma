# Express 5 — pas de build frontend (SPA vanilla JS servie statiquement par
# backend/src/server.js depuis ../../frontend). Un seul service, comme en
# prod OVHcloud actuelle (systemd), packagé ici pour le déploiement vps-deploy.
FROM node:22-alpine
WORKDIR /app

COPY backend/package*.json backend/
RUN cd backend && npm ci --omit=dev

COPY backend/src backend/src
COPY frontend frontend

WORKDIR /app/backend
ENV NODE_ENV=production
EXPOSE 10000
CMD ["node", "src/server.js"]
