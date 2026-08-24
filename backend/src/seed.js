// Seed idempotent — Sénégal 14 régions / 79 districts + tenant démo + comptes démo.
// Usage : npm run seed
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';
import { run, get, close, lastInsertId, isPg } from './db.js';
import { initSchema } from './schema.js';
import {
  PAYS, REGIONS, TYPES_STRUCTURE, SPECIALITES, TENANT_DEMO,
  STRUCTURES, PROFESSIONNELS, PRODUITS, CAMPAGNE, USERS_DEMO,
  FORMULES, USERS_EXT, LABORATOIRES, DEMO_ACTIVITY, CATALOGUE_MARCHE,
} from './seed-data.js';

/** Placeholder adaptatif : $n pour Postgres, ? pour SQLite. */
const ph = (n) => isPg() ? `$${n}` : '?';

export async function seed() {
  await initSchema();

  const already = await get(`SELECT value FROM meta WHERE key = ${ph(1)}`, ['seeded_v1']);
  if (already) {
    console.log('Seed déjà appliqué (meta.seeded_v1). Rien à faire.');
    return;
  }

  // --- Pays ---
  const rPays = await run(`INSERT INTO pays (code, nom) VALUES (${ph(1)}, ${ph(2)})`, [PAYS.code, PAYS.nom]);
  const paysId = lastInsertId(rPays);

  // --- Régions + districts (14 / 79) ---
  const regionIdByNom = {};
  const districtIdByZone = {};
  for (const [region, districts] of Object.entries(REGIONS)) {
    const rReg = await run(`INSERT INTO region (pays_id, nom) VALUES (${ph(1)}, ${ph(2)})`, [paysId, region]);
    const regionId = lastInsertId(rReg);
    regionIdByNom[region] = regionId;
    for (const d of districts) {
      const rDist = await run(`INSERT INTO district (region_id, nom) VALUES (${ph(1)}, ${ph(2)})`, [regionId, d]);
      districtIdByZone[`${region}|${d}`] = lastInsertId(rDist);
    }
  }

  // --- Types de structure + spécialités ---
  const typeIdByNom = {};
  for (const t of TYPES_STRUCTURE) {
    const r = await run(`INSERT INTO type_structure (nom) VALUES (${ph(1)})`, [t]);
    typeIdByNom[t] = lastInsertId(r);
  }
  const specialiteIdByNom = {};
  for (const s of SPECIALITES) {
    const r = await run(`INSERT INTO specialite (nom) VALUES (${ph(1)})`, [s]);
    specialiteIdByNom[s] = lastInsertId(r);
  }

  // --- Tenant démo (le laboratoire propriétaire des données démo) ---
  const rLabo = await run(`INSERT INTO laboratoire (nom, agrement_arp) VALUES (${ph(1)}, ${ph(2)})`, [TENANT_DEMO, 'ARP-LABO-DEMO-0001']);
  const laboId = lastInsertId(rLabo);

  // --- Structures démo (index 0-4) ---
  const structureIds = [];
  for (const s of STRUCTURES) {
    const r = await run(
      `INSERT INTO structure (laboratoire_id, type_structure_id, region_id, district_id, localite) VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)})`,
      [laboId, typeIdByNom[s.type], regionIdByNom[s.region], districtIdByZone[`${s.region}|${s.district}`], s.localite],
    );
    structureIds.push(lastInsertId(r));
  }

  // --- Professionnels démo ---
  for (const p of PROFESSIONNELS) {
    await run(
      `INSERT INTO professionnel (laboratoire_id, nom, structure_id, specialite_id, potentiel, telephone) VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)},${ph(6)})`,
      [laboId, p.nom, structureIds[p.structureIndex], specialiteIdByNom[p.specialite], p.potentiel, p.telephone],
    );
  }

  // --- Produits ---
  const produitIds = [];
  for (const pr of PRODUITS) {
    const r = await run(
      `INSERT INTO produit (laboratoire_id, nom, dci, presentation, agrement_arp) VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)})`,
      [laboId, pr.nom, pr.dci, pr.presentation, pr.agrement_arp],
    );
    produitIds.push(lastInsertId(r));
  }

  // --- Campagne démo ---
  await run(
    `INSERT INTO campagne (laboratoire_id, nom, produit_id, agrement_arp, debut, fin, objectif, statut, region_id, district_id)
     VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)},${ph(6)},${ph(7)},${ph(8)},${ph(9)},${ph(10)})`,
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
    await run(`INSERT INTO users (laboratoire_id, role, nom, email, password_hash) VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)})`,
      [laboId, u.role, u.nom, u.email, hash]);
  }

  const metaSql = isPg()
    ? 'INSERT INTO meta (key, value) VALUES ($1, $2) RETURNING id'
    : `INSERT INTO meta (key, value) VALUES (${ph(1)}, ${ph(2)})`;
  await run(metaSql, ['seeded_v1', String(Date.now())]);

  const totalDistricts = Object.values(REGIONS).reduce((n, d) => n + d.length, 0);
  console.log(
    `Seed OK — ${Object.keys(REGIONS).length} régions, ${totalDistricts} districts, ` +
    `tenant « ${TENANT_DEMO} » (id ${laboId}), ${demoUsers.length} comptes, ${PRODUITS.length} produits, 1 campagne.`,
  );
}

