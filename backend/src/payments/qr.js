// Paiement manuel par QR Wave / Orange Money.
// Aucun appel API externe : l'utilisateur scanne le QR affiché, effectue le transfert
// depuis son téléphone, puis la transaction est validée manuellement par un admin/plateforme.
// Le provider retourne une reference sans redirect_url ; le frontend affiche les QR
// et les instructions de paiement (montant + référence à communiquer).

const base = () => process.env.APP_BASE_URL || 'https://app.delegpharma.com';

export const qr = {
  async createPayment({ reference, montant, description }) {
    return {
      redirect_url: null,
      provider: 'qr',
      reference,
      montant,
      description,
      // Indications affichées par le frontend si besoin.
      instructions: `Scannez le QR Wave ou QR OM depuis votre téléphone, effectuez le transfert de ${montant} FCFA, et indiquez la référence ${reference} dans la communication.`,
      qr_wave_url: `${base()}/assets/qr-wave.jpg`,
      qr_om_url: `${base()}/assets/qr-om.jpg`,
    };
  },

  async verify() {
    // La confirmation QR est manuelle (admin/plateforme), jamais automatique.
    return { paid: false, status: 'QR_MANUEL' };
  },
};
