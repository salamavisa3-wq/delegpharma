// Connexion base de données : @libsql/client
//   - dev  : DATABASE_URL non défini -> fichier local data/delegpharma.db (aucune config)
//   - prod : DATABASE_URL=libsql://… + TURSO_AUTH_TOKEN (Render, disque éphémère)
import { createClient } from '@libsql/client';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';

const here = dirname(fileURLToPath(import.meta.url));
const defaultFile = resolve(here, '../../data/delegpharma.db');

const url = process.env.DATABASE_URL || `file:${defaultFile}`;
if (url.startsWith('file:')) {
  const p = url.replace(/^file:/, '');
  if (p !== ':memory:') mkdirSync(dirname(p), { recursive: true });
}

export const db = createClient({
  url,
  authToken: process.env.TURSO_AUTH_TOKEN || undefined,
});

/** Exécute une requête SQL paramétrée (INSERT/UPDATE/DELETE…). Retourne le result. */
export async function run(sql, params = []) {
  return db.execute({ sql, args: params });
}

/** Retourne toutes les lignes. */
export async function all(sql, params = []) {
  const r = await db.execute({ sql, args: params });
  return r.rows;
}

/** Retourne la première ligne ou null. */
export async function get(sql, params = []) {
  const rows = await all(sql, params);
  return rows[0] ?? null;
}

/** Exécute plusieurs instructions (DDL). */
export async function exec(sql) {
  return db.executeMultiple(sql);
}

/** Dernier id inséré. */
export function lastInsertId(r) {
  return Number(r.lastInsertRowid);
}