/** Seed idempotent des ajouts monétisation (§3) : formules + comptes étendus.
 *  Exécuté indépendamment de seeded_v1 pour être appliqué aussi aux bases déjà seedées. */
export async function seedExtras() {
  await initSchema();

  // Laboratoires de la place (multi-tenant §2) — uniquement ceux absents (MEDIS est créé par seed()).
  for (const lab of LABORATOIRES) {
    const nom = typeof lab === 'string' ? lab : lab.nom;
    const has = await get(`SELECT id FROM laboratoire WHERE nom = ${ph(1)}`, [nom]);
    if (!has) {
      const { agrement_arp = '', adresse = '', ville = '', telephone = '', email = '', actif = 1 } = typeof lab === 'string' ? {} : lab;
      await run(
        'INSERT INTO laboratoire (nom, agrement_arp, adresse, ville, telephone, email, actif) VALUES ($1,$2,$3,$4,$5,$6,$7)',
        [nom, agrement_arp, adresse, ville, telephone, email, actif],
      );
    }
  }

  // Formules d'abonnement
  const alreadyF = await get(`SELECT value FROM meta WHERE key = ${ph(1)}`, ['formules_v1']);
  if (!alreadyF) {
    for (const f of FORMULES) {
      await run('INSERT INTO formule (nom, prix, duree_jours, fonctionnalites) VALUES ($1,$2,$3,$4)',
        [f.nom, f.prix, f.duree_jours, JSON.stringify(f.fonctionnalites)]);
    }
    const metaSql = isPg()
      ? 'INSERT INTO meta (key, value) VALUES ($1, $2) RETURNING id'
      : `INSERT INTO meta (key, value) VALUES (${ph(1)}, ${ph(2)})`;
    await run(metaSql, ['formules_v1', String(Date.now())]);
    console.log('Formules seedées : Essentiel 5000 / Standard 10000 / Premium 15000 FCFA.');
  }

  // Comptes étendus : admin plateforme (sans tenant) + professionnel de santé (lecture seule)
  const alreadyE = await get(`SELECT value FROM meta WHERE key = ${ph(1)}`, ['users_ext_v1']);
  if (!alreadyE) {
    const hasP = await get(`SELECT id FROM users WHERE email = ${ph(1)}`, ['admin.plateforme']);
    if (!hasP) {
      const hash = bcrypt.hashSync('Admin@2026Plateforme', 10);
      await run('INSERT INTO users (laboratoire_id, role, nom, email, password_hash) VALUES (NULL, $1, $2, $3, $4)',
        ['plateforme', 'Admin Plateforme', 'admin.plateforme', hash]);
    }
    const hasPs = await get(`SELECT id FROM users WHERE email = ${ph(1)}`, ['ps.demo']);
    if (!hasPs) {
      const ps = await get(`SELECT id, laboratoire_id FROM professionnel WHERE nom = ${ph(1)} ORDER BY id LIMIT 1`,
        ['Dr Awa Ndiaye']);
      if (ps) {
        const hash = bcrypt.hashSync('Ps@2026Deleg', 10);
        await run('INSERT INTO users (laboratoire_id, role, nom, email, password_hash, professionnel_id) VALUES ($1,$2,$3,$4,$5,$6)',
          [ps.laboratoire_id, 'professionnel', 'Dr Awa Ndiaye', 'ps.demo', hash, ps.id]);
      }
    }
    const metaSql = isPg()
      ? 'INSERT INTO meta (key, value) VALUES ($1, $2) RETURNING id'
      : `INSERT INTO meta (key, value) VALUES (${ph(1)}, ${ph(2)})`;
    await run(metaSql, ['users_ext_v1', String(Date.now())]);
    console.log('Comptes étendus créés : admin.plateforme + ps.demo.');
  }
}

