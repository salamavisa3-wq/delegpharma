// Adapter de paiement pluggable (spec §6.2) : PAY_MODE=demo|cinetpay.
//   demo    : paiement simulé, confirmé par l'admin plateforme (pattern SakeurImmo/PayTech).
//   cinetpay: agrégateur Mobile Money (Wave, Orange Money…), clés sandbox = CINETPAY_*.
// Le contrat expose createPayment / verify — un autre agrégateur (PayDunya, PayTech…)
// s'ajoute en créant un module du même contrat et en basculant PAY_MODE.
import { cinetpay } from './cinetpay.js';
import { demo } from './demo.js';

export const payMode = process.env.PAY_MODE || 'demo';
export const payment = payMode === 'cinetpay' ? cinetpay : demo;

/** Référence de transaction unique (idempotence §6.2). */
export function makeReference() {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `DP${Date.now()}${rand}`;
}
