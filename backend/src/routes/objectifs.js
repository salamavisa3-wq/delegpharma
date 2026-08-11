// Objectifs (spec §2.3) : produit phare par zone / par délégué, sur une période.
// Progression = quantité du produit issue des visites VALIDÉES dans le scope (période, délégué, zone).
import { Router } from 'express';
import { all, get, run, lastInsertId } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

/** Réalisé d'un objectif : somme des quantités du produit (ou nb de visites si sans produit) sur les visites validées du scope. */
async function progression(obj) {
  const clauses = ['v.laboratoire_id = $1', "v.statut = 'valide'", 'v.date >= $2', 'v.date <= $3'];
  const params = [obj.laboratoire_id, obj.debut, obj.fin];
  if (obj.user_id) { clauses.push(`v.user_id = $${params.length + 1}`); params.push(obj.user_id); }
  if (obj.region_id) { clauses.push(`s.region_id = $${params.length + 1}`); params.push(obj.region_id); }
  if (obj.district_id) { clauses.push(`s.district_id = $${params.length + 1}`); params.push(obj.district_id); }
  const rows = await all(
    `SELECT v.produits FROM visite v LEFT JOIN structure s ON s.id = v.structure_id
     WHERE ${clauses.join(' AND ')}`, params);
  if (!obj.produit_id) return rows.length;
  let realise = 0;
  for (const row of rows) {
    for (const p of JSON.parse(row.produits || '[]')) {
      if (Number(p.produit_id) === Number(obj.produit_id)) realise += Number(p.qty ?? p.quantite ?? 0);
    }
  }
  return realise;
}

const BASE = `
  SELECT o.*, c.nom AS campagne_nom, p.nom AS produit_nom,
         u.nom AS delegue_nom, rg.nom AS region_nom, d.nom AS district_nom
  FROM objectif o
  LEFT JOIN campagne c ON c.id = o.campagne_id
  LEFT JOIN produit p ON p.id = o.produit_id
  LEFT JOIN users u ON u.id = o.user_id
  LEFT JOIN region rg ON rg.id = o.region_id
  LEFT JOIN district d ON d.id = o.district_id`;

router.get('/objectifs', async (req, res) => {
  const clauses = ['o.laboratoire_id = $1'];
  const params = [req.user.laboratoire_id];
  if (req.user.role === 'delegue') { clauses.push('o.user_id = $2'); params.push(req.user.id); }
  const rows = await all(`${BASE} WHERE ${clauses.join(' AND ')} ORDER BY o.debut DESC, o.id DESC`, params);
  const out = [];
  for (const o of rows) {
    out.push({ ...o, objectif: Number(o.objectif), realise: await progression(o) });
  }
  return res.json(out);
});

router.post('/objectifs', requireRole('manager', 'admin', 'laboratoire'), async (req, res) => {
  const { campagne_id, produit_id, user_id, region_id, district_id, objectif, debut, fin } = req.body || {};
  if (!objectif || !debut || !fin) return res.status(400).json({ error: 'objectif, debut et fin requis' });
  if (district_id && region_id) {
    const d = await get('SELECT id FROM district WHERE id = $1 AND region_id = $2', [district_id, region_id]);
    if (!d) return res.status(400).json({ error: 'district_id incompatible avec region_id' });
  }
  if (user_id) {
    const u = await get('SELECT id FROM users WHERE id = $1 AND laboratoire_id = $2', [user_id, req.user.laboratoire_id]);
    if (!u) return res.status(400).json({ error: 'Délégué inconnu pour ce laboratoire' });
  }
  const r = await run(
    `INSERT INTO objectif (laboratoire_id, campagne_id, produit_id, user_id, region_id, district_id, objectif, debut, fin)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [req.user.laboratoire_id, campagne_id || null, produit_id || null, user_id || null,
      region_id || null, district_id || null, objectif, debut, fin]);
  return res.status(201).json({ id: lastInsertId(r) });
});

router.put('/objectifs/:id', requireRole('manager', 'admin', 'laboratoire'), async (req, res) => {
  const cur = await get('SELECT * FROM objectif WHERE id = $1 AND laboratoire_id = $2', [req.params.id, req.user.laboratoire_id]);
  if (!cur) return res.status(404).json({ error: 'Objectif introuvable' });
  const b = req.body || {};
  await run(
    `UPDATE objectif SET campagne_id=$1, produit_id=$2, user_id=$3, region_id=$4, district_id=$5,
       objectif=$6, debut=$7, fin=$8 WHERE id=$9`,
    [b.campagne_id ?? cur.campagne_id, b.produit_id ?? cur.produit_id, b.user_id ?? cur.user_id,
      b.region_id ?? cur.region_id, b.district_id ?? cur.district_id,
      b.objectif ?? cur.objectif, b.debut ?? cur.debut, b.fin ?? cur.fin, req.params.id]);
  return res.json({ ok: true });
});

router.delete('/objectifs/:id', requireRole('manager', 'admin'), async (req, res) => {
  await run('DELETE FROM objectif WHERE id = $1 AND laboratoire_id = $2', [req.params.id, req.user.laboratoire_id]);
  return res.json({ ok: true });
});

export default router;
