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
  laboratoire_id INTEGER NOT NULL REFERENCES laboratoire(id),
  role           TEXT NOT NULL CHECK (role IN ('admin','laboratoire','manager','delegue')),
  nom            TEXT NOT NULL,
  email          TEXT NOT NULL UNIQUE,
  telephone      TEXT NOT NULL DEFAULT '',
  password_hash  TEXT NOT NULL,
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
  .replace(/CREATE INDEX IF NOT EXISTS idx_tournee_labo ON tournee\(laboratoire_id\);/g, '');

export async function initSchema() {
  const { exec } = await import('./db.js');
  const url = process.env.DATABASE_URL || '';
  const isPg = url.startsWith('postgres://') || url.startsWith('postgresql://');
  await exec(isPg ? PgDDL : SQLiteDDL);
  if (isPg) {
    const { all, run } = await import('./db.js');
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
    ];
    for (const sql of indexes) await run(sql);
  }
}
