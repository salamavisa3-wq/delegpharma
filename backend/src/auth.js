// Authentification multi-tenant : JWT dans cookie httpOnly + middleware de rôles.
// Le JWT embarque laboratoire_id — chaque requête est scopée au tenant du token.
import jwt from 'jsonwebtoken';
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { get, run } from './db.js';

// Budget CPU Workers Free : 10 ms/invocation — le KDF est LA charge CPU du login.
// Mesuré (2026) : scrypt N=8192 ≈ 21 ms, N=4096 ≈ 11 ms, N=2048 ≈ 5,5 ms (poste local).
// N=4096 r=8 p=1 (~4 Mo) est le plus fort KDF qui tient sous la limite sur le matériel
// Cloudflare. Les paramètres SONT stockés dans le hash → on peut monter N plus tard
// (rehash au login) sans invalider les hashes existants.
const SCRYPT = { N: 4096, r: 8, p: 1, keylen: 64, maxmem: 32 * 1024 * 1024 };

/** Hash bcrypt legacy ($2a/$2b/$2y$) : importé depuis l'ancienne prod, non vérifiable →
 *  reset forcé au login (403 PASSWORD_RESET). */
export function isLegacyHash(hash) {
  return /^\$2[aby]\$/.test(String(hash || ''));
}

/** Vrai si le hash ne suit pas les paramètres courants → rehash au prochain login. */
export function needsRehash(hash) {
  if (isLegacyHash(hash)) return true;
  const [algo, N, r, p] = String(hash || '').split('$');
  return algo !== 'scrypt' || Number(N) !== SCRYPT.N || Number(r) !== SCRYPT.r || Number(p) !== SCRYPT.p;
}

// Hash auto-descriptif : scrypt$N$r$p$<salt-b64>$<hash-b64> (forward-compat params).
export function hashPassword(password) {
  const salt = randomBytes(16);
  const { N, r, p, keylen } = SCRYPT;
  const dk = scryptSync(password, salt, keylen, { N, r, p, maxmem: SCRYPT.maxmem });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${dk.toString('base64')}`;
}

export function verifyPassword(hash, password) {
  if (isLegacyHash(hash)) return Promise.resolve(false); // jamais vérifié — reset forcé
  const [algo, N, r, p, saltB64, hashB64] = String(hash || '').split('$');
  if (algo !== 'scrypt' || !saltB64 || !hashB64) return Promise.resolve(false);
  const salt = Buffer.from(saltB64, 'base64');
  const expected = Buffer.from(hashB64, 'base64');
  const dk = scryptSync(password, salt, expected.length, { N: Number(N), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem });
  return Promise.resolve(timingSafeEqual(dk, expected));
}

const SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV === 'production' ? null : 'dev-insecure-secret-change-me');
if (!SECRET) throw new Error('JWT_SECRET manquant en production — arrêt immédiat.');

export const COOKIE = 'dp_token';

export function signToken(user) {
  return jwt.sign(
    { id: user.id, laboratoire_id: user.laboratoire_id, role: user.role, nom: user.nom },
    SECRET,
    { expiresIn: '7d' },
  );
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.COOKIE_SECURE === 'true',
    sameSite: 'lax',
    maxAge: 7 * 24 * 3600 * 1000,
    path: '/',
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE, { path: '/' });
}

export function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) return res.status(401).json({ error: 'Non authentifié' });
  try {
    req.user = jwt.verify(token, SECRET);
    return next();
  } catch {
    return res.status(401).json({ error: 'Session expirée ou invalide' });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Non authentifié' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Rôle « ${req.user.role} » non autorisé (requis : ${roles.join('/')})` });
    }
    return next();
  };
}

export function publicUser(u) {
  return {
    id: u.id,
    laboratoire_id: u.laboratoire_id,
    role: u.role,
    nom: u.nom,
    email: u.email,
    telephone: u.telephone || '',
  };
}

/** Jours restants entre deux dates ISO 'YYYY-MM-DD' (peut être négatif). */
function daysBetween(fromISO, toISO) {
  return Math.round((new Date(toISO) - new Date(fromISO)) / 86400000);
}

/**
 * État d'abonnement courant d'un délégué (cycle de vie §3.2), avec refresh lazy :
 * 'actif' → 'arrive_expiration' (≤3 j restants) → 'expire' (dépassée).
 * Rôles non délégués : retourne { statut: 'n/a' } (non concernés).
 */
export async function getSubscriptionState(user) {
  if (!user || user.role !== 'delegue') return { statut: 'n/a' };
  const abo = await get(
    `SELECT a.*, f.nom AS formule_nom, f.prix AS formule_prix
     FROM abonnement a LEFT JOIN formule f ON f.id = a.formule_id
     WHERE a.user_id = $1 AND a.statut != 'en_attente'
     ORDER BY a.id DESC LIMIT 1`, [user.id]);
  if (!abo) return { statut: 'aucun' };

  const today = new Date().toISOString().slice(0, 10);
  let statut = abo.statut;
  if (abo.date_expiration) {
    if (abo.date_expiration < today) {
      statut = 'expire';
      await run('UPDATE abonnement SET statut = $1 WHERE id = $2', ['expire', abo.id]).catch(() => {});
    } else if (statut === 'actif' && daysBetween(today, abo.date_expiration) <= 3) {
      statut = 'arrive_expiration';
      await run('UPDATE abonnement SET statut = $1 WHERE id = $2', ['arrive_expiration', abo.id]).catch(() => {});
    }
  }
  return { ...abo, statut, jours_restants: abo.date_expiration ? daysBetween(today, abo.date_expiration) : null };
}

/** Verrouillage progressif (§3.2) — écritures : seul un abonnement actif (ou presque) passe. */
export function requireAboWrite(req, res, next) {
  if (!req.user || req.user.role !== 'delegue') return next();
  return getSubscriptionState(req.user)
    .then((s) => {
      if (s.statut === 'actif' || s.statut === 'arrive_expiration') return next();
      return res.status(403).json({ error: 'Abonnement requis pour cette action', code: s.statut });
    })
    .catch(next);
}

/** Verrouillage progressif — lectures : actif / arrive_expiration / expire (lecture seule). */
export function requireAboRead(req, res, next) {
  if (!req.user || req.user.role !== 'delegue') return next();
  return getSubscriptionState(req.user)
    .then((s) => {
      if (['actif', 'arrive_expiration', 'expire'].includes(s.statut)) return next();
      return res.status(403).json({ error: 'Abonnement requis', code: s.statut });
    })
    .catch(next);
}

/** Accès aux tâches (rubriques §2) : un délégué DOIT avoir un abonnement
 *  actif (ou à ≤3 j de l'échéance). Sans abonnement actif ('aucun', 'en_attente',
 *  'expire'), AUCUN accès aux tâches — lecture comprise. Non délégués : non concernés. */
export function requireAboActive(req, res, next) {
  if (!req.user || req.user.role !== 'delegue') return next();
  return getSubscriptionState(req.user)
    .then((s) => {
      if (s.statut === 'actif' || s.statut === 'arrive_expiration') return next();
      return res.status(403).json({ error: 'Abonnement actif requis pour accéder aux tâches', code: s.statut });
    })
    .catch(next);
}
