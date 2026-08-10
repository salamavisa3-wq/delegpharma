// Mode démo (défaut) : aucun appel réseau, aucun argent réel.
// La confirmation est faite par un rôle habilité via POST /api/abonnements/demo-confirmer
// (validation admin — spec §3.1 « en l'absence de paiement, l'inscription reste en attente »).
export const demo = {
  async createPayment({ reference }) {
    return { redirect_url: null, demo: true, reference, provider: 'demo' };
  },
  async verify() {
    return { paid: false, status: 'DEMO' };
  },
};
