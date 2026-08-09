import { Router } from 'express';
import { get } from '../db.js';
import { signToken, setAuthCookie, clearAuthCookie, requireAuth, verifyPassword, publicUser } from '../auth.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email et mot de passe requis' });

  const user = await get('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase().trim()]);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });

  const labo = await get('SELECT id, nom, agrement_arp FROM laboratoire WHERE id = $1', [user.laboratoire_id]);
  const token = signToken(user);
  setAuthCookie(res, token);
  return res.json({ user: publicUser(user), laboratoire: labo });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!user) return res.status(401).json({ error: 'Compte introuvable' });
  const labo = await get('SELECT id, nom, agrement_arp FROM laboratoire WHERE id = $1', [user.laboratoire_id]);
  return res.json({ user: publicUser(user), laboratoire: labo });
});

export default router;
