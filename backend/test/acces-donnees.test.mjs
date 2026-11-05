// Tests d'intégration (node --test) — audit sécurité 2026-11-05, constats 1 et 2 :
//  1. un délégué SANS abonnement actif n'accède pas aux données du laboratoire (professionnels, structures...),
//  2. un délégué ne lit que ses propres visites (détail, pièces jointes, PDF), pas celles de ses collègues.
// Base SQLite temporaire, vraie application Express (createApp) sur un port libre.
import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

const fichier = path.join(os.tmpdir(), `delegpharma-acces-${process.pid}.db`);
process.env.DATABASE_URL = `file:${fichier}`;
process.env.JWT_SECRET = 'test-secret';
delete process.env.OLLAMA_API_KEY;

const { initSchema } = await import('../src/schema.js');
const { run, get, lastInsertId } = await import('../src/db.js');
const { signToken } = await import('../src/auth.js');
const { createApp } = await import('../src/app.js');

let serveur, base;
const ids = {};

async function creerUser(cle, { labo, role = 'delegue', abo = null }) {
  const r = await run(
    "INSERT INTO users (laboratoire_id, role, nom, email, password_hash) VALUES ($1,$2,$3,$4,'x')",
    [labo, role, `Utilisateur ${cle}`, `${cle}@test.sn`]);
  const id = lastInsertId(r);
  if (abo) {
    const jours = abo === 'expire' ? -5 : 20;
    const exp = new Date(Date.now() + jours * 86400000).toISOString().slice(0, 10);
    await run(
      "INSERT INTO abonnement (user_id, formule_id, montant, statut, date_debut, date_expiration) VALUES ($1,$2,5000,$3,'2026-01-01',$4)",
      [id, ids.formule, abo, exp]);
  }
  ids[cle] = { id, labo, role };
  return id;
}

async function visite(cle, auteur, labo, prof, struct) {
  const docs = JSON.stringify([{ nom: 'rapport.txt', type: 'text/plain', data: Buffer.from('contenu secret').toString('base64') }]);
  const r = await run(
    `INSERT INTO visite (laboratoire_id, user_id, professionnel_id, structure_id, date, compte_rendu, statut, docs)
     VALUES ($1,$2,$3,$4,'2026-10-01','CR confidentiel','soumis',$5)`, [labo, ids[auteur].id, prof, struct, docs]);
  ids[cle] = lastInsertId(r);
}

test.before(async () => {
  await initSchema();
  await run("INSERT INTO laboratoire (nom) VALUES ('Labo A')");
  await run("INSERT INTO laboratoire (nom) VALUES ('Labo B')");
  const labA = (await get("SELECT id FROM laboratoire WHERE nom = 'Labo A'")).id;
  const labB = (await get("SELECT id FROM laboratoire WHERE nom = 'Labo B'")).id;
  ids.labA = labA; ids.labB = labB;
  await run("INSERT INTO formule (nom, prix) VALUES ('Mensuel', 5000)");
  ids.formule = (await get("SELECT id FROM formule WHERE nom = 'Mensuel'")).id;

  for (const [labo, nom] of [[labA, 'Dr Secret A'], [labB, 'Dr Secret B']]) {
    await run("INSERT INTO structure (laboratoire_id, localite) VALUES ($1,$2)", [labo, `Structure ${nom}`]);
    const s = (await get('SELECT id FROM structure WHERE laboratoire_id = $1', [labo])).id;
    await run("INSERT INTO professionnel (laboratoire_id, nom, structure_id) VALUES ($1,$2,$3)", [labo, nom, s]);
    ids[`prof${labo}`] = (await get('SELECT id FROM professionnel WHERE laboratoire_id = $1', [labo])).id;
    ids[`struct${labo}`] = s;
  }

  await creerUser('actif1', { labo: labA, abo: 'actif' });
  await creerUser('actif2', { labo: labA, abo: 'actif' });
  await creerUser('gratuit', { labo: labA });
  await creerUser('expire', { labo: labA, abo: 'expire' });
  await creerUser('attente', { labo: labA, abo: 'en_attente' });
  await creerUser('manager', { labo: labA, role: 'manager' });
  await creerUser('actifB', { labo: labB, abo: 'actif' });

  await visite('visite1', 'actif1', labA, ids[`prof${labA}`], ids[`struct${labA}`]);
  await visite('visite2', 'actif2', labA, ids[`prof${labA}`], ids[`struct${labA}`]);

  const app = createApp();
  await new Promise((ok) => { serveur = app.listen(0, ok); });
  base = `http://127.0.0.1:${serveur.address().port}/api`;
});

