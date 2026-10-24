/*
 * PostgreSQL pool and schema setup. Connection settings come from the standard PG* environment
 * variables (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE).
 */
import { Pool } from 'pg';
import { SCHEMA } from './schema.js';

// One pool per server process, kept across hot reloads in development.
const g = globalThis;
if (!g.__wniPool) g.__wniPool = new Pool({ max: 10 });
export const pool = g.__wniPool;

// Creates or updates the tables once per process, waiting for the database to come up.
export function ready() {
  if (!g.__wniReady) {
    g.__wniReady = (async () => {
      for (let attempt = 1; ; attempt++) {
        try {
          await pool.query(SCHEMA);
          return true;
        } catch (e) {
          if (attempt >= 30) { g.__wniReady = null; throw e; }
          await new Promise((r) => setTimeout(r, 1000));
        }
      }
    })();
  }
  return g.__wniReady;
}

export async function query(text, params) {
  await ready();
  return pool.query(text, params);
}
