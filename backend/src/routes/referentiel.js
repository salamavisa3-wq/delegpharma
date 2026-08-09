// Référentiel : géographie sanitaire + structures + professionnels.
// Règle zone→PS : le professionnel porte structure_id ; un filtre par zone passe
// TOUJOURS par la structure (region_id/district_id sur structure), jamais par un
// champ zone sur le professionnel. C'est le bug WP corrigé — ne pas le réintroduire.
import { Router } from 'express';
import { all, get, run, lastInsertId } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

// --- Géographie (multi-pays : pays > région > district) ---
router.get('/regions', async (req, res) => {
  const rows = await all(`
    SELECT r.id, r.nom,
      (SELECT COUNT(*) FROM district d WHERE d.region_id = r.id) AS districts
    FROM region r ORDER BY r.nom`);
  return res.json(rows);
});

router.get('/districts', async (req, res) => {
  const { region_id } = req.query;
  if (!region_id) return res.status(400).json({ error: 'region_id requis' });
  const rows = await all('SELECT id, nom FROM district WHERE region_id = $1 ORDER BY nom', [region_id]);
  return res.json(rows);
});

// Références du formulaire CRV / fiche PS
router.get('/catalog', async (req, res) => {
  const [types, specialites, produits] = await Promise.all([
    all('SELECT * FROM type_structure ORDER BY nom'),
    all('SELECT * FROM specialite ORDER BY nom'),
    all('SELECT id, nom, dci, presentation, agrement_arp FROM produit WHERE laboratoire_id = $2 ORDER BY nom',
      [req.user.laboratoire_id]),
  ]);
  return res.json({ types, specialites, produits });
});

// --- Structures (scope tenant) ---
router.get('/structures', async (req, res) => {
  const rows = await all(`
    SELECT s.id, s.localite, s.telephone, s.geo,
           t.id AS type_structure_id, t.nom AS type,
           r.id AS region_id, r.nom AS region,
           d.id AS district_id, d.nom AS district
    FROM structure s
    LEFT JOIN type_structure t ON t.id = s.type_structure_id
    LEFT JOIN region r ON r.id = s.region_id
    LEFT JOIN district d ON d.id = s.district_id
    WHERE s.laboratoire_id = $1
    ORDER BY r.nom, d.nom, s.id`, [req.user.laboratoire_id]);
  return res.json(rows);
});

router.post('/structures', requireRole('manager', 'admin', 'laboratoire'), async (req, res) => {
  const { type_structure_id, region_id, district_id, localite, telephone } = req.body || {};
  if (!type_structure_id || !region_id || !district_id) {
    return res.status(400).json({ error: 'type_structure_id, region_id et district_id requis' });
  }
  const r = await run(
    'INSERT INTO structure (laboratoire_id, type_structure_id, region_id, district_id, localite, telephone) VALUES ($1,$2,$3,$4,$5,$6)',
    [req.user.laboratoire_id, type_structure_id, region_id, district_id, localite || '', telephone || ''],
  );
  return res.status(201).json({ id: lastInsertId(r) });
});

router.delete('/structures/:id', requireRole('manager', 'admin'), async (req, res) => {
  await run('DELETE FROM structure WHERE id = $1 AND laboratoire_id = $2', [req.params.id, req.user.laboratoire_id]);
  return res.json({ ok: true });
});

