import { Router } from 'express';
import { get, run, lastInsertId } from '../db.js';
import {
  signToken, setAuthCookie, clearAuthCookie, requireAuth, verifyPassword,
  hashPassword, publicUser, getSubscriptionState,
} from '../auth.js';
import { payment, makeReference, payMode } from '../payments/adapter.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'email et mot de passe requis' });

  const user = await get('SELECT * FROM users WHERE email = $1', [String(email).toLowerCase().trim()]);
  if (!user) return res.status(401).json({ error: 'Identifiants invalides' });

  const ok = await verifyPassword(user.password_hash, password);
  if (!ok) return res.status(401).json({ error: 'Identifiants invalides' });

  const labo = user.laboratoire_id
    ? await get('SELECT id, nom, agrement_arp FROM laboratoire WHERE id = $1', [user.laboratoire_id])
    : null;
  const token = signToken(user);
  setAuthCookie(res, token);
  return res.json({ user: publicUser(user), laboratoire: labo });
});

// Inscription publique délégué (spec §3.1) : choix laboratoire + formule →
// compte + abonnement en_attente + transaction + paiement, puis auto-login.
// formule_id OPTIONNEL : sans formule, création d'un compte gratuit (aucun
// abonnement → statut « aucun » → lecture seule). L'abonnement se prend ensuite
// via /abonnements/initier depuis le dashboard.
router.post('/inscription', async (req, res) => {
  const { nom, email, telephone, password, laboratoire_id, formule_id, adresse, ville, pays, code_postal } = req.body || {};
  if (!nom || !email || !password) return res.status(400).json({ error: 'nom, email et mot de passe requis' });
  if (!laboratoire_id) return res.status(400).json({ error: 'laboratoire_id requis' });

  const cleanEmail = String(email).toLowerCase().trim();
  const existing = await get('SELECT id FROM users WHERE email = $1', [cleanEmail]);
  if (existing) return res.status(409).json({ error: 'Un compte existe déjà avec cet email' });

  const labo = await get('SELECT id, nom, agrement_arp FROM laboratoire WHERE id = $1', [laboratoire_id]);
  if (!labo) return res.status(400).json({ error: 'Laboratoire inconnu' });
  let formule = null;
  if (formule_id) {
    formule = await get('SELECT * FROM formule WHERE id = $1', [formule_id]);
    if (!formule) return res.status(400).json({ error: 'Formule inconnue' });
  }

  const hash = await hashPassword(password);
  const r = await run(
    `INSERT INTO users (laboratoire_id, role, nom, email, telephone, adresse, ville, pays, code_postal, password_hash)
     VALUES ($1,'delegue',$2,$3,$4,$5,$6,$7,$8,$9)`,
    [laboratoire_id, nom, cleanEmail, telephone || '', adresse || '', ville || '', pays || 'SN', code_postal || '', hash]);
  const userId = lastInsertId(r);

  let aboId = null, reference = null, payResult = null, paymentError = null;
  if (formule) {
    reference = makeReference();
    const rAbo = await run(
      'INSERT INTO abonnement (user_id, formule_id, montant, statut, ref_transaction) VALUES ($1,$2,$3,$4,$5)',
      [userId, formule.id, formule.prix, 'en_attente', reference]);
    aboId = lastInsertId(rAbo);
    await run(
      'INSERT INTO transaction_paiement (abonnement_id, user_id, montant, moyen, statut, reference, provider) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [aboId, userId, formule.prix, 'cinetpay', 'en_attente', reference, payMode]);
    try {
      payResult = await payment.createPayment({
        reference, montant: formule.prix,
        description: `Abonnement ${formule.nom} — ${nom}`,
        email: cleanEmail, phone: telephone || '',
        customer: { nom, adresse, ville, pays, code_postal },
      });
    } catch (e) { paymentError = e.message; }
  }

  const user = { id: userId, laboratoire_id, role: 'delegue', nom, email: cleanEmail, telephone: telephone || '' };
  setAuthCookie(res, signToken(user));
  return res.status(201).json({
    user: publicUser(user), laboratoire: labo,
    abonnement_id: aboId, reference, payment: payResult, payment_error: paymentError, pay_mode: payMode,
    compte_gratuit: !formule,
  });
});

router.post('/logout', (req, res) => {
  clearAuthCookie(res);
  return res.json({ ok: true });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await get('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!user) return res.status(401).json({ error: 'Compte introuvable' });
  const labo = user.laboratoire_id
    ? await get('SELECT id, nom, agrement_arp FROM laboratoire WHERE id = $1', [user.laboratoire_id])
    : null;
  const abonnement = user.role === 'delegue' ? await getSubscriptionState(user) : { statut: 'n/a' };
  return res.json({ user: publicUser(user), laboratoire: labo, abonnement });
});

export default router;
