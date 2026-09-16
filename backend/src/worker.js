// DelegPharma — point d'entrée Cloudflare Workers. Express 5 via httpServerHandler +
// nodejs_compat (défaut depuis 2026-08-04). Pas de seed au boot : le schéma/idempotent et la
// restauration des données sont faits par les jobs GitHub Actions (CPU illimité).
// Frontend → Static Assets (edge) ; PDFs → R2 (jamais de bucket public).
import { setDriver } from './db.js';
import { httpServerHandler } from 'cloudflare:node';
import { createApp, seoFallback } from './app.js';

setDriver('neon');
const app = createApp();

// PDFs générés par .github/workflows/pdf.yml (pdfkit, CPU illimité) → R2 → servis ici.
app.use('/pdfs', async (req, res) => {
  const key = req.path.replace(/^\/+/, '');
  if (!key || key.includes('..')) return res.status(404).json({ error: 'PDF inconnu' });
  try {
    const { env } = await import('cloudflare:workers');
    const obj = await env.BUCKET.get(key);
    if (!obj) return res.status(404).json({ error: 'PDF introuvable' });
    const buf = Buffer.from(await obj.arrayBuffer());
    res.setHeader('Content-Type', obj.httpMetadata?.contentType || 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${key.split('/').pop()}"`);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(buf);
  } catch {
    return res.status(500).json({ error: 'Erreur interne' });
  }
});

app.use(seoFallback);

// Le premier rendu SSR warms les caches (ensureWarm dans seo.js, mémоïsé, lazy).
app.listen(3000, () => {
  console.log('DelegPharma Worker prêt sur :3000');
});

export default httpServerHandler({ port: 3000 });
