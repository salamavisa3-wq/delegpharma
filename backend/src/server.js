// DelegPharma — API Express 5 + frontend statique (SPA vanilla), un seul service Render.
import express from 'express';
import cookieParser from 'cookie-parser';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { initSchema } from './schema.js';
import { seed, seedExtras, seedDemoActivity } from './seed.js';
import { requireAuth, requireRole } from './auth.js';
import authRoutes from './routes/auth.js';
import referentielRoutes from './routes/referentiel.js';
import crvRoutes from './routes/crv.js';
import tourneeRoutes from './routes/tournees.js';
import campagneRoutes from './routes/campagnes.js';
import dashboardRoutes from './routes/dashboard.js';
import abonnementsRoutes from './routes/abonnements.js';
import objectifsRoutes from './routes/objectifs.js';
import notificationsRoutes from './routes/notifications.js';
import plateformeRoutes from './routes/plateforme.js';
import professionnelRoutes from './routes/professionnel.js';
import exportRoutes from './routes/export.js';

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, '../../frontend');

const app = express();
app.set('trust proxy', 1); // derrière le proxy Render (IP réelle, HTTPS)
app.disable('x-powered-by');

app.use(cookieParser());
app.use(express.json({ limit: '15mb' })); // pièces jointes CRV en base64
app.use(express.urlencoded({ extended: true })); // webhook CinetPay (form)

// Santé
app.get('/api/health', (req, res) =>
  res.json({ ok: true, service: 'delegpharma', time: new Date().toISOString() }));

// API — ordre important : les routes publiques (tarifs, webhook) doivent être
// montées AVANT les routers qui font router.use(requireAuth) en tête (sinon le
// middleware d'un router monté sur /api gate TOUTE requête /api/* qui y entre).
app.use('/api/auth', authRoutes);
app.use('/api', abonnementsRoutes);     // public : /tarifs, /laboratoires, /webhooks/cinetpay
app.use('/api', referentielRoutes);
app.use('/api', crvRoutes);
app.use('/api', tourneeRoutes);
app.use('/api', campagneRoutes);
app.use('/api', dashboardRoutes);
app.use('/api', objectifsRoutes);
app.use('/api', notificationsRoutes);
app.use('/api/plateforme', requireAuth, requireRole('plateforme'), plateformeRoutes);
app.use('/api/professionnel', requireAuth, requireRole('professionnel'), professionnelRoutes);
app.use('/api', exportRoutes);

// Frontend statique + fallback SPA (toutes routes non-/api → index.html)
app.use(express.static(frontendDir));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route API inconnue' });
  return res.sendFile(resolve(frontendDir, 'index.html'));
});

// Filet de survie : une promesse rejetée ou une exception ne doit pas crash-loop le service.
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

const PORT = process.env.PORT || 10000;
initSchema()
  .then(() => seed())      // idempotent : ne fait rien si meta.seeded_v1 existe déjà
  .then(() => seedExtras()) // idempotent : formules + comptes plateforme/professionnel
  .then(() => seedDemoActivity()) // idempotent : activité démo (CRV/tournées/objectifs/abonnement)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`DelegPharma API écoute sur :${PORT} (${process.env.NODE_ENV || 'dev'})`);
    });
  })
  .catch((e) => {
    console.error('initSchema/seed a échoué :', e);
    process.exit(1);
  });
