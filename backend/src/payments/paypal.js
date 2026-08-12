// PayPal Orders API v2 — carte Visa/Mastercard ou compte PayPal, en EUR.
// PayPal ne supporte pas le XOF → conversion FCFA→EUR au taux fixe UEMOA 655,957
// (5 000 FCFA ≈ 7,62 € ; 10 000 ≈ 15,24 € ; 15 000 ≈ 22,87 €).
// Clés : PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET (developer.paypal.com, app REST).
// PAYPAL_SANDBOX=true (défaut) → api-m.sandbox.paypal.com ; false → api-m.paypal.com.
// Flux : createPayment → redirection vers le lien « approve » ; au retour, le SPA
// appelle POST /api/abonnements/paypal-capture avec l'order_id → capture().
const XOF_PER_EUR = 655.957;
const base = () => (process.env.PAYPAL_SANDBOX === 'false' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
const clientId = () => process.env.PAYPAL_CLIENT_ID || '';
const clientSecret = () => process.env.PAYPAL_CLIENT_SECRET || '';
const appBase = () => process.env.APP_BASE_URL || 'http://localhost:10000';

let _token = null, _tokenAt = 0;

/** Token OAuth2 client_credentials (cache ~8 h ; PayPal expire à 9 h). */
async function accessToken() {
  if (_token && Date.now() - _tokenAt < 8 * 3600 * 1000) return _token;
  if (!clientId() || !clientSecret()) throw new Error('PayPal : PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET manquants');
  const resp = await fetch(`${base()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${clientId()}:${clientSecret()}`).toString('base64'),
    },
    body: 'grant_type=client_credentials',
  });
  const json = await resp.json().catch(() => ({}));
  if (!json.access_token) throw new Error(`PayPal : token échoué — ${JSON.stringify(json).slice(0, 200)}`);
  _token = json.access_token;
  _tokenAt = Date.now();
  return _token;
}

const eur = (xof) => (Number(xof) / XOF_PER_EUR).toFixed(2);

export const paypal = {
  async createPayment({ reference, montant, description, email, phone, customer }) {
    const token = await accessToken();
    const resp = await fetch(`${base()}/v2/checkout/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: reference,
          description: String(description || '').slice(0, 127),
          amount: { currency_code: 'EUR', value: eur(montant) },
        }],
        application_context: {
          brand_name: 'DelegPharma',
          return_url: `${appBase()}/#/abonnement?paypal=${reference}`,
          cancel_url: `${appBase()}/#/abonnement`,
          user_action: 'PAY_NOW',
          shipping_preference: 'NO_SHIPPING',
        },
      }),
    });
    const json = await resp.json().catch(() => ({}));
    const approve = (json.links || []).find((l) => l.rel === 'approve');
    if (!approve?.href) throw new Error(`PayPal : création commande échouée — ${JSON.stringify(json).slice(0, 300)}`);
    return { redirect_url: approve.href, provider: 'paypal', order_id: json.id };
  },

  /** Capture la commande approuvée (autorité : l'appel capture, pas le corps du webhook). */
  async capture({ order_id }) {
    const token = await accessToken();
    const resp = await fetch(`${base()}/v2/checkout/orders/${order_id}/capture`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: '{}',
    });
    const json = await resp.json().catch(() => ({}));
    // json.status = état de la commande (CREATED/APPROVED/COMPLETED) ; json.name = erreur PayPal
    // (ex. UNPROCESSABLE_ENTITY si la commande n'est pas encore approuvée) — remonté pour le débogage.
    const status = String(json.status || json.name || '').toUpperCase();
    const capture = json.purchase_units?.[0]?.payments?.captures?.[0];
    return {
      paid: status === 'COMPLETED' && capture?.status === 'COMPLETED',
      status,
      reference: json.purchase_units?.[0]?.reference_id || '',
      provider_ref: capture?.id || json.id || '',
    };
  },
};
