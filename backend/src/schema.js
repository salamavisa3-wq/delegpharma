// Schéma SQL — DelegPharma SaaS.
// Multi-tenant : chaque table métier porte laboratoire_id (isolation par laboratoire).
// Multi-pays : pays -> region -> district (hiérarchie sanitaire officielle).
const SQLiteDDL = `
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS pays (
  id   INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT NOT NULL UNIQUE,
  nom  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS region (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  pays_id INTEGER NOT NULL REFERENCES pays(id),
  nom     TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_region_pays ON region(pays_id);

CREATE TABLE IF NOT EXISTS district (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  region_id INTEGER NOT NULL REFERENCES region(id),
  nom       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_district_region ON district(region_id);

CREATE TABLE IF NOT EXISTS type_structure (
  id  INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS specialite (
  id  INTEGER PRIMARY KEY AUTOINCREMENT,
  nom TEXT NOT NULL UNIQUE
);

-- Laboratoire = tenant (donneur d'ordre).
CREATE TABLE IF NOT EXISTS laboratoire (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  nom          TEXT NOT NULL,
  agrement_arp TEXT NOT NULL DEFAULT '',
  adresse      TEXT NOT NULL DEFAULT '',
  ville        TEXT NOT NULL DEFAULT '',
  telephone    TEXT NOT NULL DEFAULT '',
  email        TEXT NOT NULL DEFAULT '',
  actif        INTEGER NOT NULL DEFAULT 1,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS structure (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  laboratoire_id    INTEGER NOT NULL REFERENCES laboratoire(id),
  type_structure_id INTEGER REFERENCES type_structure(id),
  region_id         INTEGER REFERENCES region(id),
  district_id       INTEGER REFERENCES district(id),
  localite          TEXT NOT NULL DEFAULT '',
  telephone         TEXT NOT NULL DEFAULT '',
  geo               TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_structure_labo ON structure(laboratoire_id);
CREATE INDEX IF NOT EXISTS idx_structure_zone ON structure(region_id, district_id);

CREATE TABLE IF NOT EXISTS professionnel (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  laboratoire_id INTEGER NOT NULL REFERENCES laboratoire(id),
  nom            TEXT NOT NULL DEFAULT '',
  structure_id   INTEGER NOT NULL REFERENCES structure(id),
  specialite_id  INTEGER REFERENCES specialite(id),
  potentiel      TEXT NOT NULL DEFAULT 'B' CHECK (potentiel IN ('A','B','C')),
  telephone      TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_prof_labo ON professionnel(laboratoire_id);
CREATE INDEX IF NOT EXISTS idx_prof_structure ON professionnel(structure_id);

CREATE TABLE IF NOT EXISTS produit (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  laboratoire_id INTEGER NOT NULL REFERENCES laboratoire(id),
  nom            TEXT NOT NULL DEFAULT '',
  dci            TEXT NOT NULL DEFAULT '',
  presentation   TEXT NOT NULL DEFAULT '',
  agrement_arp   TEXT NOT NULL DEFAULT '',
  agrement_agence TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_produit_labo ON produit(laboratoire_id);

CREATE TABLE IF NOT EXISTS users (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  laboratoire_id INTEGER REFERENCES laboratoire(id),
  role           TEXT NOT NULL CHECK (role IN ('admin','laboratoire','manager','delegue','professionnel','plateforme')),
  nom            TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  telephone      TEXT NOT NULL DEFAULT '',
  password_hash  TEXT NOT NULL,
  professionnel_id INTEGER REFERENCES professionnel(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- CRV (compte rendu de visite)
CREATE TABLE IF NOT EXISTS visite (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  laboratoire_id   INTEGER NOT NULL REFERENCES laboratoire(id),
  user_id          INTEGER NOT NULL REFERENCES users(id),
  professionnel_id INTEGER NOT NULL REFERENCES professionnel(id),
  structure_id     INTEGER NOT NULL REFERENCES structure(id),
  date             TEXT NOT NULL,
  produits         TEXT NOT NULL DEFAULT '[]',   -- JSON [{produit_id,qty}]
  resultat         TEXT NOT NULL DEFAULT '' CHECK (resultat IN ('accord','reserve','refus','absent','')),
  compte_rendu     TEXT NOT NULL DEFAULT '',
  prochaine_visite TEXT NOT NULL DEFAULT '',
  geo              TEXT NOT NULL DEFAULT '',
  statut           TEXT NOT NULL DEFAULT 'brouillon' CHECK (statut IN ('brouillon','soumis','valide','refuse')),
  motif_refus      TEXT NOT NULL DEFAULT '',
  docs             TEXT NOT NULL DEFAULT '[]',   -- JSON [{nom,type,data(base64)}]
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_visite_labo ON visite(laboratoire_id, statut);
CREATE INDEX IF NOT EXISTS idx_visite_user ON visite(user_id);
CREATE INDEX IF NOT EXISTS idx_visite_date ON visite(date);

CREATE TABLE IF NOT EXISTS campagne (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  laboratoire_id INTEGER NOT NULL REFERENCES laboratoire(id),
  nom            TEXT NOT NULL DEFAULT '',
  produit_id     INTEGER REFERENCES produit(id),
  agrement_arp   TEXT NOT NULL DEFAULT '',
  debut          TEXT NOT NULL DEFAULT '',
  fin            TEXT NOT NULL DEFAULT '',
  objectif       INTEGER NOT NULL DEFAULT 0,
  statut         TEXT NOT NULL DEFAULT 'active' CHECK (statut IN ('active','terminee','brouillon')),
  region_id      INTEGER REFERENCES region(id),
  district_id    INTEGER REFERENCES district(id),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_campagne_labo ON campagne(laboratoire_id);

CREATE TABLE IF NOT EXISTS tournee (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  laboratoire_id INTEGER NOT NULL REFERENCES laboratoire(id),
  user_id        INTEGER NOT NULL REFERENCES users(id),
  date           TEXT NOT NULL,
  district_id    INTEGER REFERENCES district(id),
  ps_list        TEXT NOT NULL DEFAULT '[]',   -- JSON [professionnel_id,…]
  statut         TEXT NOT NULL DEFAULT 'planifiee' CHECK (statut IN ('planifiee','faite','annulee')),
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_tournee_labo ON tournee(laboratoire_id);

-- Formules d'abonnement (Essentiel / Standard / Premium — monétisation §3)
CREATE TABLE IF NOT EXISTS formule (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  nom            TEXT NOT NULL UNIQUE,
  prix           INTEGER NOT NULL,
  duree_jours    INTEGER NOT NULL DEFAULT 30,
  fonctionnalites TEXT NOT NULL DEFAULT '[]',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Abonnement mensuel du délégué (cycle de vie §3.2)
CREATE TABLE IF NOT EXISTS abonnement (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id),
  formule_id        INTEGER NOT NULL REFERENCES formule(id),
  montant           INTEGER NOT NULL,
  date_debut        TEXT NOT NULL DEFAULT '',
  date_expiration   TEXT NOT NULL DEFAULT '',
  statut            TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','actif','arrive_expiration','expire','resilie')),
  renouvellement_auto INTEGER NOT NULL DEFAULT 0,
  ref_transaction   TEXT NOT NULL DEFAULT '',
  created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_abo_user ON abonnement(user_id);

-- Transactions de paiement (idempotence via reference UNIQUE)
CREATE TABLE IF NOT EXISTS transaction_paiement (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  abonnement_id INTEGER REFERENCES abonnement(id),
  user_id       INTEGER NOT NULL REFERENCES users(id),
  montant       INTEGER NOT NULL,
  moyen         TEXT NOT NULL DEFAULT '',
  statut        TEXT NOT NULL DEFAULT 'en_attente' CHECK (statut IN ('en_attente','reussi','echoue','rembourse')),
  reference     TEXT NOT NULL UNIQUE,
  provider      TEXT NOT NULL DEFAULT 'cinetpay',
  provider_ref  TEXT NOT NULL DEFAULT '',
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Objectifs produit phare par délégué / zone / période (§2.3)
CREATE TABLE IF NOT EXISTS objectif (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  laboratoire_id INTEGER NOT NULL REFERENCES laboratoire(id),
  campagne_id    INTEGER REFERENCES campagne(id),
  produit_id     INTEGER REFERENCES produit(id),
  user_id        INTEGER REFERENCES users(id),   -- NULL = objectif de zone (sans délégué ciblé)
  region_id      INTEGER REFERENCES region(id),
  district_id    INTEGER REFERENCES district(id),
  objectif       INTEGER NOT NULL DEFAULT 0,
  debut          TEXT NOT NULL DEFAULT '',
  fin            TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_objectif_user ON objectif(user_id);
CREATE INDEX IF NOT EXISTS idx_objectif_campagne ON objectif(campagne_id);

-- Messagerie / notifications laboratoire ↔ délégué (§2.2)
CREATE TABLE IF NOT EXISTS notification (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  laboratoire_id INTEGER REFERENCES laboratoire(id),
  from_user_id   INTEGER REFERENCES users(id),
  to_user_id     INTEGER REFERENCES users(id),
  message        TEXT NOT NULL,
  lu             INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_notif_to ON notification(to_user_id);
`;