/** Seed idempotent de l'activité démo (rubriques CRV / tournées / objectifs / couverture).
 *  Auto-suffisant : s'applique aussi aux bases déjà seedées (seeded_v1 présent).
 *  Crée l'abonnement actif du délégué démo (sinon §3.2 bloque ses écritures),
 *  des structures/professionnels supplémentaires, des CRV aux 4 statuts liés aux
 *  produits (alimente taux de couverture + objectifs), des tournées avec checklist,
 *  et des objectifs produit/zone. Guard : meta.demo_activity_v1. */
export async function seedDemoActivity() {
  await initSchema();

  const already = await get(`SELECT value FROM meta WHERE key = ${ph(1)}`, ['demo_activity_v1']);
  if (already) {
    console.log('Activité démo déjà appliquée (meta.demo_activity_v1). Rien à faire.');
    return;
  }

  const labo = await get(`SELECT id, nom FROM laboratoire WHERE nom = ${ph(1)}`, [TENANT_DEMO]);
  if (!labo) throw new Error(`seedDemoActivity : laboratoire « ${TENANT_DEMO} » introuvable — lancer seed() d'abord`);

  // --- Helpers de lookup (échec = fail fast : ce seed tourne APRÈS seed()) ---
  const lookup = (sql, args, label) => get(sql, args).then((row) => {
    if (!row) throw new Error(`seedDemoActivity : ${label} introuvable`);
    return row;
  });
  const regionId = (nom) => lookup(`SELECT id FROM region WHERE nom = ${ph(1)}`, [nom], `région « ${nom} »`);
  const districtId = async (region, nom) => {
    const r = await regionId(region);
    return (await lookup(`SELECT id FROM district WHERE nom = ${ph(1)} AND region_id = ${ph(2)}`, [nom, r.id], `district « ${nom} » (${region})`)).id;
  };
  const typeId = (nom) => lookup(`SELECT id FROM type_structure WHERE nom = ${ph(1)}`, [nom], `type_structure « ${nom} »`);
  const specId = (nom) => lookup(`SELECT id FROM specialite WHERE nom = ${ph(1)}`, [nom], `spécialité « ${nom} »`);
  const userId = (email) => lookup(`SELECT id FROM users WHERE email = ${ph(1)}`, [email], `utilisateur « ${email} »`);
  const psRow = (nom) => lookup(
    `SELECT id, structure_id FROM professionnel WHERE nom = ${ph(1)} AND laboratoire_id = ${ph(2)} ORDER BY id LIMIT 1`,
    [nom, labo.id], `professionnel « ${nom} »`);

  // --- 1) Abonnement actif du délégué démo (monétisation §3.2) ---
  const a = DEMO_ACTIVITY.abonnement;
  const aboUser = await userId(a.userEmail);
  const formule = await get(`SELECT id, prix FROM formule WHERE nom = ${ph(1)}`, [a.formule]);
  if (formule) {
    const has = await get(`SELECT id FROM abonnement WHERE user_id = ${ph(1)} AND statut = ${ph(2)}`, [aboUser.id, 'actif']);
    if (!has) {
      await run(
        `INSERT INTO abonnement (user_id, formule_id, montant, date_debut, date_expiration, statut, renouvellement_auto, ref_transaction)
         VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)},${ph(6)},0,${ph(7)})`,
        [aboUser.id, formule.id, formule.prix, a.date_debut, a.date_expiration, 'actif', 'DEMO-ABO-DELEGUE-' + Date.now()]);
    }
  }

  // --- 2) Structures + professionnels supplémentaires (référentiel enrichi) ---
  const structureIdByNom = {};
  for (const s of DEMO_ACTIVITY.structures) {
    const r = await run(
      `INSERT INTO structure (laboratoire_id, type_structure_id, region_id, district_id, localite)
       VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)})`,
      [labo.id, (await typeId(s.type)).id, (await regionId(s.region)).id, await districtId(s.region, s.district), s.localite]);
    structureIdByNom[s.nom] = lastInsertId(r);
  }
  const psIdByNom = {};
  for (const p of DEMO_ACTIVITY.professionnels) {
    const sid = structureIdByNom[p.structure];
    if (!sid) throw new Error(`seedDemoActivity : structure « ${p.structure} » introuvable (professionnel ${p.nom})`);
    const r = await run(
      `INSERT INTO professionnel (laboratoire_id, nom, structure_id, specialite_id, potentiel, telephone)
       VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)},${ph(6)})`,
      [labo.id, p.nom, sid, (await specId(p.specialite)).id, p.potentiel, p.telephone]);
    psIdByNom[p.nom] = lastInsertId(r);
  }

  // --- 3) CRV aux 4 statuts (auteur = délégué démo) ---
  const dm = await userId('dm.senegal');
  const produitIdByArp = {};
  for (const pr of PRODUITS) {
    const row = await get(`SELECT id FROM produit WHERE laboratoire_id = ${ph(1)} AND agrement_arp = ${ph(2)}`,
      [labo.id, pr.agrement_arp]);
    if (!row) throw new Error(`seedDemoActivity : produit « ${pr.nom} » introuvable`);
    produitIdByArp[pr.agrement_arp] = row.id;
  }
  for (const v of DEMO_ACTIVITY.visites) {
    const ps = await psRow(v.professionnel);
    const produits = (v.produits || []).map((pp) => {
      const pid = produitIdByArp[pp.arp];
      if (!pid) throw new Error(`seedDemoActivity : arp « ${pp.arp} » inconnu (visite ${v.professionnel})`);
      return { produit_id: pid, qty: pp.qty };
    });
    await run(
      `INSERT INTO visite (laboratoire_id, user_id, professionnel_id, structure_id, date, produits, resultat, compte_rendu, prochaine_visite, statut, motif_refus)
       VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)},${ph(6)},${ph(7)},${ph(8)},${ph(9)},${ph(10)},${ph(11)})`,
      [labo.id, dm.id, ps.id, ps.structure_id, v.date, JSON.stringify(produits),
        v.resultat || '', v.compte_rendu || '', v.prochaine_visite || '', v.statut, v.motif_refus || '']);
  }

  // --- 4) Tournées (checklist par district) ---
  for (const t of DEMO_ACTIVITY.tournees) {
    const did = await districtId(t.region, t.district);
    const list = [];
    for (const nom of (t.ps_list || [])) {
      list.push(psIdByNom[nom] ?? (await psRow(nom)).id);
    }
    await run(
      `INSERT INTO tournee (laboratoire_id, user_id, date, district_id, ps_list, statut)
       VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)},${ph(6)})`,
      [labo.id, dm.id, t.date, did, JSON.stringify(list), t.statut]);
  }

  // --- 5) Objectifs produit/zone ---
  for (const o of DEMO_ACTIVITY.objectifs) {
    const rid = o.region ? await regionId(o.region) : null;
    const uid = o.userEmail ? (await userId(o.userEmail)).id : null;
    const pid = produitIdByArp[o.arp];
    if (!pid) throw new Error(`seedDemoActivity : arp « ${o.arp} » inconnu (objectif)`);
    await run(
      `INSERT INTO objectif (laboratoire_id, campagne_id, produit_id, user_id, region_id, district_id, objectif, debut, fin)
       VALUES (${ph(1)},NULL,${ph(2)},${ph(3)},${ph(4)},NULL,${ph(5)},${ph(6)},${ph(7)})`,
      [labo.id, pid, uid, rid ? rid.id : null, o.objectif, o.debut, o.fin]);
  }

  const metaSql = isPg()
    ? 'INSERT INTO meta (key, value) VALUES ($1, $2) RETURNING id'
    : `INSERT INTO meta (key, value) VALUES (${ph(1)}, ${ph(2)})`;
  await run(metaSql, ['demo_activity_v1', String(Date.now())]);

  console.log(
    `Activité démo OK — abonnement actif ${a.userEmail}, ` +
    `${DEMO_ACTIVITY.structures.length} structures + ${DEMO_ACTIVITY.professionnels.length} professionnels, ` +
    `${DEMO_ACTIVITY.visites.length} CRV (4 statuts), ${DEMO_ACTIVITY.tournees.length} tournées, ` +
    `${DEMO_ACTIVITY.objectifs.length} objectifs.`,
  );
}

