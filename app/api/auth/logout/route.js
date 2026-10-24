import { endSession } from '@/lib/server/auth.js';
import { route } from '@/lib/server/http.js';

export const POST = route(async () => {
  await endSession();
  return { ok: true };
});
