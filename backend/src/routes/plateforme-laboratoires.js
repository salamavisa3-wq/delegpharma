// Admin plateforme — gestion du référentiel laboratoires (CRUD + import JSON/CSV).
// Monté sous /api/plateforme (déjà protégé par requireAuth + requireRole('plateforme')).
import { Router } from 'express';
import { all, get, run, lastInsertId } from '../db.js';

const router = Router();

router.get('/laboratoires', async (req, res) => {
  const rows = await all(`
    SELECT id, nom, agrement_arp, adresse, ville, telephone, email, actif, created_at
    FROM laboratoire ORDER BY actif DESC, nom`);
  return res.json(rows);
});

router.post('/laboratoires', async (req, res) => {
  const { nom, agrement_arp = '', adresse = '', ville = '', telephone = '', email = '', actif = 1 } = req.body || {};
  if (!nom) return res.status(400).json({ error: 'nom requis' });
  const dup = await get('SELECT id FROM laboratoire WHERE LOWER(nom) = LOWER($1)', [nom.trim()]);
  if (dup) return res.status(409).json({ error: 'Laboratoire déjà existant' });
  const r = await run(
    'INSERT INTO laboratoire (nom, agrement_arp, adresse, ville, telephone, email, actif) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [nom.trim(), agrement_arp.trim(), adresse.trim(), ville.trim(), telephone.trim(), email.trim(), Number(actif)],
  );
  return res.status(201).json({ id: lastInsertId(r) });
});

router.patch('/laboratoires/:id', async (req, res) => {
  const { nom, agrement_arp, adresse, ville, telephone, email, actif } = req.body || {};
  const labo = await get('SELECT id FROM laboratoire WHERE id = $1', [req.params.id]);
  if (!labo) return res.status(404).json({ error: 'Laboratoire introuvable' });
  const fields = [];
  const values = [];
  const push = (k, v) => { fields.push(`${k} = $${values.length + 1}`); values.push(v); };
  if (nom !== undefined) push('nom', nom.trim());
  if (agrement_arp !== undefined) push('agrement_arp', agrement_arp.trim());
  if (adresse !== undefined) push('adresse', adresse.trim());
  if (ville !== undefined) push('ville', ville.trim());
  if (telephone !== undefined) push('telephone', telephone.trim());
  if (email !== undefined) push('email', email.trim());
  if (actif !== undefined) push('actif', Number(actif));
  if (!fields.length) return res.status(400).json({ error: 'Aucun champ à mettre à jour' });
  values.push(req.params.id);
  await run(`UPDATE laboratoire SET ${fields.join(', ')} WHERE id = $${values.length}`, values);
  return res.json({ ok: true });
});

router.delete('/laboratoires/:id', async (req, res) => {
  // Soft-delete via désactivation (pas de suppression réelle : des users peuvent y être rattachés).
  await run('UPDATE laboratoire SET actif = 0 WHERE id = $1', [req.params.id]);
  return res.json({ ok: true });
});

router.post('/laboratoires/import', async (req, res) => {
  const { format, data } = req.body || {};
  if (!['json', 'csv'].includes(format) || !data) return res.status(400).json({ error: "format requis : 'json' ou 'csv', avec data" });
  let rows = [];
  if (format === 'json') {
    rows = Array.isArray(data) ? data : [];
  } else {
    const lines = data.split(/\r?\n/).filter(Boolean);
    const headers = lines.shift()?.split(';').map((h) => h.trim().toLowerCase()) || [];
    for (const line of lines) {
      const vals = line.split(';');
      const row = {};
      headers.forEach((h, i) => row[h] = vals[i] || '');
      rows.push(row);
    }
  }
  let inserted = 0;
  let skipped = 0;
  for (const row of rows) {
    const nom = (row.nom || row.name || row.laboratoire || '').trim();
    if (!nom) { skipped++; continue; }
    const has = await get('SELECT id FROM laboratoire WHERE LOWER(nom) = LOWER($1)', [nom]);
    if (has) { skipped++; continue; }
    await run(
      'INSERT INTO laboratoire (nom, agrement_arp, adresse, ville, telephone, email, actif) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [nom, (row.agrement_arp || '').trim(), (row.adresse || '').trim(), (row.ville || '').trim(), (row.telephone || '').trim(), (row.email || '').trim(), 1],
    );
    inserted++;
  }
  return res.json({ inserted, skipped });
});

export default router;
