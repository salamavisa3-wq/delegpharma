// Connexion base de données : pg (prod) ou node:sqlite (dev)
//   - dev  : DATABASE_URL non défini -> fichier local data/delegpharma.db
//   - prod : DATABASE_URL=postgres://... (Render Postgres)
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const defaultFile = resolve(here, '../../data/delegpharma.db');

export const url = process.env.DATABASE_URL || `file:${defaultFile}`;
export const isPg = () => url.startsWith('postgres://') || url.startsWith('postgresql://');

let _db;

async function pgClient() {
  if (!_db) {
    const { default: pg } = await import('pg');
    const ssl = process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false;
    _db = new pg.Pool({ connectionString: url, ssl });
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

const db = () => isPg() ? pgClient() : sqliteClient();

/** Exécute une requête SQL paramétrée (INSERT/UPDATE/DELETE…). */
export async function run(sql, params = []) {
  if (isPg()) {
    const client = await (await db()).connect();
    try { return await client.query(sql, params); }
    finally { client.release(); }
  }
  const stmt = (await db()).prepare(sql);
  return stmt.run(...params);
}

/** Retourne toutes les lignes. */
export async function all(sql, params = []) {
  if (isPg()) {
    const client = await (await db()).connect();
    try { const r = await client.query(sql, params); return r.rows; }
    finally { client.release(); }
  }
  const stmt = (await db()).prepare(sql);
  return stmt.all(...params);
}

/** Retourne la première ligne ou null. */
export async function get(sql, params = []) {
  if (isPg()) {
    const client = await (await db()).connect();
    try { const r = await client.query(sql, params); return r.rows[0] ?? null; }
    finally { client.release(); }
  }
  const stmt = (await db()).prepare(sql);
  return stmt.get(...params) ?? null;
}

/** Exécute plusieurs instructions (DDL). */
export async function exec(sql) {
  if (isPg()) {
    const client = await (await db()).connect();
    try { await client.query(sql); }
    finally { client.release(); }
    return;
  }
  return (await db()).exec(sql);
}

/** Ferme proprement la connexion (utile pour le seed). */
export async function close() {
  if (!_db) return;
  if (isPg()) { await _db.end(); }
  else { _db.close(); }
  _db = null;
}

/** Dernier id inséré. */
export function lastInsertId(r) {
  if (isPg()) return r.rows?.[0]?.id ?? null;
  return Number(r.lastInsertRowid);
}
