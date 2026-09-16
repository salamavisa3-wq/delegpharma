// Connexion base de données.
//   - sqlite : dev local — DATABASE_URL absent → data/delegpharma.db
//   - pg     : DATABASE_URL=postgres://… (Render / postgres classique, historique)
//   - neon   : Cloudflare Workers — NEON_DATABASE_URL (secret) via @neondatabase/serverless
//   - d1     : repli Workers (inactif — pas la cible ; à vérifier avant activation)
// Le driver est forcé par le point d'entrée (server.js → sqlite/pg ; worker.js → neon),
// pas par l'env : l'import ESM des routes est hoisté avant que setDriver() ne soit posé.
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

// Workers : import.meta.url est undefined dans le module bundle (esbuild) → garde
// (le chemin disque n'est utilisé qu'en Node : sqlite/pg dev, jamais sous Workers).
const here = import.meta.url ? dirname(fileURLToPath(import.meta.url)) : '.';
const defaultFile = resolve(here, '../../data/delegpharma.db');

export const url = process.env.DATABASE_URL || `file:${defaultFile}`;

let _driver = null; // 'sqlite' | 'pg' | 'neon' | 'd1' — forcé par le point d'entrée
let _db;            // pg.Pool (pg) ou DatabaseSync (sqlite)
let _neon;          // fonction de requête neon (serverless HTTP, sans état)

/** Force le driver (appelé par server.js / worker.js AVANT la 1re requête). */
export function setDriver(name) { _driver = name; }
export function getDriver() {
  if (_driver) return _driver;
  if (url.startsWith('postgres://') || url.startsWith('postgresql://')) return 'pg';
  return 'sqlite';
}
// Dialecte Postgres = pg OU neon : placeholders $1..$N, RETURNING id, rowCount, r.rows.
export const isPg = () => { const d = getDriver(); return d === 'pg' || d === 'neon'; };

async function pgClient() {
  if (!_db) {
    const { default: pg } = await import('pg');
    _db = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
  }
  return _db;
}

async function sqliteClient() {
  if (!_db) {
    const { DatabaseSync } = await import('node:sqlite');
    const p = url.replace(/^file:/, '');
    if (p !== ':memory:') mkdirSync(dirname(p), { recursive: true });
    _db = new DatabaseSync(p);
    _db.exec('PRAGMA journal_mode = WAL;');
  }
  return _db;
}

async function neonClient() {
  if (!_neon) {
    // Import lazy : cloudflare:workers n'existe que sous workerd (node local → process.env).
    let connStr = process.env.NEON_DATABASE_URL;
    try { connStr = connStr || (await import('cloudflare:workers')).env.NEON_DATABASE_URL; } catch { /* node */ }
    if (!connStr) throw new Error('[db] NEON_DATABASE_URL manquant (secret Worker)');
    const { neon } = await import('@neondatabase/serverless');
    _neon = neon(connStr, { fullResults: true }); // → { rows, rowCount } comme pg
  }
  return _neon;
}

async function d1Client() {
  const { env } = await import('cloudflare:workers');
  if (!env.DB) throw new Error('[db] binding D1 « DB » manquant');
  return env.DB;
}

const db = () => {
  switch (getDriver()) {
    case 'pg':   return pgClient();
    case 'neon': return neonClient();
    case 'd1':   return d1Client();
    default:     return sqliteClient();
  }
};

// Postgres exige des placeholders $1..$N : traduit « ? » hors chaînes '...'.
function toPgSql(sql) {
  let out = '', n = 0, inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") inStr = !inStr;
    else if (c === '?' && !inStr) { n += 1; out += '$' + n; continue; }
    out += c;
  }
  return out;
}

// lastInsertId() pg/neon lit rows[0].id : garantit que l'INSERT renvoie l'id.
function withReturningId(sql) {
  if (/;/.test(sql) || /\bRETURNING\b/i.test(sql)) return sql;
  const t = sql.trim();
  if (!/^INSERT\b/i.test(t)) return sql;
  return `${t.replace(/;\s*$/, '')} RETURNING id`;
}

