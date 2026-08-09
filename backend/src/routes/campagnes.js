// Campagnes : objectifs ARP + couverture (visites soumises/validées / objectif).
import { Router } from 'express';
import { all, get, run, lastInsertId } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

const COVERAGE = `
  SELECT c.id, c.nom, c.agrement_arp, c.debut, c.fin, c.objectif, c.statut,
         pr.nom AS produit, r.nom AS region, d.nom AS district,
         (SELECT COUNT(*) FROM visite v
           WHERE v.laboratoire_id = c.laboratoire_id AND v.produits LIKE '%"produit_id":' || pr.id || ',%'
             AND v.statut = 'soumis') AS soumises,
         (SELECT COUNT(*) FROM visite v
           WHERE v.laboratoire_id = c.laboratoire_id AND v.produits LIKE '%"produit_id":' || pr.id || ',%'
             AND v.statut = 'valide') AS validees
  FROM campagne c
  LEFT JOIN produit pr ON pr.id = c.produit_id
  LEFT JOIN region r ON r.id = c.region_id
  LEFT JOIN district d ON d.id = c.district_id
  WHERE c.laboratoire_id = ?
  ORDER BY c.debut DESC`;

router.get('/campagnes', async (req, res) => {
  const rows = await all(COVERAGE, [req.user.laboratoire_id]);
  return res.json(rows.map((c) => ({ ...c, taux: c.objectif ? Math.round((100 * c.validees) / c.objectif) : 0 })));
});

router.post('/campagnes', requireRole('manager', 'admin', 'laboratoire'), async (req, res) => {
  const { nom, produit_id, agrement_arp, debut, fin, objectif, region_id, district_id } = req.body || {};
  if (!nom || !produit_id) return res.status(400).json({ error: 'nom et produit_id requis' });
  const r = await run(
    `INSERT INTO campagne (laboratoire_id, produit_id, agrement_arp, debut, fin, objectif, statut, region_id, district_id)
     VALUES (?,?,?,?,?,?,'active',?,?)`,
    [req.user.laboratoire_id, produit_id, agrement_arp || '', debut || '', fin || '', objectif || 0,
      region_id || null, district_id || null],
  );
  return res.status(201).json({ id: lastInsertId(r) });
});

router.put('/campagnes/:id', requireRole('manager', 'admin', 'laboratoire'), async (req, res) => {
  const cur = await get('SELECT * FROM campagne WHERE id = ? AND laboratoire_id = ?',
    [req.params.id, req.user.laboratoire_id]);
  if (!cur) return res.status(404).json({ error: 'Campagne introuvable' });
  const b = req.body || {};
  await run(
    `UPDATE campagne SET nom=?, produit_id=?, agrement_arp=?, debut=?, fin=?, objectif=?, statut=?, region_id=?, district_id=?
     WHERE id = ?`,
    [b.nom ?? cur.nom, b.produit_id ?? cur.produit_id, b.agrement_arp ?? cur.agrement_arp,
      b.debut ?? cur.debut, b.fin ?? cur.fin, b.objectif ?? cur.objectif, b.statut ?? cur.statut,
      b.region_id ?? cur.region_id, b.district_id ?? cur.district_id, req.params.id],
  );
  return res.json({ ok: true });
});

router.delete('/campagnes/:id', requireRole('manager', 'admin'), async (req, res) => {
  await run('DELETE FROM campagne WHERE id = ? AND laboratoire_id = ?', [req.params.id, req.user.laboratoire_id]);
  return res.json({ ok: true });
});

export default router;
