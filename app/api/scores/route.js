import { currentUser } from '@/lib/server/auth.js';
import { GAMES, LEVELS, MAX_SCORE } from '@/lib/server/catalog.js';
import { query } from '@/lib/server/db.js';
import { HttpError, json, limited, readJson, route } from '@/lib/server/http.js';

export const POST = route(async (request) => {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Log in to save scores.');
  if (limited('score:' + user.id, 60, 10 * 60 * 1000)) throw new HttpError(429, 'That is a lot of games. Take a breather and try again soon.');
  const body = await readJson(request);
  const game = String(body.game || ''), level = String(body.level || ''), score = Number(body.score);
  if (!GAMES.includes(game)) throw new HttpError(400, 'Unknown game.');
  if (!LEVELS.includes(level)) throw new HttpError(400, 'Unknown opponent.');
  if (!Number.isInteger(score) || score <= 0 || score > MAX_SCORE) throw new HttpError(400, 'That score does not look right.');
  const detail = String(body.detail || '').replace(/[\u0000-\u001f]/g, '').slice(0, 80);
  const prev = await query('SELECT MAX(score) AS best FROM scores WHERE user_id = $1 AND game = $2', [user.id, game]);
  const before = Number(prev.rows[0].best) || 0;
  await query('INSERT INTO scores (user_id, game, level, score, detail) VALUES ($1, $2, $3, $4, $5)', [user.id, game, level, score, detail]);
  const best = Math.max(score, before);
  const rank = await query(
    'SELECT COUNT(*) + 1 AS rank FROM (SELECT user_id, MAX(score) AS best FROM scores WHERE game = $1 GROUP BY user_id) b WHERE b.best > $2',
    [game, best]);
  return json({ saved: true, score, best, personalBest: score > before, rank: Number(rank.rows[0].rank) }, 201);
});
