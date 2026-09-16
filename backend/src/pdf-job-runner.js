// Exécuteur de la file PDF — .github/workflows/pdf.yml (cron */5 + workflow_dispatch).
// Tourne sur le runner GitHub (CPU illimité, contourne les 10 ms du Worker) : lit
// pdf_jobs 'en_attente', génère le PDF avec pdfkit, l'envoie sur R2 (jamais public) et
// marque 'pret' avec l'URL servie par le Worker (route /pdfs/*). Échec → 'echoue'
// (relancable via l'enqueue idempotente côté API).
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setDriver, all, get, run, ph, isPg } from './db.js';
import { crvPdf } from './pdf.js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

// Driver : base = Neon (Postgres) en production, sqlite local pour un test manuel.
setDriver(
  process.env.NEON_DATABASE_URL ? 'neon'
    : process.env.DATABASE_URL && process.env.DATABASE_URL.startsWith('postgres') ? 'pg'
      : 'sqlite',
);
if (!isPg() && !process.env.ALLOW_SQLITE) {
  throw new Error('pdf-job-runner nécessite une base Postgres (NEON_DATABASE_URL manquant)');
}

const BATCH = Math.max(1, Number(process.env.PDF_BATCH || 10));

/** Visite complète (jointures référentiel) — même forme que scopeVisite côté API. */
async function fetchVisite(laboId, visiteId) {
  return get(`
    SELECT v.*, p.nom AS professionnel, p.potentiel, sp.nom AS specialite,
           s.localite AS structure, s.telephone AS structure_telephone,
           d.nom AS district, r.nom AS region,
           u.nom AS auteur, u.role AS auteur_role
    FROM visite v
    LEFT JOIN professionnel p ON p.id = v.professionnel_id
    LEFT JOIN specialite sp ON sp.id = p.specialite_id
    LEFT JOIN structure s ON s.id = v.structure_id
    LEFT JOIN district d ON d.id = s.district_id
    LEFT JOIN region r ON r.id = s.region_id
    LEFT JOIN users u ON u.id = v.user_id
    WHERE v.id = $1 AND v.laboratoire_id = $2`, [visiteId, laboId]);
}

async function hydrateProduits(visite) {
  const arr = JSON.parse(visite.produits || '[]');
  if (!arr.length) return [];
  const prods = await all(
    `SELECT id, nom, dci FROM produit WHERE id IN (${arr.map((_, i) => ph(i + 1)).join(',')})`,
    arr.map((p) => p.produit_id));
  return arr.map((p) => ({ ...p, nom: prods.find((x) => x.id === p.produit_id)?.nom || '' }));
}

export async function processPendingPdfJobs(s3) {
  const jobs = await all(
    `SELECT id, visite_id FROM pdf_jobs WHERE statut = 'en_attente' ORDER BY id ASC LIMIT ${BATCH}`);
  let done = 0, failed = 0;
  for (const job of jobs) {
    await run(`UPDATE pdf_jobs SET statut = 'en_cours' WHERE id = $1`, [job.id]);
    try {
      const v = await get('SELECT * FROM visite WHERE id = $1', [job.visite_id]);
      if (!v) throw new Error(`visite ${job.visite_id} introuvable`);
      const labo = await get('SELECT nom, agrement_arp FROM laboratoire WHERE id = $1', [v.laboratoire_id]);
      const { buffer, filename } = await crvPdf({
        visite: await fetchVisite(v.laboratoire_id, v.id),
        produits: await hydrateProduits(v),
        labo: labo || { nom: '', agrement_arp: '' },
      });
      const key = `pdfs/${filename}`;
      await s3.send(new PutObjectCommand({
        Bucket: process.env.R2_BUCKET,
        Key: key,
        Body: buffer,
        ContentType: 'application/pdf',
      }));
      await run(
        'UPDATE pdf_jobs SET statut = $1, url = $2, erreur = \'\' WHERE id = $3',
        ['pret', `/${key}`, job.id]); // '/' + key = URL servie par le Worker
      done++;
    } catch (e) {
      await run('UPDATE pdf_jobs SET statut = $1, erreur = $2 WHERE id = $3',
        ['echoue', String(e?.message || e), job.id]);
      failed++;
    }
  }
  return { processed: jobs.length, done, failed };
}

// Exécution directe : `node src/pdf-job-runner.js`
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const s3 = new S3Client({
    region: 'auto',
    endpoint: process.env.R2_ENDPOINT, // https://<CF_ACCOUNT_ID>.r2.cloudflarestorage.com
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
  processPendingPdfJobs(s3)
    .then(() => console.log('File PDF traitée.'))
    .catch((e) => {
      console.error('pdf-job-runner a échoué :', e);
      process.exit(1);
    });
}
