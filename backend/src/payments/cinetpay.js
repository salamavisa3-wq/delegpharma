// CinetPay v1 — agrégateur Mobile Money ouest-africain (Wave, Orange Money…), XOF.
// Clés sandbox : CINETPAY_APIKEY / CINETPAY_SITE_ID (dashboard CinetPay, mode test).
// Les endpoints et champs exacts sont confirmés depuis le dashboard marchand (sandbox) ;
// l'adapter encapsule le contrat pour ne rien laisser fuiter dans les routes.
const API = 'https://api.cinetpay.com/v1/';
const apikey = () => process.env.CINETPAY_APIKEY || '';
const siteId = () => process.env.CINETPAY_SITE_ID || '';
const base = () => process.env.APP_BASE_URL || 'http://localhost:10000';

const form = (obj) => new URLSearchParams(obj).toString();

export const cinetpay = {
  async createPayment({ reference, montant, description, email, phone }) {
    if (!apikey() || !siteId()) throw new Error('CinetPay : CINETPAY_APIKEY / CINETPAY_SITE_ID manquants');
    const resp = await fetch(`${API}?method=createPayment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({
        apikey: apikey(),
        site_id: siteId(),
        transaction_id: reference,
        amount: String(montant),
        currency: 'XOF',
        description,
        lang: 'fr',
        notify_url: `${base()}/api/webhooks/cinetpay`,
        return_url: `${base()}/#/abonnement`,
        custom: `dp:${reference}`,
        customer_email: email || '',
        customer_phone: phone || '',
        customer_name: description,
      }),
    });
    const json = await resp.json().catch(() => ({}));
    const data = json.data || {};
    const url = data.payment_url || data.url
      || (data.payment_token ? `https://www.cinetpay.com/${data.payment_token}` : '');
    if (!url) throw new Error(`CinetPay : création paiement échouée — ${JSON.stringify(json).slice(0, 300)}`);
    return { redirect_url: url, provider: 'cinetpay' };
  },

  async verify({ reference }) {
    if (!apikey() || !siteId()) throw new Error('CinetPay : clés manquantes');
    const resp = await fetch(`${API}?method=verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form({ apikey: apikey(), site_id: siteId(), transaction_id: reference }),
    });
    const json = await resp.json().catch(() => ({}));
    const status = String(json.data?.status || json.status || '').toUpperCase();
    return { paid: status === 'ACCEPTED', status };
  },
};
