// Admin plateforme (spec §2.4 / §3.3) : tableau de bord consolidé multi-laboratoires
// + revenus globaux. Le détail des revenus (par formule / évolution) est dans
// GET /api/revenus (scope 1=1 pour le rôle plateforme).
import { Router } from 'express';
import { all, get } from '../db.js';

const router = Router();
// Garde auth+rôle au montage (server.js : /api/plateforme, requireRole('plateforme')) —
// pas de router.use ici : un router monté sur /api gate toute requête qui lui tombe dessus.

router.get('/dashboard', async (req, res) => {
  const [laboratoires, inscParFormule, totaux] = await Promise.all([
    all(`SELECT l.id, l.nom,
           (SELECT COUNT(*) FROM users u WHERE u.laboratoire_id = l.id) AS n_users,
           (SELECT COUNT(*) FROM abonnement a JOIN users u ON u.id = a.user_id
             WHERE u.laboratoire_id = l.id AND a.statut IN ('actif','arrive_expiration')) AS n_abonnes
         FROM laboratoire l ORDER BY l.nom`),
    all(`SELECT f.nom, COUNT(*) AS n
         FROM abonnement a LEFT JOIN formule f ON f.id = a.formule_id
         WHERE a.statut != 'en_attente' GROUP BY f.nom ORDER BY f.nom`),
    get(`SELECT
      (SELECT COUNT(*) FROM laboratoire) AS n_laboratoires,
      (SELECT COUNT(*) FROM users) AS n_users,
      (SELECT COUNT(*) FROM users WHERE role='delegue') AS n_delegues,
      (SELECT COUNT(*) FROM abonnement WHERE statut IN ('actif','arrive_expiration')) AS n_abonnes,
      (SELECT COALESCE(SUM(montant),0) FROM transaction_paiement WHERE statut='reussi') AS ca_total`),
  ]);
  return res.json({ laboratoires, inscParFormule, totaux });
});

export default router;
