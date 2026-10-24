import { createSession, dummyHash, publicUser, sweepSessions, verifyPassword } from '@/lib/server/auth.js';
import { query } from '@/lib/server/db.js';
import { HttpError, clientIp, limited, readJson, route } from '@/lib/server/http.js';

const WINDOW = 15 * 60 * 1000;
const TOO_MANY = 'Too many attempts. Wait a few minutes and try again.';

// Log in with an email address or a username (usernames never contain @). Both match whatever the capitals.
export const POST = route(async (request) => {
  const body = await readJson(request);
  const login = String(body.login ?? body.email ?? '').trim().toLowerCase();
  const password = String(body.password || '');
  if (limited('login-ip:' + clientIp(request), 40, WINDOW) || limited('login:' + login, 10, WINDOW)) throw new HttpError(429, TOO_MANY);
  if (!login || login.length > 254 || !password || password.length > 128) throw new HttpError(400, 'Enter your email or username, and your password.');
  const column = login.includes('@') ? 'lower(email)' : 'lower(username)';
  const r = await query('SELECT id, username, email, password_hash, created_at FROM users WHERE ' + column + ' = $1', [login]);
  const user = r.rows[0];
  // counted per account too, so switching between someone's email and username does not double the guesses
  if (user && limited('login-user:' + user.id, 10, WINDOW)) throw new HttpError(429, TOO_MANY);
  const ok = await verifyPassword(password, user ? user.password_hash : await dummyHash());
  if (!user || !ok) throw new HttpError(401, 'That email or username and password do not match an account.');
  await createSession(user.id);
  sweepSessions();
  return { user: publicUser(user) };
});
