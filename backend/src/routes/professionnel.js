// Rôle professionnel (spec §4) : lecture seule. Le PS voit l'historique des visites
// qui le concernent (comptes rendus, produits promus) sans pouvoir modifier quoi que ce soit.
import { Router } from 'express';
import { all, get } from '../db.js';

const router = Router();
// Garde auth+rôle au montage (server.js : /api/professionnel, requireRole('professionnel')) —
// pas de router.use ici : un router monté sur /api gate toute requête qui lui tombe dessus.

// req.user (JWT) ne porte pas professionnel_id → on hydrate depuis la base.
router.use(async (req, res, next) => {
  const user = await get('SELECT * FROM users WHERE id = $1', [req.user.id]);
  if (!user) return res.status(401).json({ error: 'Compte introuvable' });
  req.userFull = user;
  return next();
});

router.get('/visites', async (req, res) => {
  if (!req.userFull.professionnel_id) return res.json([]);
  const rows = await all(`
    SELECT v.id, v.date, v.resultat, v.compte_rendu, v.produits, v.statut, v.created_at,
           u.nom AS delegue, s.localite AS structure, r.nom AS region
    FROM visite v
    LEFT JOIN users u ON u.id = v.user_id
    LEFT JOIN structure s ON s.id = v.structure_id
    LEFT JOIN region r ON r.id = s.region_id
    WHERE v.professionnel_id = $1
    ORDER BY v.date DESC, v.id DESC LIMIT 200`, [req.userFull.professionnel_id]);
  return res.json(rows);
});

router.get('/synthese', async (req, res) => {
  if (!req.userFull.professionnel_id) return res.json({});
  const row = await get(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN statut='valide' THEN 1 ELSE 0 END) AS validees,
            MAX(date) AS derniere_visite
     FROM visite WHERE professionnel_id = $1`, [req.userFull.professionnel_id]);
  return res.json(row);
});

export default router;
