/*
 * Passwords and sessions.
 * Passwords: scrypt with a fresh 16-byte random salt per password, so two users with the same password get different hashes.
 * Sessions: a random token in an HttpOnly cookie; the database only keeps its SHA-256.
 */
import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { query } from './db.js';

const scrypt = promisify(crypto.scrypt);
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64 };
const MAXMEM = 128 * 1024 * 1024;
export const COOKIE = 'wni_sid';
const SESSION_DAYS = 30;

export async function hashPassword(password) {
  const salt = crypto.randomBytes(16);
  const key = await scrypt(password.normalize('NFKC'), salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p, maxmem: MAXMEM });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  const parts = String(stored).split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const salt = Buffer.from(parts[4], 'base64'), expected = Buffer.from(parts[5], 'base64');
  const key = await scrypt(password.normalize('NFKC'), salt, expected.length, { N: Number(parts[1]), r: Number(parts[2]), p: Number(parts[3]), maxmem: MAXMEM });
  return crypto.timingSafeEqual(key, expected);
}

// Spent on unknown emails too, so response times do not reveal which emails have accounts.
const g = globalThis;
export function dummyHash() {
  if (!g.__wniDummy) g.__wniDummy = hashPassword(crypto.randomBytes(12).toString('hex'));
  return g.__wniDummy;
}

function sha256(s) { return crypto.createHash('sha256').update(s).digest('hex'); }

export async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('base64url');
  await query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, now() + make_interval(days => $3))', [sha256(token), userId, SESSION_DAYS]);
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SESSION_DAYS * 86400
  });
}

export async function endSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await query('DELETE FROM sessions WHERE token_hash = $1', [sha256(token)]);
  jar.set(COOKIE, '', { httpOnly: true, sameSite: 'lax', secure: process.env.COOKIE_SECURE === 'true', path: '/', maxAge: 0 });
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token || token.length > 100) return null;
  const r = await query(
    'SELECT u.id, u.username, u.email, u.created_at FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()',
    [sha256(token)]);
  return r.rows[0] || null;
}

export function publicUser(u) {
  return u ? { id: Number(u.id), username: u.username, email: u.email, createdAt: u.created_at } : null;
}

// Clears out expired sessions now and then.
let lastSweep = 0;
export function sweepSessions() {
  if (Date.now() - lastSweep < 60 * 60 * 1000) return;
  lastSweep = Date.now();
  query('DELETE FROM sessions WHERE expires_at < now()').catch(() => {});
}