// node:sqlite / D1 exigent des « ? » positionnels : traduit $N -> ? (inverse de toPgSql).
function toSqliteSql(sql) {
  let out = '', inStr = false;
  for (let i = 0; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") inStr = !inStr;
    else if (c === '$' && !inStr && /\d/.test(sql[i + 1] ?? '')) {
      out += '?';
      while (/\d/.test(sql[i + 1] ?? '')) i++;
      continue;
    }
    out += c;
  }
  return out;
}

// Placeholder adaptatif : $n pour Postgres, ? pour SQLite/D1.
export const ph = (n) => isPg() ? `$${n}` : '?';

/** Exécute une requête SQL paramétrée (INSERT/UPDATE/DELETE…). */
export async function run(sql, params = []) {
  const d = getDriver();
  if (d === 'sqlite') {
    const stmt = (await db()).prepare(toSqliteSql(sql));
    return stmt.run(...params);
  }
  if (d === 'd1') {
    const r = await (await db()).prepare(toSqliteSql(sql)).bind(...params).run();
    return { success: r.success, changes: r.meta?.changes ?? 0, meta: r.meta ?? {} };
  }
  // pg / neon : même dialecte, même forme { rows, rowCount }.
  sql = toPgSql(withReturningId(sql));
  if (d === 'neon') return (await db()).query(sql, params);
  const client = await (await db()).connect();
  try { return await client.query(sql, params); }
  finally { client.release(); }
}

/** Retourne toutes les lignes. */
export async function all(sql, params = []) {
  const d = getDriver();
  if (d === 'sqlite') {
    const stmt = (await db()).prepare(toSqliteSql(sql));
    return stmt.all(...params);
  }
  if (d === 'd1') {
    const r = await (await db()).prepare(toSqliteSql(sql)).bind(...params).all();
    return r.results ?? [];
  }
  sql = toPgSql(sql);
  if (d === 'neon') return (await db()).query(sql, params).then((r) => r.rows);
  const client = await (await db()).connect();
  try { const r = await client.query(sql, params); return r.rows; }
  finally { client.release(); }
}

/** Retourne la première ligne ou null. */
export async function get(sql, params = []) {
  const d = getDriver();
  if (d === 'sqlite') {
    const stmt = (await db()).prepare(toSqliteSql(sql));
    return stmt.get(...params) ?? null;
  }
  if (d === 'd1') {
    const r = await (await db()).prepare(toSqliteSql(sql)).bind(...params).all();
    return r.results?.[0] ?? null;
  }
  sql = toPgSql(sql);
  if (d === 'neon') return (await db()).query(sql, params).then((r) => r.rows[0] ?? null);
  const client = await (await db()).connect();
  try { const r = await client.query(sql, params); return r.rows[0] ?? null; }
  finally { client.release(); }
}

/** Exécute plusieurs instructions (DDL). */
export async function exec(sql) {
  const d = getDriver();
  if (d === 'sqlite') return (await db()).exec(sql);
  if (d === 'd1') return (await db()).exec(sql);
  // neon : one-shot HTTP → pas de multi-statement ; le schéma est initialisé côté
  // job de déploiement (pg/psql), jamais dans le Worker. Cette branche gère le monostatement.
  if (d === 'neon') return (await db()).query(sql, []);
  const client = await (await db()).connect();
  try { await client.query(sql); }
  finally { client.release(); }
}

/** Ferme proprement la connexion (utile pour le seed). */
export async function close() {
  const d = getDriver();
  if (d === 'pg' && _db) { await _db.end(); _db = null; }
  else if (d === 'sqlite' && _db) { _db.close(); _db = null; }
  _neon = null;
}

/** Dernier id inséré. */
export function lastInsertId(r) {
  const d = getDriver();
  if (d === 'sqlite') return Number(r.lastInsertRowid);
  if (d === 'd1') return r?.meta?.last_row_id ?? null;
  return r?.rows?.[0]?.id ?? null;
}
