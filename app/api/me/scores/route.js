import { currentUser, publicUser } from '@/lib/server/auth.js';
import { GAMES } from '@/lib/server/catalog.js';
import { query } from '@/lib/server/db.js';
import { HttpError, route } from '@/lib/server/http.js';

// Your best run in every game, how many times you played it, and where that best ranks.
export const GET = route(async () => {
  const user = await currentUser();
  if (!user) throw new HttpError(401, 'Log in to see your scores.');
  const r = await query(
    `WITH best AS (
       SELECT DISTINCT ON (game) game, level, score, detail, created_at FROM scores
       WHERE user_id = $1 AND game = ANY($2::text[]) ORDER BY game, score DESC, created_at ASC
     ), plays AS (
       SELECT game, COUNT(*)::int AS plays FROM scores WHERE user_id = $1 GROUP BY game
     ), tops AS (
       SELECT game, user_id, MAX(score) AS best FROM scores WHERE game = ANY($2::text[]) GROUP BY game, user_id
     )
     SELECT b.*, p.plays, (SELECT COUNT(*) + 1 FROM tops t WHERE t.game = b.game AND t.best > b.score)::int AS rank
     FROM best b JOIN plays p USING (game)`,
    [user.id, GAMES]);
  return {
    user: publicUser(user),
    games: r.rows.map((b) => ({ game: b.game, level: b.level, score: b.score, detail: b.detail, at: b.created_at, plays: b.plays, rank: b.rank }))
  };
});
