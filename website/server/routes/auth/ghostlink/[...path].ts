import { ipAddress } from '@vercel/functions';
import { getAuthService } from '../../../utils/auth';
export default defineEventHandler(async event => {
  setHeader(event, 'Cache-Control', 'no-store');
  setHeader(event, 'X-Content-Type-Options', 'nosniff');
  try {
    const { auth } = getAuthService();
    if (event.node.req.headers.host !== new URL(auth.origin).host) {
      setResponseStatus(event, 400); return { error: 'Untrusted request host.' };
    }
    const request = toWebRequest(event);
    // Vercel's ingress supplies trusted peer metadata; other hosts use the socket.
    // The SDK bounds streamed JSON bodies and enforces origin and CSRF checks.
    const ip = process.env.VERCEL === '1' ? ipAddress(request) : event.node.req.socket.remoteAddress;
    return await sendWebResponse(event, await auth.handle(request, { ip }));
  } catch {
    setResponseStatus(event, 503); return { error: 'Authentication is temporarily unavailable.' };
  }
});
