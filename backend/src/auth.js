// Authentification multi-tenant : JWT dans cookie httpOnly + middleware de rôles.
// Le JWT embarque laboratoire_id — chaque requête est scopée au tenant du token.
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

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

export function verifyPassword(hash, password) {
  return bcrypt.compare(password, hash);
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
