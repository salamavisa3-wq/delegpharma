// DelegPharma — factory Express (API + santé + SEO). Sans listen, sans seed, sans serveur
// statique : monté par server.js (node dev) et worker.js (Workers, edge assets + R2).
import express from 'express';
import cookieParser from 'cookie-parser';

import { requireAuth, requireRole } from './auth.js';
import { seoShell, robotsTxt, sitemapXml, matchPage } from './seo.js';
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
import plateformeLaboratoiresRoutes from './routes/plateforme-laboratoires.js';
import assistantRoutes from './routes/assistant.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // derrière le proxy edge (IP réelle, HTTPS)
  app.disable('x-powered-by');

  app.use(cookieParser());
  app.use(express.json({ limit: '15mb' })); // pièces jointes CRV en base64
  app.use(express.urlencoded({ extended: true })); // webhook CinetPay (form)

  // Santé
  app.get('/api/health', (req, res) =>
    res.json({ ok: true, service: 'delegpharma', time: new Date().toISOString() }));

  // Liveness probe publique (uptime monitors) : un vrai endpoint, distinct des pages SSR.
  app.get('/healthz', (req, res) =>
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
  app.use('/api/plateforme/laboratoires', requireAuth, requireRole('plateforme'), plateformeLaboratoiresRoutes);
  app.use('/api/professionnel', requireAuth, requireRole('professionnel'), professionnelRoutes);
  app.use('/api', exportRoutes);
  app.use('/api', assistantRoutes);

  // SEO : robots.txt + sitemap.xml (avant le fallback qui les capturerait sinon)
  app.get('/robots.txt', (req, res) => res.type('text/plain').send(robotsTxt()));
  app.get('/sitemap.xml', (req, res) => res.type('application/xml').send(sitemapXml()));

  return app;
}

// --- Fallback terminal : API inconnue → 404 JSON ; pages publiques → SSR ; fichiers → assets.
// Proxie les fichiers d'assets vers la binding Static Assets (Workers) ; en node (dev),
// express.static (server.js) a déjà servi les fichiers avant ce middleware → 404 ici.
async function serveAssets(req, res) {
  try {
    const { env } = await import('cloudflare:workers');
    if (env?.ASSETS) {
      const url = `https://${req.headers.host || 'localhost'}${req.originalUrl}`;
      const resp = await env.ASSETS.fetch(new Request(url, { method: req.method, headers: req.headers }));
      // Copie sans les en-têtes qui décrivent la représentation du corps.
      const headers = new Headers(resp.headers);
      headers.delete('content-encoding');
      headers.delete('content-length');
      res.status(resp.status).set(Object.fromEntries(headers.entries()));
      return res.end(Buffer.from(await resp.arrayBuffer()));
    }
  } catch { /* node local — pas de binding ASSETS */ }
  return res.status(404).type('text/plain').send('Not Found');
}

// Une ressource avec extension = un fichier statique réel (app.js, og-image.png, llms.txt…).
const ASSET_RE = /\.(css|js|svg|jpg|jpeg|png|webp|ico|json|txt|xml|woff2?)$/i;

export function seoFallback(req, res, next) {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Route API inconnue' });

  // Pages publiques SSR : source de vérité matchPage (PAGES + /carte-sanitaire/*, '/', fallback noindex).
  if (matchPage(req.path)) {
    return seoShell(req)
      .then((html) => res.status(200).type('html').send(html))
      .catch(() => res.status(500).type('html').send('Service indisponible'));
  }

  // Fichiers statiques (avec extension) → assets edge.
  const qs = req.path.indexOf('?') === -1 ? req.path : req.path.slice(0, req.path.indexOf('?'));
  if (ASSET_RE.test(qs)) return serveAssets(req, res);

  // Route inconnue SANS extension : soft-404 NOINDEX (P1 saas-propulsion). On ne proxy PAS
  // vers l'index fallback SPA (single-page-application renverrait un 200 indexé → régression).
  return seoShell(req)
    .then((html) => res.status(404).type('html').send(html))
    .catch(() => res.status(404).type('text/plain').send('Not Found'));
}
