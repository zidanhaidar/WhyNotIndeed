import wordSource from '@/lib/server/words.js';
import { WORD_LENGTHS } from '@/lib/server/catalog.js';
import { query } from '@/lib/server/db.js';
import { HttpError, route } from '@/lib/server/http.js';

const FRESH_DAYS = 7;
const g = globalThis;
if (!g.__wniWordFetches) g.__wniWordFetches = new Map();

// Fetches a fresh list from the word service (one request per length at a time) and caches it in the database.
function refresh(len) {
  const inflight = g.__wniWordFetches;
  if (!inflight.has(len)) {
    inflight.set(len, wordSource.fetchOnline(len)
      .then(async (words) => {
        await query(
          `INSERT INTO word_lists (len, words, provider, fetched_at) VALUES ($1, $2, $3, now())
           ON CONFLICT (len) DO UPDATE SET words = EXCLUDED.words, provider = EXCLUDED.provider, fetched_at = now()`,
          [len, words.join(' '), wordSource.PROVIDER]);
        return { words, fetchedAt: new Date() };
      })
      .finally(() => inflight.delete(len)));
  }
  return inflight.get(len);
}

// Sneaky Hangman's word list for one word length: online words, cached for a week.
export const GET = route(async (request) => {
  const len = Number(new URL(request.url).searchParams.get('len'));
  if (!WORD_LENGTHS.includes(len)) throw new HttpError(400, 'Word length must be 4 to 7.');
  const cached = (await query('SELECT words, provider, fetched_at FROM word_lists WHERE len = $1', [len])).rows[0];
  const stale = !cached || Date.now() - new Date(cached.fetched_at).getTime() > FRESH_DAYS * 86400 * 1000;
  if (!stale) return { len, words: cached.words.split(' '), provider: cached.provider, source: 'online', fetchedAt: cached.fetched_at };
  try {
    const fresh = await refresh(len);
    return { len, words: fresh.words, provider: wordSource.PROVIDER, source: 'online', fetchedAt: fresh.fetchedAt };
  } catch (e) {
    console.error(new Date().toISOString(), 'word service failed:', e.message);
    if (cached) return { len, words: cached.words.split(' '), provider: cached.provider, source: 'online', fetchedAt: cached.fetched_at, stale: true };
    return { len, words: wordSource.fallback(len), provider: 'WNI backup list', source: 'fallback', fetchedAt: null };
  }
});
