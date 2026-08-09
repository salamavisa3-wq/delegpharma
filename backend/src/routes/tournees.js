// Tournées : planification d'une journée sur un district + checklist zone→PS.
import { Router } from 'express';
import { all, get, run, lastInsertId } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

// Checklist zone → professionnels du district (règle zone→PS : via la structure)
router.get('/districts/:id/professionnels', async (req, res) => {
  const rows = await all(`
    SELECT p.id, p.nom, p.potentiel, sp.nom AS specialite, s.localite AS structure
    FROM professionnel p
    LEFT JOIN specialite sp ON sp.id = p.specialite_id
    JOIN structure s ON s.id = p.structure_id
    WHERE p.laboratoire_id = $1 AND s.district_id = $2
    ORDER BY p.nom`, [req.user.laboratoire_id, req.params.id]);
  return res.json(rows);
});

router.get('/tournees', async (req, res) => {
  const { statut, user_id } = req.query;
  const clauses = ['t.laboratoire_id = $1'];
  const params = [req.user.laboratoire_id];
  if (req.user.role === 'delegue') { clauses.push('t.user_id = $1'); params.push(req.user.id); }
  if (statut) { clauses.push('t.statut = $1'); params.push(statut); }
  if (user_id) { clauses.push('t.user_id = $1'); params.push(user_id); }

  const rows = await all(`
    SELECT t.id, t.date, t.statut, t.ps_list,
           d.nom AS district, r.nom AS region, u.nom AS auteur
    FROM tournee t
    LEFT JOIN district d ON d.id = t.district_id
    LEFT JOIN region r ON r.id = d.region_id
    LEFT JOIN users u ON u.id = t.user_id
    WHERE ${clauses.join(' AND ')}
    ORDER BY t.date DESC, t.id DESC`, params);
  return res.json(rows);
});

router.post('/tournees', requireRole('delegue', 'manager', 'admin'), async (req, res) => {
  const { date, district_id, ps_list } = req.body || {};
  if (!date || !district_id) return res.status(400).json({ error: 'date et district_id requis' });
  const r = await run(
    'INSERT INTO tournee (laboratoire_id, user_id, date, district_id, ps_list, statut) VALUES ($1,$2,$3,$4,$5,$6)',
    [req.user.laboratoire_id, req.user.id, date, district_id, JSON.stringify(ps_list || []), 'planifiee'],
  );
  return res.status(201).json({ id: lastInsertId(r) });
});

router.post('/tournees/:id/faire', requireRole('delegue', 'manager', 'admin'), async (req, res) => {
  const t = await get('SELECT id, statut, user_id FROM tournee WHERE id = $1 AND laboratoire_id = $2',
    [req.params.id, req.user.laboratoire_id]);
  if (!t) return res.status(404).json({ error: 'Tournée introuvable' });
  if (req.user.role === 'delegue' && t.user_id !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });
  await run('UPDATE tournee SET statut = $1 WHERE id = $2', ['faite', req.params.id]);
  return res.json({ ok: true });
});

router.post('/tournees/:id/annuler', requireRole('delegue', 'manager', 'admin'), async (req, res) => {
  const t = await get('SELECT id, statut, user_id FROM tournee WHERE id = $1 AND laboratoire_id = $2',
    [req.params.id, req.user.laboratoire_id]);
  if (!t) return res.status(404).json({ error: 'Tournée introuvable' });
  if (req.user.role === 'delegue' && t.user_id !== req.user.id) return res.status(403).json({ error: 'Non autorisé' });
  await run('UPDATE tournee SET statut = $1 WHERE id = $2', ['annulee', req.params.id]);
  return res.json({ ok: true });
});

router.delete('/tournees/:id', requireRole('manager', 'admin'), async (req, res) => {
  await run('DELETE FROM tournee WHERE id = $1 AND laboratoire_id = $2', [req.params.id, req.user.laboratoire_id]);
  return res.json({ ok: true });
});

export default router;
