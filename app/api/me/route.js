import { currentUser, publicUser } from '@/lib/server/auth.js';
import { route } from '@/lib/server/http.js';

export const GET = route(async () => ({ user: publicUser(await currentUser()) }));