const PgDDL = SQLiteDDL
  .replace(/INTEGER PRIMARY KEY AUTOINCREMENT/g, 'SERIAL PRIMARY KEY')
  .replace(/TEXT NOT NULL DEFAULT \(datetime\('now'\)\)/g, "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP")
  .replace(/CREATE INDEX IF NOT EXISTS idx_region_pays ON region\(pays_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_district_region ON district\(region_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_structure_labo ON structure\(laboratoire_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_structure_zone ON structure\(region_id, district_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_prof_labo ON professionnel\(laboratoire_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_prof_structure ON professionnel\(structure_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_produit_labo ON produit\(laboratoire_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_visite_labo ON visite\(laboratoire_id, statut\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_visite_user ON visite\(user_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_visite_date ON visite\(date\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_campagne_labo ON campagne\(laboratoire_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_tournee_labo ON tournee\(laboratoire_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_abo_user ON abonnement\(user_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_objectif_user ON objectif\(user_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_objectif_campagne ON objectif\(campagne_id\);/g, '')
  .replace(/CREATE INDEX IF NOT EXISTS idx_notif_to ON notification\(to_user_id\);/g, '')
  .replace(/CREATE TABLE IF NOT EXISTS meta \(\n  key   TEXT PRIMARY KEY,\n  value TEXT\n\);/g, 'CREATE TABLE IF NOT EXISTS meta (\n  id SERIAL PRIMARY KEY,\n  key   TEXT NOT NULL UNIQUE,\n  value TEXT\n);')
  ;

export async function initSchema() {
  const { exec, run } = await import('./db.js');
  const url = process.env.DATABASE_URL || '';
  const isPg = url.startsWith('postgres://') || url.startsWith('postgresql://');
  await exec(isPg ? PgDDL : SQLiteDDL);
  if (isPg) {
    const { all } = await import('./db.js');
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_region_pays ON region(pays_id)',
      'CREATE INDEX IF NOT EXISTS idx_district_region ON district(region_id)',
      'CREATE INDEX IF NOT EXISTS idx_structure_labo ON structure(laboratoire_id)',
      'CREATE INDEX IF NOT EXISTS idx_structure_zone ON structure(region_id, district_id)',
      'CREATE INDEX IF NOT EXISTS idx_prof_labo ON professionnel(laboratoire_id)',
      'CREATE INDEX IF NOT EXISTS idx_prof_structure ON professionnel(structure_id)',
      'CREATE INDEX IF NOT EXISTS idx_produit_labo ON produit(laboratoire_id)',
      'CREATE INDEX IF NOT EXISTS idx_visite_labo ON visite(laboratoire_id, statut)',
      'CREATE INDEX IF NOT EXISTS idx_visite_user ON visite(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_visite_date ON visite(date)',
      'CREATE INDEX IF NOT EXISTS idx_campagne_labo ON campagne(laboratoire_id)',
      'CREATE INDEX IF NOT EXISTS idx_tournee_labo ON tournee(laboratoire_id)',
      'CREATE INDEX IF NOT EXISTS idx_abo_user ON abonnement(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_objectif_user ON objectif(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_objectif_campagne ON objectif(campagne_id)',
      'CREATE INDEX IF NOT EXISTS idx_notif_to ON notification(to_user_id)',
    ];
    for (const sql of indexes) await run(sql);
  }

  // --- Migrations idempotentes pour bases déjà créées ---
  // Rôles étendus (professionnel, plateforme) + admin plateforme sans tenant + lien PS.
  // Sur une base neuve le CREATE TABLE ci-dessus porte déjà ces changements ; sur une base
  // existante (Render Postgres / dev), on ajuste la définition en place.
  if (isPg) {
    await run('ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check');
    await run('ALTER TABLE users ALTER COLUMN laboratoire_id DROP NOT NULL');
    await run('ALTER TABLE users ADD COLUMN IF NOT EXISTS professionnel_id INTEGER');
    // Migration table laboratoire (ajout colonnes + index) pour bases antérieures au 2026-08-11
    await run('ALTER TABLE laboratoire ADD COLUMN IF NOT EXISTS adresse TEXT NOT NULL DEFAULT \'\'');
    await run('ALTER TABLE laboratoire ADD COLUMN IF NOT EXISTS ville TEXT NOT NULL DEFAULT \'\'');
    await run('ALTER TABLE laboratoire ADD COLUMN IF NOT EXISTS telephone TEXT NOT NULL DEFAULT \'\'');
    await run('ALTER TABLE laboratoire ADD COLUMN IF NOT EXISTS email TEXT NOT NULL DEFAULT \'\'');
    await run('ALTER TABLE laboratoire ADD COLUMN IF NOT EXISTS actif INTEGER NOT NULL DEFAULT 1');
  } else {
    // SQLite : ALTER ADD COLUMN est supporté ; le CHECK de rôle d'origine ne bloque pas les
    // rôles historiques (le code valide le rôle). Base de dev jetable pour la nouvelle définition.
    await run('ALTER TABLE users ADD COLUMN professionnel_id INTEGER').catch(() => {});
    await run('ALTER TABLE laboratoire ADD COLUMN adresse TEXT NOT NULL DEFAULT \'\'').catch(() => {});
    await run('ALTER TABLE laboratoire ADD COLUMN ville TEXT NOT NULL DEFAULT \'\'').catch(() => {});
    await run('ALTER TABLE laboratoire ADD COLUMN telephone TEXT NOT NULL DEFAULT \'\'').catch(() => {});
    await run('ALTER TABLE laboratoire ADD COLUMN email TEXT NOT NULL DEFAULT \'\'').catch(() => {});
    await run('ALTER TABLE laboratoire ADD COLUMN actif INTEGER NOT NULL DEFAULT 1').catch(() => {});
  }

  // Index laboratoire (créé en dehors du CREATE TABLE pour supporter les migrations)
  await run('CREATE INDEX IF NOT EXISTS idx_laboratoire_actif ON laboratoire(actif)').catch((e) => console.log('[schema] index actif:', e.message));
  await run('CREATE INDEX IF NOT EXISTS idx_laboratoire_nom ON laboratoire(nom)').catch((e) => console.log('[schema] index nom:', e.message));
}
