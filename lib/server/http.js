/* Small helpers shared by the API route handlers: JSON replies, errors, body parsing, origin check, rate limits. */
import { NextResponse } from 'next/server';

const TRUST_PROXY = process.env.TRUST_PROXY === 'true';

export class HttpError extends Error {
  constructor(status, message, field) {
    super(message);
    this.status = status;
    this.field = field;
  }
}

export function json(body, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } });
}

// The visitor's address, used as one rate-limit key. Next fills x-forwarded-for from the socket when the
// client did not send one, so it can be faked without a reverse proxy; limits keyed on email, user or
// the whole site back it up.
export function clientIp(request) {
  return (request.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
}

function siteHost(request) {
  return (TRUST_PROXY && request.headers.get('x-forwarded-host')) || request.headers.get('host');
}

// Cross-site form posts cannot send JSON, and a foreign Origin is refused outright.
function checkOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin) return;
  let host = null;
  try { host = new URL(origin).host; } catch (e) { host = null; }
  if (host !== siteHost(request)) throw new HttpError(403, 'Requests must come from this site.');
}

export async function readJson(request) {
  const type = request.headers.get('content-type') || '';
  if (!type.startsWith('application/json')) throw new HttpError(415, 'Send JSON, please.');
  const text = await request.text();
  if (text.length > 16 * 1024) throw new HttpError(413, 'That request is too big.');
  try { return JSON.parse(text || '{}'); } catch (e) { throw new HttpError(400, 'That request was not valid JSON.'); }
}

// Wraps a handler: origin check for writes, JSON errors, no stack traces to the client.
export function route(fn) {
  return async function handler(request, ctx) {
    try {
      if (request.method !== 'GET') checkOrigin(request);
      const out = await fn(request, ctx);
      return out instanceof Response ? out : json(out);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, field: e.field }, e.status);
      console.error(new Date().toISOString(), request.method, new URL(request.url).pathname, e);
      return json({ error: 'Something went wrong on the server. Please try again.' }, 500);
    }
  };
}

// Fixed-window counters in memory. Good enough for one app container.
const g = globalThis;
if (!g.__wniBuckets) g.__wniBuckets = new Map();
const buckets = g.__wniBuckets;
export function limited(key, max, windowMs) {
  const now = Date.now();
  if (buckets.size > 50000) for (const [k, b] of buckets) if (b.reset <= now) buckets.delete(k);
  let b = buckets.get(key);
  if (!b || b.reset <= now) { b = { n: 0, reset: now + windowMs }; buckets.set(key, b); }
  b.n++;
  return b.n > max;
}
