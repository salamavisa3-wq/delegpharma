// Dashboard par rôle — agrégations scopées tenant.
import { Router } from 'express';
import { all, get, isPg } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

// Fragments date portables SQLite/Postgres (date('now') est SQLite-only).
// v.date est TEXT ('YYYY-MM-DD') : le fragment pg doit produire du texte aussi,
// sinon text >= date → « operator does not exist ».
const TODAY = isPg() ? 'CURRENT_DATE::text' : "date('now')";
const WEEK_AGO = isPg() ? "(CURRENT_DATE - 7)::text" : "date('now','-7 days')";

const PAR_REGION = `
  SELECT r.nom AS region, COUNT(*) AS n
  FROM visite v
  LEFT JOIN structure s ON s.id = v.structure_id
  LEFT JOIN region r ON r.id = s.region_id
  WHERE v.laboratoire_id = $1
  GROUP BY r.nom ORDER BY n DESC`;

const COVERAGE = `
  SELECT c.id, c.nom, c.objectif, c.statut, pr.nom AS produit,
         (SELECT COUNT(*) FROM visite v
           WHERE v.laboratoire_id = c.laboratoire_id AND v.produits LIKE '%"produit_id":' || pr.id || ',%'
             AND v.statut = 'valide') AS validees
  FROM campagne c
  LEFT JOIN produit pr ON pr.id = c.produit_id
  WHERE c.laboratoire_id = $1
  ORDER BY c.debut DESC`;

async function delegueView(req, labo) {
  const me = req.user.id;
  const stats = await all('SELECT v.statut, COUNT(*) AS n FROM visite v WHERE v.laboratoire_id = $1 AND v.user_id = $2 GROUP BY v.statut',
    [labo, me]);
  const byStatus = Object.fromEntries(stats.map((s) => [s.statut, s.n]));
  const semaine = await get(
    `SELECT COUNT(*) AS n FROM visite v
     WHERE v.laboratoire_id = $1 AND v.user_id = $2 AND v.date >= ${WEEK_AGO}`, [labo, me]);
  const prochaines = await all(`
    SELECT v.id, v.prochaine_visite, v.statut, p.nom AS professionnel, d.nom AS district
    FROM visite v
    LEFT JOIN professionnel p ON p.id = v.professionnel_id
    LEFT JOIN structure s ON s.id = v.structure_id
    LEFT JOIN district d ON d.id = s.district_id
    WHERE v.laboratoire_id = $1 AND v.user_id = $2 AND v.prochaine_visite != '' AND v.prochaine_visite >= ${TODAY}
    ORDER BY v.prochaine_visite LIMIT 8`, [labo, me]);
  const tournees = await all(`
    SELECT t.id, t.date, t.statut, d.nom AS district
    FROM tournee t LEFT JOIN district d ON d.id = t.district_id
    WHERE t.laboratoire_id = $1 AND t.user_id = $2 AND t.statut = 'planifiee'
    ORDER BY t.date LIMIT 8`, [labo, me]);
  const recentes = await all(`
    SELECT v.id, v.date, v.resultat, v.statut, p.nom AS professionnel
    FROM visite v LEFT JOIN professionnel p ON p.id = v.professionnel_id
    WHERE v.laboratoire_id = $1 AND v.user_id = $2
    ORDER BY v.date DESC, v.id DESC LIMIT 10`, [labo, me]);
  return { role: 'delegue', stats: byStatus, semaine: semaine?.n || 0, prochaines, tournees, recentes };
}

