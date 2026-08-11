// Export CSV des visites (spec §2.1) — mêmes filtres que GET /api/visites.
// BOM UTF-8 pour l'ouverture directe dans Excel.
import { Router } from 'express';
import { all } from '../db.js';
import { requireAuth } from '../auth.js';

const router = Router();
router.use(requireAuth);

const esc = (x) => `"${String(x ?? '').replace(/"/g, '""')}"`;

router.get('/export/visites.csv', async (req, res) => {
  // Plateforme : scope global (pas de tenant). Admin/labo : son laboratoire. Délégué : ses visites.
  const clauses = [];
  const params = [];
  if (req.user.role !== 'plateforme') { clauses.push(`v.laboratoire_id = $${params.length + 1}`); params.push(req.user.laboratoire_id); }
  if (req.user.role === 'delegue') { clauses.push(`v.user_id = $${params.length + 1}`); params.push(req.user.id); }
  const { statut, user_id, date_from, date_to, region_id, district_id } = req.query;
  if (statut) { clauses.push(`v.statut = $${params.length + 1}`); params.push(statut); }
  if (user_id) { clauses.push(`v.user_id = $${params.length + 1}`); params.push(user_id); }
  if (date_from) { clauses.push(`v.date >= $${params.length + 1}`); params.push(date_from); }
  if (date_to) { clauses.push(`v.date <= $${params.length + 1}`); params.push(date_to); }
  if (region_id) { clauses.push(`s.region_id = $${params.length + 1}`); params.push(region_id); }
  if (district_id) { clauses.push(`s.district_id = $${params.length + 1}`); params.push(district_id); }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
  const rows = await all(`
    SELECT v.date, v.resultat, v.compte_rendu, v.statut, v.produits,
           p.nom AS professionnel, s.localite AS structure,
           d.nom AS district, r.nom AS region, u.nom AS delegue
    FROM visite v
    LEFT JOIN professionnel p ON p.id = v.professionnel_id
    LEFT JOIN structure s ON s.id = v.structure_id
    LEFT JOIN district d ON d.id = s.district_id
    LEFT JOIN region r ON r.id = s.region_id
    LEFT JOIN users u ON u.id = v.user_id
    ${where}
    ORDER BY v.date DESC, v.id DESC`, params);

  const header = ['Date', 'Professionnel', 'Structure', 'District', 'Région', 'Délégué',
    'Résultat', 'Compte rendu', 'Statut', 'Produits'];
  const lines = rows.map((row) => [
    row.date, row.professionnel, row.structure, row.district, row.region, row.delegue,
    row.resultat, row.compte_rendu, row.statut,
    (JSON.parse(row.produits || '[]'))
      .map((p) => `${p.nom || p.produit_id || ''}:${p.qty ?? p.quantite ?? ''}`).join(' ; '),
  ]);
  const csv = '﻿' + [header, ...lines].map((l) => l.map(esc).join(',')).join('\r\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="visites.csv"');
  return res.send(csv);
});

export default router;
