// DelegPharma — entrée node (dev / test). Même factory que le Worker (app.js) + serveur
// statique local (express.static) + seed idempotent au boot + listen.
import express from 'express';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createApp, seoFallback } from './app.js';
import { initSchema } from './schema.js';
import { seed, seedExtras, seedDemoActivity, seedCatalog } from './seed.js';
import { warmTarifs, warmLaboratoires, warmCarteSanitaire } from './seo.js';

const here = dirname(fileURLToPath(import.meta.url));
const frontendDir = resolve(here, '../../frontend');

const app = createApp();

// Frontend statique (app.js, app.css, llms.txt, og-image.png) sans index.html auto
// (le fallback SSR seoFallback s'occupe des pages publiques et de la soft-404).
app.use(express.static(frontendDir, {
  index: false,
  maxAge: '1y',
  setHeaders: (res, chemin) => {
    if (/\.(css|js|svg|jpg|jpeg|png|webp|ico|json|txt|xml)$/i.test(chemin)) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=3600');
    }
  },
}));

app.use(seoFallback);

// Filet de survie : une promesse rejetée ou une exception ne doit pas crash-loop le service.
process.on('unhandledRejection', (err) => console.error('[unhandledRejection]', err));
process.on('uncaughtException', (err) => console.error('[uncaughtException]', err));

const PORT = process.env.PORT || 10000;
initSchema()
  .then(() => seed())      // idempotent : ne fait rien si meta.seeded_v1 existe déjà
  .then(() => seedExtras()) // idempotent : formules + comptes plateforme/professionnel
  .then(() => seedDemoActivity()) // idempotent : activité démo (CRV/tournées/objectifs/abonnement)
  .then(() => seedCatalog()) // idempotent : catalogue marché Sénégal (~220 produits, dédoublonné)
  .then(() => warmTarifs()) // SSR des tarifs (cache base réelle, fallback statique)
  .then(() => warmLaboratoires()) // SSR des laboratoires (cache base réelle)
  .then(() => warmCarteSanitaire()) // SSR carte sanitaire (régions/districts depuis la base)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`DelegPharma API écoute sur :${PORT} (${process.env.NODE_ENV || 'dev'})`);
    });
  })
  .catch((e) => {
    console.error('initSchema/seed a échoué :', e);
    process.exit(1);
  });