/** Catalogue marché (Sénégal) — rattache chaque produit à SON laboratoire, et donne au
 *  tenant démo (MEDIS) le catalogue complet du marché en plus de son portfolio, pour servir
 *  de vitrine. Idempotent par dédoublonnage (laboratoire_id, nom) : ré-exécutable au boot. */
export async function seedCatalog() {
  await initSchema();
  const laboIdByNom = {};
  const ensureLab = async (nom) => {
    if (laboIdByNom[nom]) return laboIdByNom[nom];
    const row = await get(`SELECT id FROM laboratoire WHERE nom = ${ph(1)}`, [nom]);
    if (row) { laboIdByNom[nom] = row.id; return row.id; }
    const r = await run(`INSERT INTO laboratoire (nom) VALUES (${ph(1)})`, [nom]);
    laboIdByNom[nom] = lastInsertId(r);
    return laboIdByNom[nom];
  };
  const demoId = await ensureLab(TENANT_DEMO);
  let inserted = 0;
  for (let i = 0; i < CATALOGUE_MARCHE.length; i++) {
    const p = CATALOGUE_MARCHE[i];
    const arp = 'ARP-MKT-' + String(i + 1).padStart(4, '0');
    const laboId = await ensureLab(p.labo);
    const owned = await get(`SELECT id FROM produit WHERE laboratoire_id = ${ph(1)} AND nom = ${ph(2)}`, [laboId, p.nom]);
    if (!owned) {
      await run(
        `INSERT INTO produit (laboratoire_id, nom, dci, presentation, agrement_arp) VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)})`,
        [laboId, p.nom, p.dci, p.presentation, arp],
      );
      inserted++;
    }
    if (laboId !== demoId) {
      const ownedDemo = await get(`SELECT id FROM produit WHERE laboratoire_id = ${ph(1)} AND nom = ${ph(2)}`, [demoId, p.nom]);
      if (!ownedDemo) {
        await run(
          `INSERT INTO produit (laboratoire_id, nom, dci, presentation, agrement_arp) VALUES (${ph(1)},${ph(2)},${ph(3)},${ph(4)},${ph(5)})`,
          [demoId, p.nom, p.dci, p.presentation, arp],
        );
        inserted++;
      }
    }
  }
  console.log(`Catalogue marché OK — ${CATALOGUE_MARCHE.length} produits référencés, ${inserted} lignes insérées.`);
}

// Exécution directe : `npm run seed`
const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  seed()
    .then(() => seedExtras())
    .then(() => seedDemoActivity())
    .then(() => seedCatalog())
    .then(() => close())
    .then(() => process.exit(0))
    .catch((e) => {
      console.error('Seed a échoué :', e);
      process.exit(1);
    });
}
