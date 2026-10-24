import { query } from '@/lib/server/db.js';
import { route } from '@/lib/server/http.js';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  await query('SELECT 1');
  return { ok: true };
});
