import { createSession, hashPassword, publicUser } from '@/lib/server/auth.js';
import { query } from '@/lib/server/db.js';
import { HttpError, clientIp, json, limited, readJson, route } from '@/lib/server/http.js';

const USERNAME_RE = /^[A-Za-z0-9_]{3,20}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function check(body) {
  const username = String(body.username || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  if (!USERNAME_RE.test(username)) throw new HttpError(400, 'Usernames are 3 to 20 letters, numbers or underscores.', 'username');
  if (email.length > 254 || !EMAIL_RE.test(email)) throw new HttpError(400, 'That email address does not look right.', 'email');
  if (password.length < 8) throw new HttpError(400, 'Passwords need at least 8 characters.', 'password');
  if (password.length > 128) throw new HttpError(400, 'Passwords can be at most 128 characters.', 'password');
  return { username, email, password };
}

export const POST = route(async (request) => {
  if (limited('signup:' + clientIp(request), 10, 60 * 60 * 1000) || limited('signup:all', 200, 60 * 60 * 1000)) {
    throw new HttpError(429, 'Too many sign ups right now. Try again in a while.');
  }
  const { username, email, password } = check(await readJson(request));
  const taken = await query(
    'SELECT lower(username) = lower($1) AS name, lower(email) = lower($2) AS mail FROM users WHERE lower(username) = lower($1) OR lower(email) = lower($2)',
    [username, email]);
  if (taken.rows.some((r) => r.name)) throw new HttpError(409, 'That username is already taken.', 'username');
  if (taken.rows.some((r) => r.mail)) throw new HttpError(409, 'There is already an account with that email. Try logging in.', 'email');
  const hash = await hashPassword(password);
  let user;
  try {
    const r = await query('INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email, created_at', [username, email, hash]);
    user = r.rows[0];
  } catch (e) {
    if (e.code === '23505') throw new HttpError(409, 'That username or email was just taken. Try another.', 'username');
    throw e;
  }
  await createSession(user.id);
  return json({ user: publicUser(user) }, 201);
});
