// Messagerie interne labo↔délégué (spec §2.2) : messages individuels (to_user_id)
// et diffusions de laboratoire (to_user_id NULL → vus par toute l'équipe du tenant).
import { Router } from 'express';
import { all, get, run, lastInsertId } from '../db.js';
import { requireAuth, requireRole } from '../auth.js';

const router = Router();
router.use(requireAuth);

router.get('/notifications', async (req, res) => {
  const rows = await all(`
    SELECT n.*, u.nom AS from_nom
    FROM notification n
    LEFT JOIN users u ON u.id = n.from_user_id
    WHERE n.to_user_id = $1 OR (n.to_user_id IS NULL AND n.laboratoire_id = $2)
    ORDER BY n.id DESC LIMIT 100`, [req.user.id, req.user.laboratoire_id]);
  return res.json(rows);
});

router.get('/notifications/non-lues', async (req, res) => {
  const row = await get(
    `SELECT COUNT(*) AS n FROM notification
     WHERE (to_user_id = $1 OR (to_user_id IS NULL AND laboratoire_id = $2)) AND lu = 0`,
    [req.user.id, req.user.laboratoire_id]);
  return res.json({ non_lues: row.n });
});

// Envoi : diffusion labo (to_user_id absent) ou message à un utilisateur du tenant.
router.post('/notifications', requireRole('manager', 'admin', 'laboratoire'), async (req, res) => {
  const { to_user_id, message } = req.body || {};
  if (!message || !String(message).trim()) return res.status(400).json({ error: 'message requis' });
  if (to_user_id) {
    const u = await get('SELECT id FROM users WHERE id = $1 AND laboratoire_id = $2', [to_user_id, req.user.laboratoire_id]);
    if (!u) return res.status(400).json({ error: 'Destinataire inconnu pour ce laboratoire' });
  }
  const r = await run(
    'INSERT INTO notification (laboratoire_id, from_user_id, to_user_id, message, lu) VALUES ($1,$2,$3,$4,0)',
    [req.user.laboratoire_id, req.user.id, to_user_id || null, String(message).trim()]);
  return res.status(201).json({ id: lastInsertId(r) });
});

router.post('/notifications/:id/lu', async (req, res) => {
  await run(
    `UPDATE notification SET lu = 1
     WHERE id = $1 AND (to_user_id = $2 OR (to_user_id IS NULL AND laboratoire_id = $3))`,
    [req.params.id, req.user.id, req.user.laboratoire_id]);
  return res.json({ ok: true });
});

export default router;
