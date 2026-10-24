// Sets up the database tables when the server starts, without holding up the first requests.
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { ready } = await import('./lib/server/db.js');
    ready().catch((e) => console.error('WNI could not set up the database yet:', e.message));
  }
}
