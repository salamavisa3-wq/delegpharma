// Module abonnements & monétisation (spec §3) :
//   tarifs publics, inscription via /api/auth/inscription, initiation paiement,
//   webhook CinetPay (vérification + idempotence), cycle de vie 30 j, revenus.
// PAY_MODE=demo → confirmation manuelle par un rôle habilité (demo-confirmer).
import { Router } from 'express';
import { all, get, run, lastInsertId, isPg } from '../db.js';
import { requireAuth, requireRole, getSubscriptionState } from '../auth.js';
import { payment, makeReference, payMode } from '../payments/adapter.js';
import { cinetpay } from '../payments/cinetpay.js';

const router = Router();

// --- Public : tarifs + laboratoires (inscription) ---
router.get('/tarifs', async (req, res) => {
  const rows = await all('SELECT id, nom, prix, duree_jours, fonctionnalites FROM formule ORDER BY prix');
  return res.json(rows.map((f) => ({ ...f, fonctionnalites: JSON.parse(f.fonctionnalites || '[]') })));
});

router.get('/laboratoires', async (req, res) => {
  const rows = await all('SELECT id, nom FROM laboratoire ORDER BY nom');
  return res.json(rows);
});

// --- Webhook CinetPay (PUBLIC : CinetPay poste sans cookie ; vérifié côté serveur — §6.2/§6.3) ---
router.post('/webhooks/cinetpay', async (req, res) => {
  const body = req.body || {};
  let reference = body.transaction_id || '';
  if (!reference && typeof body.cpm_custom === 'string') {
    reference = body.cpm_custom.startsWith('dp:') ? body.cpm_custom.slice(3) : '';
  }
  if (!reference) return res.status(400).json({ error: 'transaction inconnue' });
  const providerRef = String(body.cpm_trans_id || '');

  // Vérification cryptographique contre l'API CinetPay (jamais faire confiance au corps seul).
  try {
    const v = await cinetpay.verify({ reference });
    if (!v.paid) return res.status(200).json({ ok: false, status: v.status, message: 'paiement non confirmé' });
  } catch (e) {
    return res.status(502).json({ error: 'vérification CinetPay échouée' });
  }
  const r = await applyPaymentSuccess({ reference, providerRef });
  return res.json(r);
});

// --- Routes authentifiées ---
router.use(requireAuth);

/** Active un abonnement après confirmation du paiement (idempotent, §6.2). */
async function applyPaymentSuccess({ reference, providerRef }) {
  const tx = await get('SELECT * FROM transaction_paiement WHERE reference = $1', [reference]);
  if (!tx) return { ok: false, error: 'Transaction inconnue' };
  if (tx.statut === 'reussi') return { ok: true, idempotent: true };

  // Garde concurrente : ne marque que si encore en_attente (double webhook).
  const upd = await run(
    `UPDATE transaction_paiement SET statut = 'reussi', provider_ref = $1
     WHERE reference = $2 AND statut = 'en_attente'`, [providerRef || '', reference]);
  const changed = isPg() ? upd.rowCount : upd.changes;
  if (!changed) return { ok: true, idempotent: true };

  const abo = await get(
    `SELECT a.*, f.nom AS formule_nom, f.duree_jours
     FROM abonnement a LEFT JOIN formule f ON f.id = a.formule_id WHERE a.id = $1`, [tx.abonnement_id]);
  if (!abo) return { ok: false, error: 'Abonnement introuvable' };
  const user = await get('SELECT id, laboratoire_id FROM users WHERE id = $1', [abo.user_id]);

  const debut = new Date().toISOString().slice(0, 10);
  const fin = new Date(Date.now() + (abo.duree_jours || 30) * 86400000).toISOString().slice(0, 10);
  await run(`UPDATE abonnement SET statut='actif', date_debut=$1, date_expiration=$2, ref_transaction=$3 WHERE id=$4`,
    [debut, fin, reference, abo.id]);
  // Le paiement le plus récent fait foi (upgrade/downgrade §3.2)
  await run(`UPDATE abonnement SET statut='resilie' WHERE user_id=$1 AND id != $2 AND statut IN ('actif','arrive_expiration')`,
    [abo.user_id, abo.id]);
  // Notification d'activation
  await run('INSERT INTO notification (laboratoire_id, to_user_id, message) VALUES ($1,$2,$3)',
    [user?.laboratoire_id ?? null, abo.user_id, `Abonnement ${abo.formule_nom || ''} activé — valable 1 mois.`]).catch(() => {});

  return { ok: true, abonnement_id: abo.id };
}

/** Historique des transactions selon le rôle (délégué : les siennes ; labo/admin : son équipe ; plateforme : toutes). */
async function getTransactionHistory(user) {
  let where, params;
  if (user.role === 'plateforme') { where = '1=1'; params = []; }
  else if (user.role === 'delegue') { where = 't.user_id = $1'; params = [user.id]; }
  else { where = 'u.laboratoire_id = $1'; params = [user.laboratoire_id]; }
  return all(`
    SELECT t.id, t.montant, t.statut, t.reference, t.provider, t.provider_ref, t.created_at,
           u.nom AS user_nom, f.nom AS formule_nom, a.date_expiration
    FROM transaction_paiement t
    LEFT JOIN users u ON u.id = t.user_id
    LEFT JOIN abonnement a ON a.id = t.abonnement_id
    LEFT JOIN formule f ON f.id = a.formule_id
    WHERE ${where} ORDER BY t.id DESC LIMIT 100`, params);
}

