// Module CRV : cycle brouillon → soumis → valide/refusé + pièces jointes + PDF pdfkit.
import { Router } from 'express';
import { all, get, run, lastInsertId, ph } from '../db.js';
import { requireAuth, requireRole, requireAboWrite } from '../auth.js';
import { crvPdf } from '../pdf.js';

const router = Router();
router.use(requireAuth);

/** Visite complète scopée tenant (jointures référentiel). */
async function scopeVisite(req, id) {
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
    WHERE v.id = $1 AND v.laboratoire_id = $2`, [id, req.user.laboratoire_id]);
}

const VISITE_LIST = `
  v.id, v.date, v.resultat, v.compte_rendu, v.prochaine_visite, v.geo, v.statut, v.created_at,
  p.nom AS professionnel, p.potentiel, sp.nom AS specialite,
  s.localite AS structure, d.nom AS district, r.nom AS region,
  u.nom AS auteur`;

router.get('/visites', async (req, res) => {
  const { statut, user_id, date_from, date_to, region_id, district_id } = req.query;
  const clauses = ['v.laboratoire_id = $1'];
  const params = [req.user.laboratoire_id];
  if (req.user.role === 'delegue') { clauses.push('v.user_id = $2'); params.push(req.user.id); }
  if (statut) { clauses.push('v.statut = $' + (params.length + 1)); params.push(statut); }
  if (user_id) { clauses.push('v.user_id = $' + (params.length + 1)); params.push(user_id); }
  if (date_from) { clauses.push('v.date >= $' + (params.length + 1)); params.push(date_from); }
  if (date_to) { clauses.push('v.date <= $' + (params.length + 1)); params.push(date_to); }
  if (region_id) { clauses.push('s.region_id = $' + (params.length + 1)); params.push(region_id); }
  if (district_id) { clauses.push('s.district_id = $' + (params.length + 1)); params.push(district_id); }

  const rows = await all(`
    SELECT ${VISITE_LIST}
    FROM visite v
    LEFT JOIN professionnel p ON p.id = v.professionnel_id
    LEFT JOIN specialite sp ON sp.id = p.specialite_id
    LEFT JOIN structure s ON s.id = v.structure_id
    LEFT JOIN district d ON d.id = s.district_id
    LEFT JOIN region r ON r.id = s.region_id
    LEFT JOIN users u ON u.id = v.user_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY v.date DESC, v.id DESC`, params);
  return res.json(rows);
});

router.post('/visites', requireRole('delegue', 'manager', 'admin'), requireAboWrite, async (req, res) => {
  const { professionnel_id, date, produits, resultat, compte_rendu, prochaine_visite, geo, docs } = req.body || {};
  if (!professionnel_id || !date) return res.status(400).json({ error: 'professionnel_id et date requis' });

  const ps = await get('SELECT id, structure_id FROM professionnel WHERE id = $1 AND laboratoire_id = $2',
    [professionnel_id, req.user.laboratoire_id]);
  if (!ps) return res.status(404).json({ error: 'Professionnel introuvable' });

  const r = await run(
    `INSERT INTO visite (laboratoire_id, user_id, professionnel_id, structure_id, date, produits, resultat, compte_rendu, prochaine_visite, geo, statut, docs)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'brouillon',$11)`,
    [req.user.laboratoire_id, req.user.id, professionnel_id, ps.structure_id, date,
      JSON.stringify(produits || []), resultat || '', compte_rendu || '', prochaine_visite || '', geo || '',
      JSON.stringify((docs || []).map((d) => ({ nom: d.nom, type: d.type || 'application/octet-stream', data: d.data })))],
  );
  return res.status(201).json({ id: lastInsertId(r) });
});

router.get('/visites/:id', async (req, res) => {
  const v = await scopeVisite(req, req.params.id);
  if (!v) return res.status(404).json({ error: 'Visite introuvable' });

  const produits = JSON.parse(v.produits || '[]');
  const prods = produits.length
    ? await all(`SELECT id, nom, dci FROM produit WHERE id IN (${produits.map((_, i) => ph(i + 1)).join(',')})`,
        produits.map((p) => p.produit_id))
    : [];
  const docs = JSON.parse(v.docs || '[]');

  return res.json({
    ...v,
    produits: produits.map((p) => ({ ...p, nom: prods.find((x) => x.id === p.produit_id)?.nom || '' })),
    docs: docs.map((d) => ({ nom: d.nom, type: d.type })),
  });
});

// brouillon → soumis (auteur uniquement)
router.post('/visites/:id/submit', requireRole('delegue', 'manager', 'admin'), requireAboWrite, async (req, res) => {
  const v = await get('SELECT id, statut, user_id FROM visite WHERE id = $1 AND laboratoire_id = $2',
    [req.params.id, req.user.laboratoire_id]);
  if (!v) return res.status(404).json({ error: 'Visite introuvable' });
  if (v.statut !== 'brouillon') return res.status(400).json({ error: 'Seul un brouillon peut être soumis' });
  if (req.user.role === 'delegue' && v.user_id !== req.user.id) {
    return res.status(403).json({ error: 'Vous ne pouvez soumettre que vos propres visites' });
  }
  await run('UPDATE visite SET statut = $1 WHERE id = $2', ['soumis', req.params.id]);
  return res.json({ ok: true });
});

// soumis → valide (manager / admin / laboratoire)
router.post('/visites/:id/validate', requireRole('manager', 'admin', 'laboratoire'), async (req, res) => {
  const v = await get('SELECT id, statut FROM visite WHERE id = $1 AND laboratoire_id = $2',
    [req.params.id, req.user.laboratoire_id]);
  if (!v) return res.status(404).json({ error: 'Visite introuvable' });
  if (v.statut !== 'soumis') return res.status(400).json({ error: 'Seule une visite soumise peut être validée' });
  await run('UPDATE visite SET statut = $1 WHERE id = $2', ['valide', req.params.id]);
  return res.json({ ok: true });
});

// soumis → refusé (motif obligatoire)
router.post('/visites/:id/refuse', requireRole('manager', 'admin', 'laboratoire'), async (req, res) => {
  const { motif } = req.body || {};
  if (!motif) return res.status(400).json({ error: 'motif requis pour refuser' });
  const v = await get('SELECT id, statut FROM visite WHERE id = $1 AND laboratoire_id = $2',
    [req.params.id, req.user.laboratoire_id]);
  if (!v) return res.status(404).json({ error: 'Visite introuvable' });
  if (v.statut !== 'soumis') return res.status(400).json({ error: 'Seule une visite soumise peut être refusée' });
  await run('UPDATE visite SET statut = $1, motif_refus = $2 WHERE id = $3', ['refuse', motif, req.params.id]);
  return res.json({ ok: true });
});

// PDF du CRV
router.get('/visites/:id/pdf', async (req, res) => {
  const v = await scopeVisite(req, req.params.id);
  if (!v) return res.status(404).json({ error: 'Visite introuvable' });

  const produits = JSON.parse(v.produits || '[]');
  const prods = produits.length
    ? await all(`SELECT id, nom, dci FROM produit WHERE id IN (${produits.map((_, i) => ph(i + 1)).join(',')})`,
        produits.map((p) => p.produit_id))
    : [];
  const labo = await get('SELECT nom, agrement_arp FROM laboratoire WHERE id = $1', [req.user.laboratoire_id]);

  const { buffer, filename } = await crvPdf({
    visite: v,
    produits: produits.map((p) => ({ ...p, nom: prods.find((x) => x.id === p.produit_id)?.nom || '' })),
    labo,
  });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(buffer);
});

// Pièce jointe (base64 stockée en base) — téléchargement inline
router.get('/visites/:id/doc/:n', async (req, res) => {
  const v = await scopeVisite(req, req.params.id);
  if (!v) return res.status(404).json({ error: 'Visite introuvable' });
  const docs = JSON.parse(v.docs || '[]');
  const doc = docs[Number(req.params.n)];
  if (!doc || !doc.data) return res.status(404).json({ error: 'Document introuvable' });
  const buf = Buffer.from(doc.data, 'base64');
  res.setHeader('Content-Type', doc.type || 'application/octet-stream');
  res.setHeader('Content-Disposition', `inline; filename="${doc.nom || 'document'}"`);
  return res.send(buf);
});

export default router;
