import { getAuthService } from '../utils/auth';
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store');
  try {
    const { auth } = getAuthService();
    const req = event.node.req;
    if (req.method !== 'GET' || req.headers.host !== new URL(auth.origin).host || req.headers['sec-fetch-site'] === 'cross-site') {
      setResponseStatus(event, 403); return { error: 'Forbidden.' };
    }
    const session = await auth.getSession(new Request(`${auth.origin}/api/private`, { headers: { cookie: req.headers.cookie ?? '' } }));
    setResponseStatus(event, session ? 200 : 401);
    return session ? { message: 'Your protected backend request succeeded.', accountId: session.accountId } : { error: 'Sign in first.' };
  } catch {
    setResponseStatus(event, 503); return { error: 'Authentication is temporarily unavailable.' };
  }
});
