import { currentUser } from '@/lib/server/auth.js';
import { GAMES, LEVELS } from '@/lib/server/catalog.js';
import { query } from '@/lib/server/db.js';
import { HttpError, route } from '@/lib/server/http.js';

// Best run per player for one game, or each player's best per game added up across all games.
export const GET = route(async (request) => {
  const url = new URL(request.url);
  const game = url.searchParams.get('game') || 'all';
  const levelParam = url.searchParams.get('level');
  const level = levelParam && levelParam !== 'all' ? levelParam : null;
  if (game !== 'all' && !GAMES.includes(game)) throw new HttpError(400, 'Unknown game.');
  if (level && !LEVELS.includes(level)) throw new HttpError(400, 'Unknown opponent.');
  const me = await currentUser();
  let ranked, params;
  if (game === 'all') {
    ranked = `WITH best AS (
        SELECT user_id, game, MAX(score) AS score, MIN(created_at) AS at FROM scores
        WHERE game = ANY($2::text[]) AND ($1::text IS NULL OR level = $1) GROUP BY user_id, game
      ), tot AS (
        SELECT user_id, SUM(score)::bigint AS score, COUNT(*)::int AS games, MAX(at) AS at FROM best GROUP BY user_id
      )
      SELECT t.user_id, u.username, t.score, NULL::text AS level, t.games || ' game' || CASE WHEN t.games = 1 THEN '' ELSE 's' END AS detail, t.at,
        RANK() OVER (ORDER BY t.score DESC)::int AS rank, ROW_NUMBER() OVER (ORDER BY t.score DESC, t.at ASC) AS rn
      FROM tot t JOIN users u ON u.id = t.user_id`;
    params = [level, GAMES];
  } else {
    ranked = `WITH best AS (
        SELECT DISTINCT ON (user_id) user_id, score, level, detail, created_at AS at
        FROM scores WHERE game = $2 AND ($1::text IS NULL OR level = $1)
        ORDER BY user_id, score DESC, created_at ASC
      )
      SELECT b.user_id, u.username, b.score, b.level, b.detail, b.at,
        RANK() OVER (ORDER BY b.score DESC)::int AS rank, ROW_NUMBER() OVER (ORDER BY b.score DESC, b.at ASC) AS rn
      FROM best b JOIN users u ON u.id = b.user_id`;
    params = [level, game];
  }
  const [top, count, mine] = await Promise.all([
    query(`SELECT * FROM (${ranked}) r ORDER BY rn LIMIT 50`, params),
    query(`SELECT COUNT(*)::int AS n FROM (${ranked}) r`, params),
    me ? query(`SELECT * FROM (${ranked}) r WHERE r.user_id = $3`, params.concat([me.id])) : Promise.resolve({ rows: [] })
  ]);
  const row = (r) => ({ rank: r.rank, username: r.username, score: Number(r.score), level: r.level, detail: r.detail, at: r.at, you: !!me && Number(r.user_id) === Number(me.id) });
  return { game, level: level || 'all', players: count.rows[0].n, rows: top.rows.map(row), me: mine.rows[0] ? row(mine.rows[0]) : null };
});