async function managerView(req, labo) {
  const aValider = await get('SELECT COUNT(*) AS n FROM visite WHERE laboratoire_id = $1 AND statut = $2', [labo, 'soumis']);
  const fileAttente = await all(`
    SELECT v.id, v.date, p.nom AS professionnel, d.nom AS district, u.nom AS auteur
    FROM visite v
    LEFT JOIN professionnel p ON p.id = v.professionnel_id
    LEFT JOIN structure s ON s.id = v.structure_id
    LEFT JOIN district d ON d.id = s.district_id
    LEFT JOIN users u ON u.id = v.user_id
    WHERE v.laboratoire_id = $1 AND v.statut = 'soumis'
    ORDER BY v.date DESC, v.id DESC LIMIT 10`, [labo]);
  const equipe = await all(`
    SELECT u.id, u.nom,
      (SELECT COUNT(*) FROM visite v WHERE v.user_id = u.id AND v.statut = 'soumis') AS soumises,
      (SELECT COUNT(*) FROM visite v WHERE v.user_id = u.id AND v.statut = 'valide') AS validees,
      (SELECT COUNT(*) FROM visite v WHERE v.user_id = u.id AND v.statut = 'refuse') AS refusees
    FROM users u WHERE u.laboratoire_id = $1 AND u.role = 'delegue'
    ORDER BY u.nom`, [labo]);
  const parRegion = await all(PAR_REGION, [labo]);
  const tournees = await get(`
    SELECT (SELECT COUNT(*) FROM tournee t WHERE t.laboratoire_id = $1 AND t.statut = 'planifiee') AS planifiees,
           (SELECT COUNT(*) FROM tournee t WHERE t.laboratoire_id = $2 AND t.statut = 'faite') AS faites`, [labo, labo]);
  return { role: 'manager', aValider: aValider?.n || 0, fileAttente, equipe, parRegion, tournees };
}

async function laboView(req, labo) {
  const campagnes = await all(COVERAGE, [labo]);
  const global = await get(`
    SELECT
      (SELECT COUNT(*) FROM visite WHERE laboratoire_id = $1 AND statut = 'soumis') AS soumises,
      (SELECT COUNT(*) FROM visite WHERE laboratoire_id = $2 AND statut = 'valide') AS validees,
      (SELECT COUNT(*) FROM visite WHERE laboratoire_id = $3 AND statut = 'refuse') AS refusees,
      (SELECT COUNT(*) FROM professionnel WHERE laboratoire_id = $4) AS ps,
      (SELECT COUNT(*) FROM users WHERE laboratoire_id = $5 AND role = 'delegue') AS delegues`,
    [labo, labo, labo, labo, labo]);
  const parRegion = await all(`
    SELECT r.nom AS region, COUNT(*) AS n
    FROM visite v
    LEFT JOIN structure s ON s.id = v.structure_id
    LEFT JOIN region r ON r.id = s.region_id
    WHERE v.laboratoire_id = $1 AND v.statut IN ('soumis','valide')
    GROUP BY r.nom ORDER BY n DESC`, [labo]);
  return {
    role: 'laboratoire',
    campagnes: campagnes.map((c) => ({ ...c, taux: c.objectif ? Math.round((100 * c.validees) / c.objectif) : 0 })),
    global,
    parRegion,
  };
}

async function adminView(req, labo) {
  const tenant = await get('SELECT id, nom, agrement_arp, created_at FROM laboratoire WHERE id = $1', [labo]);
  const users = await all('SELECT role, COUNT(*) AS n FROM users WHERE laboratoire_id = $1 GROUP BY role', [labo]);
  const ps = await get('SELECT COUNT(*) AS n FROM professionnel WHERE laboratoire_id = $1', [labo]);
  const structures = await get('SELECT COUNT(*) AS n FROM structure WHERE laboratoire_id = $1', [labo]);
  return { role: 'admin', tenant, users, ps: ps?.n || 0, structures: structures?.n || 0 };
}

router.get('/dashboard', async (req, res) => {
  const labo = req.user.laboratoire_id;
  if (req.user.role === 'delegue') return res.json(await delegueView(req, labo));
  if (req.user.role === 'manager') return res.json(await managerView(req, labo));
  if (req.user.role === 'laboratoire') return res.json(await laboView(req, labo));
  return res.json(await adminView(req, labo));
});

export default router;