test.after(() => {
  serveur?.close();
  for (const f of [fichier, `${fichier}-wal`, `${fichier}-shm`]) { try { fs.rmSync(f, { force: true }); } catch { /* ignore */ } }
});

async function appel(cle, chemin, options = {}) {
  const u = ids[cle];
  const token = signToken({ id: u.id, laboratoire_id: u.labo, role: u.role, nom: `Utilisateur ${cle}` });
  const r = await fetch(base + chemin, { ...options, headers: { Cookie: `dp_token=${token}`, 'Content-Type': 'application/json', ...(options.headers || {}) } });
  let json = null;
  try { json = await r.clone().json(); } catch { /* pas du JSON */ }
  return { status: r.status, json, res: r };
}

const DONNEES_LABO = ['/professionnels', `/professionnels/${'{P}'}`, '/structures', '/campagnes', '/catalog', '/notifications', '/notifications/non-lues'];

test("constat 1 : compte gratuit, abonnement en attente → aucune donnée du laboratoire", async () => {
  for (const cle of ['gratuit', 'attente']) {
    for (const chemin of DONNEES_LABO) {
      const r = await appel(cle, chemin.replace('{P}', ids[`prof${ids.labA}`]));
      assert.equal(r.status, 403, `${cle} ${chemin} devrait être refusé (reçu ${r.status})`);
    }
    assert.equal((await appel(cle, '/districts/1/professionnels')).status, 403, `${cle} checklist district`);
    assert.equal((await appel(cle, '/assistant', { method: 'POST', body: JSON.stringify({ message: 'bonjour' }) })).status, 403, `${cle} assistant`);
    assert.equal((await appel(cle, '/export/visites.csv')).status, 403, `${cle} export`);
  }
});

test("constat 1 : compte gratuit — ses propres vues et la découverte restent accessibles", async () => {
  for (const chemin of ['/dashboard', '/visites', '/tournees', '/objectifs', '/regions', '/abonnements/mon', '/auth/me', '/tarifs']) {
    const r = await appel('gratuit', chemin);
    assert.equal(r.status, 200, `${chemin} (reçu ${r.status})`);
  }
  const me = await appel('gratuit', '/auth/me');
  assert.equal(me.json.abonnement.statut, 'aucun');
});

test("constat 1 : abonné, abonnement expiré (lecture seule), manager — accès inchangé et limité à leur laboratoire", async () => {
  for (const cle of ['actif1', 'expire', 'manager']) {
    const r = await appel(cle, '/professionnels');
    assert.equal(r.status, 200, `${cle} (reçu ${r.status})`);
    assert.deepEqual(r.json.map((p) => p.nom), ['Dr Secret A'], `${cle} ne voit que son laboratoire`);
  }
  assert.equal((await appel('actif1', '/structures')).status, 200);
  assert.equal((await appel('actif1', '/catalog')).status, 200);
});

test("constat 2 : un délégué ne lit que ses propres visites (détail, pièce jointe, PDF)", async () => {
  const v1 = ids.visite1, v2 = ids.visite2;
  assert.equal((await appel('actif1', `/visites/${v1}`)).status, 200, 'sa propre visite');
  assert.equal((await appel('actif1', `/visites/${v1}/doc/0`)).status, 200, 'sa propre pièce jointe');

  assert.equal((await appel('actif1', `/visites/${v2}`)).status, 404, 'détail de la visite d\'un collègue');
  assert.equal((await appel('actif1', `/visites/${v2}/doc/0`)).status, 404, 'pièce jointe d\'un collègue');
  assert.equal((await appel('actif1', `/visites/${v2}/pdf`)).status, 404, 'PDF d\'un collègue');
  assert.equal((await appel('actif1', `/visites/${v2}/pdf/status`)).status, 404, 'état du PDF d\'un collègue');
  assert.equal((await get('SELECT COUNT(*) AS n FROM pdf_jobs WHERE visite_id = $1', [v2])).n, 0, 'aucun travail PDF créé pour la visite d\'un collègue');
});

test("constat 2 : un manager garde l'accès aux visites de son laboratoire, un autre laboratoire n'y a pas accès", async () => {
  assert.equal((await appel('manager', `/visites/${ids.visite2}`)).status, 200);
  assert.equal((await appel('manager', `/visites/${ids.visite2}/doc/0`)).status, 200);
  assert.equal((await appel('actifB', `/visites/${ids.visite1}`)).status, 404, 'autre laboratoire');
});