router.get('/abonnements/mon', async (req, res) => {
  const state = await getSubscriptionState(req.user);
  const pending = req.user.role === 'delegue'
    ? await get(`SELECT a.*, f.nom AS formule_nom FROM abonnement a
                 LEFT JOIN formule f ON f.id = a.formule_id
                 WHERE a.user_id = $1 AND a.statut = 'en_attente' ORDER BY a.id DESC LIMIT 1`, [req.user.id])
    : null;
  return res.json({ abonnement: state, en_attente: pending, historique: await getTransactionHistory(req.user) });
});

/** Initier une souscription/renouvellement : abonnement en_attente + transaction + paiement. */
router.post('/abonnements/initier', requireRole('delegue', 'manager', 'admin', 'laboratoire'), async (req, res) => {
  const { formule_id } = req.body || {};
  if (!formule_id) return res.status(400).json({ error: 'formule_id requis' });
  const formule = await get('SELECT * FROM formule WHERE id = $1', [formule_id]);
  if (!formule) return res.status(400).json({ error: 'Formule inconnue' });
  const user = await get('SELECT nom, email, telephone FROM users WHERE id = $1', [req.user.id]);

  const reference = makeReference();
  const rAbo = await run(
    'INSERT INTO abonnement (user_id, formule_id, montant, statut, ref_transaction) VALUES ($1,$2,$3,$4,$5)',
    [req.user.id, formule.id, formule.prix, 'en_attente', reference]);
  const aboId = lastInsertId(rAbo);
  await run(
    'INSERT INTO transaction_paiement (abonnement_id, user_id, montant, moyen, statut, reference, provider) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [aboId, req.user.id, formule.prix, 'cinetpay', 'en_attente', reference, payMode]);

  let payResult = null, paymentError = null;
  try {
    payResult = await payment.createPayment({
      reference, montant: formule.prix,
      description: `Abonnement ${formule.nom} — ${user.nom}`,
      email: user.email, phone: user.telephone,
    });
  } catch (e) { paymentError = e.message; }

  return res.status(201).json({ abonnement_id: aboId, reference, payment: payResult, payment_error: paymentError, pay_mode: payMode });
});

/** Relancer le paiement d'un abonnement resté en attente (ex. paiement abandonné). */
router.post('/abonnements/payer', requireRole('delegue'), async (req, res) => {
  const { abonnement_id } = req.body || {};
  const abo = await get('SELECT * FROM abonnement WHERE id = $1 AND user_id = $2', [abonnement_id, req.user.id]);
  if (!abo) return res.status(404).json({ error: 'Abonnement introuvable' });
  if (abo.statut !== 'en_attente') return res.status(400).json({ error: "Cet abonnement n'est plus en attente de paiement" });
  const user = await get('SELECT nom, email, telephone FROM users WHERE id = $1', [req.user.id]);
  const formule = await get('SELECT * FROM formule WHERE id = $1', [abo.formule_id]);

  const reference = makeReference();
  await run(
    'INSERT INTO transaction_paiement (abonnement_id, user_id, montant, moyen, statut, reference, provider) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [abo.id, req.user.id, abo.montant, 'cinetpay', 'en_attente', reference, payMode]);
  let payResult = null, paymentError = null;
  try {
    payResult = await payment.createPayment({
      reference, montant: abo.montant,
      description: `Abonnement ${formule?.nom || ''} — ${user.nom}`,
      email: user.email, phone: user.telephone,
    });
  } catch (e) { paymentError = e.message; }
  return res.json({ abonnement_id: abo.id, reference, payment: payResult, payment_error: paymentError });
});

/** Mode démo : validation manuelle d'un paiement simulé (spéc §3.1, §6.2). */
router.post('/abonnements/demo-confirmer', requireRole('plateforme', 'laboratoire', 'admin'), async (req, res) => {
  const { reference } = req.body || {};
  if (!reference) return res.status(400).json({ error: 'reference requise' });
  const r = await applyPaymentSuccess({ reference, providerRef: 'demo-admin' });
  if (!r.ok) return res.status(404).json(r);
  return res.json(r);
});

router.get('/abonnements/transactions', async (req, res) => res.json(await getTransactionHistory(req.user)));

/** Suivi des revenus (§3.3) : par formule, CA cumulé, évolution, abonnements par statut. */
router.get('/revenus', requireRole('laboratoire', 'admin', 'plateforme'), async (req, res) => {
  const scope = req.user.role === 'plateforme' ? '1=1' : 'u.laboratoire_id = $1';
  const params = req.user.role === 'plateforme' ? [] : [req.user.laboratoire_id];
  const [byFormule, evolution, parStatut, total] = await Promise.all([
    all(`SELECT f.nom AS formule, COUNT(*) AS n, COALESCE(SUM(t.montant),0) AS ca
         FROM transaction_paiement t
         LEFT JOIN users u ON u.id = t.user_id
         LEFT JOIN abonnement a ON a.id = t.abonnement_id
         LEFT JOIN formule f ON f.id = a.formule_id
         WHERE t.statut = 'reussi' AND ${scope} GROUP BY f.nom ORDER BY f.nom`, params),
    all(`SELECT substr(t.created_at,1,7) AS mois, COUNT(*) AS n, COALESCE(SUM(t.montant),0) AS ca
         FROM transaction_paiement t LEFT JOIN users u ON u.id = t.user_id
         WHERE t.statut = 'reussi' AND ${scope} GROUP BY mois ORDER BY mois`, params),
    all(`SELECT a.statut, COUNT(*) AS n
         FROM abonnement a LEFT JOIN users u ON u.id = a.user_id
         WHERE ${scope} GROUP BY a.statut ORDER BY a.statut`, params),
    get(`SELECT COUNT(*) AS n, COALESCE(SUM(t.montant),0) AS ca
         FROM transaction_paiement t LEFT JOIN users u ON u.id = t.user_id
         WHERE t.statut = 'reussi' AND ${scope}`, params),
  ]);
  return res.json({ byFormule, evolution, parStatut, total });
});

export default router;
