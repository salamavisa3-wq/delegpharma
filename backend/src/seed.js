// Seed idempotent — Sénégal 14 régions / 79 districts + tenant démo + comptes démo.
// Usage : npm run seed
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { run, get, close, lastInsertId, url, isPg } from './db.js';
import { initSchema } from './schema.js';
import {
  PAYS, REGIONS, TYPES_STRUCTURE, SPECIALITES, TENANT_DEMO,
  STRUCTURES, PROFESSIONNELS, PRODUITS, CAMPAGNE, USERS_DEMO,
} from './seed-data.js';

export async function seed() {
  await initSchema();

  const already = await get('SELECT value FROM meta WHERE key = ?', ['seeded_v1']);
  if (already) {
    console.log('Seed déjà appliqué (meta.seeded_v1). Rien à faire.');
    return;
  }

  // --- Pays ---
  const rPays = await run('INSERT INTO pays (code, nom) VALUES (?, ?)', [PAYS.code, PAYS.nom]);
  const paysId = lastInsertId(rPays);

  // --- Régions + districts (14 / 79) ---
  const regionIdByNom = {};
  const districtIdByZone = {};
  for (const [region, districts] of Object.entries(REGIONS)) {
    const rReg = await run('INSERT INTO region (pays_id, nom) VALUES (?, ?)', [paysId, region]);
    const regionId = lastInsertId(rReg);
    regionIdByNom[region] = regionId;
    for (const d of districts) {
      const rDist = await run('INSERT INTO district (region_id, nom) VALUES (?, ?)', [regionId, d]);
      districtIdByZone[`${region}|${d}`] = lastInsertId(rDist);
    }
  }

  // --- Types de structure + spécialités ---
  const typeIdByNom = {};
  for (const t of TYPES_STRUCTURE) {
    const r = await run('INSERT INTO type_structure (nom) VALUES (?)', [t]);
    typeIdByNom[t] = lastInsertId(r);
  }
  const specialiteIdByNom = {};
  for (const s of SPECIALITES) {
    const r = await run('INSERT INTO specialite (nom) VALUES (?)', [s]);
    specialiteIdByNom[s] = lastInsertId(r);
  }

  // --- Tenant démo (le laboratoire propriétaire des données démo) ---
  const rLabo = await run('INSERT INTO laboratoire (nom, agrement_arp) VALUES (?, ?)', [TENANT_DEMO, 'ARP-LABO-DEMO-0001']);
  const laboId = lastInsertId(rLabo);

  // --- Structures démo (index 0-4) ---
  const structureIds = [];
  for (const s of STRUCTURES) {
    const r = await run(
      'INSERT INTO structure (laboratoire_id, type_structure_id, region_id, district_id, localite) VALUES (?,?,?,?,?)',
      [laboId, typeIdByNom[s.type], regionIdByNom[s.region], districtIdByZone[`${s.region}|${s.district}`], s.localite],
    );
    structureIds.push(lastInsertId(r));
  }

  // --- Professionnels démo ---
  for (const p of PROFESSIONNELS) {
    await run(
      'INSERT INTO professionnel (laboratoire_id, nom, structure_id, specialite_id, potentiel, telephone) VALUES (?,?,?,?,?,?)',
      [laboId, p.nom, structureIds[p.structureIndex], specialiteIdByNom[p.specialite], p.potentiel, p.telephone],
    );
  }

  // --- Produits ---
  const produitIds = [];
  for (const pr of PRODUITS) {
    const r = await run(
      'INSERT INTO produit (laboratoire_id, nom, dci, presentation, agrement_arp) VALUES (?,?,?,?,?)',
      [laboId, pr.nom, pr.dci, pr.presentation, pr.agrement_arp],
    );
    produitIds.push(lastInsertId(r));
  }

  // --- Campagne démo ---
  await run(
    `INSERT INTO campagne (laboratoire_id, nom, produit_id, agrement_arp, debut, fin, objectif, statut, region_id, district_id)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [laboId, CAMPAGNE.nom, produitIds[CAMPAGNE.produitIndex], CAMPAGNE.agrement_arp, '2026-08-01', '2026-12-31',
      CAMPAGNE.objectif, CAMPAGNE.statut, regionIdByNom[CAMPAGNE.region], districtIdByZone[`${CAMPAGNE.region}|${CAMPAGNE.district}`]],
  );

  // --- Comptes démo (DM / manager / laboratoire / admin tenant) ---
  const demoUsers = [
    ...USERS_DEMO,
    { nom: 'Admin DelegPharma', email: 'admin.deleg', role: 'admin', password: 'Admin@2026Deleg' },
  ];
  for (const u of demoUsers) {
    const hash = bcrypt.hashSync(u.password, 10);
    await run('INSERT INTO users (laboratoire_id, role, nom, email, password_hash) VALUES (?,?,?,?,?)',
      [laboId, u.role, u.nom, u.email, hash]);
  }

  await run('INSERT INTO meta (key, value) VALUES (?, ?)', ['seeded_v1', String(Date.now())]);

  const totalDistricts = Object.values(REGIONS).reduce((n, d) => n + d.length, 0);
  console.log(
    `Seed OK — ${Object.keys(REGIONS).length} régions, ${totalDistricts} districts, ` +
    `tenant « ${TENANT_DEMO} » (id ${laboId}), ${demoUsers.length} comptes, ${PRODUITS.length} produits, 1 campagne.`,
  );
}

// Exécution directe : `npm run seed`
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  seed()
    .then(() => close())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('Seed a échoué :', e);
      process.exit(1);
    });
}