// --- Professionnels ---
router.get('/professionnels', async (req, res) => {
  const { region_id, district_id, specialite_id, potentiel, q } = req.query;
  const clauses = ['p.laboratoire_id = $1'];
  const params = [req.user.laboratoire_id];
  if (region_id) { clauses.push('s.region_id = $' + (params.length + 1)); params.push(Number(region_id)); }
  if (district_id) { clauses.push('s.district_id = $' + (params.length + 1)); params.push(Number(district_id)); }
  if (specialite_id) { clauses.push('p.specialite_id = $' + (params.length + 1)); params.push(Number(specialite_id)); }
  if (potentiel) { clauses.push('p.potentiel = $' + (params.length + 1)); params.push(potentiel); }
  if (q) { clauses.push('p.nom LIKE $' + (params.length + 1)); params.push(`%${q}%`); }

  const rows = await all(`
    SELECT p.id, p.nom, p.potentiel, p.telephone,
           p.specialite_id, sp.nom AS specialite,
           s.id AS structure_id, s.localite AS structure,
           r.id AS region_id, r.nom AS region,
           d.id AS district_id, d.nom AS district
    FROM professionnel p
    LEFT JOIN specialite sp ON sp.id = p.specialite_id
    LEFT JOIN structure s ON s.id = p.structure_id
    LEFT JOIN region r ON r.id = s.region_id
    LEFT JOIN district d ON d.id = s.district_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY r.nom, d.nom, p.nom`, params);
  return res.json(rows);
});

router.get('/professionnels/:id', async (req, res) => {
  const row = await get(`
    SELECT p.id, p.nom, p.potentiel, p.telephone,
           p.specialite_id, sp.nom AS specialite,
           p.structure_id, s.localite AS structure, s.telephone AS structure_telephone,
           s.type_structure_id, t.nom AS type,
           r.id AS region_id, r.nom AS region,
           d.id AS district_id, d.nom AS district
    FROM professionnel p
    LEFT JOIN specialite sp ON sp.id = p.specialite_id
    LEFT JOIN structure s ON s.id = p.structure_id
    LEFT JOIN type_structure t ON t.id = s.type_structure_id
    LEFT JOIN region r ON r.id = s.region_id
    LEFT JOIN district d ON d.id = s.district_id
    WHERE p.id = $1 AND p.laboratoire_id = $2`, [req.params.id, req.user.laboratoire_id]);
  if (!row) return res.status(404).json({ error: 'Professionnel introuvable' });
  return res.json(row);
});

router.post('/professionnels', requireRole('delegue', 'manager', 'admin'), async (req, res) => {
  const { nom, structure_id, specialite_id, potentiel, telephone } = req.body || {};
  if (!nom || !structure_id) return res.status(400).json({ error: 'nom et structure_id requis' });
  const s = await get('SELECT id FROM structure WHERE id = $1 AND laboratoire_id = $2', [structure_id, req.user.laboratoire_id]);
  if (!s) return res.status(400).json({ error: 'Structure inconnue pour ce laboratoire' });
  const r = await run(
    'INSERT INTO professionnel (laboratoire_id, nom, structure_id, specialite_id, potentiel, telephone) VALUES ($1,$2,$3,$4,$5,$6)',
    [req.user.laboratoire_id, nom, structure_id, specialite_id || null, potentiel || 'B', telephone || ''],
  );
  return res.status(201).json({ id: lastInsertId(r) });
});

router.put('/professionnels/:id', requireRole('delegue', 'manager', 'admin'), async (req, res) => {
  const cur = await get('SELECT * FROM professionnel WHERE id = $1 AND laboratoire_id = $2', [req.params.id, req.user.laboratoire_id]);
  if (!cur) return res.status(404).json({ error: 'Professionnel introuvable' });
  const b = req.body || {};
  await run(
    'UPDATE professionnel SET nom = $1, structure_id = $2, specialite_id = $3, potentiel = $4, telephone = $5 WHERE id = $6',
    [b.nom ?? cur.nom, b.structure_id ?? cur.structure_id, b.specialite_id ?? cur.specialite_id,
      b.potentiel ?? cur.potentiel, b.telephone ?? cur.telephone, req.params.id],
  );
  return res.json({ ok: true });
});

router.delete('/professionnels/:id', requireRole('manager', 'admin'), async (req, res) => {
  await run('DELETE FROM professionnel WHERE id = $1 AND laboratoire_id = $2', [req.params.id, req.user.laboratoire_id]);
  return res.json({ ok: true });
});

export default router;
