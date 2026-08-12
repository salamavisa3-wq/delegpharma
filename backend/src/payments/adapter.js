// Adapter de paiement pluggable (spec §6.2) : PAY_MODE=demo|cinetpay|paypal.
//   demo    : paiement simulé, confirmé par l'admin plateforme (pattern SakeurImmo/PayTech).
//   cinetpay: agrégateur Mobile Money (Wave, Orange Money…) + carte Visa/Mastercard (channels=ALL).
//   paypal  : PayPal Orders API v2 (carte ou compte PayPal), EUR (conversion FCFA→EUR).
// Chaque module expose createPayment ; la confirmation est soit verify (webhook CinetPay),
// soit capture (retour PayPal). Un autre agrégateur s'ajoute en créant un module du même
// contrat et en l'enregistrant dans `providers`.
import { cinetpay } from './cinetpay.js';
import { paypal } from './paypal.js';
import { demo } from './demo.js';

export const payMode = process.env.PAY_MODE || 'demo';
export const providers = { cinetpay, paypal, demo };

/** Provider effectif pour un moyen donné. En mode demo, tout passe par demo (aucun appel réseau). */
export function resolveProvider(moyen) {
  if (payMode === 'demo') return { key: 'demo', provider: demo };
  const key = providers[moyen] ? moyen : payMode;
  return { key, provider: providers[key] || demo };
}

/** Provider par défaut (compat : inscription, qui n'a pas de sélecteur de moyen). */
export const payment = resolveProvider(payMode).provider;

/** Référence de transaction unique (idempotence §6.2). */
export function makeReference() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DP${Date.now()}${rand}`;
}
