import { ipAddress } from '@vercel/functions';
import { getAuthService } from '../../../../server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request: Request) {
  try {
    const auth = getAuthService();
    if (request.headers.get('host') !== new URL(auth.origin).host) {
      return Response.json({ error: 'Untrusted request host.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
    }
    // Only Vercel's ingress is trusted to supply these headers. Locally, requests
    // share a rate-limit bucket; arbitrary forwarded headers never select it.
    const ip = process.env.VERCEL === '1' ? ipAddress(request) : undefined;
    return await auth.handle(request, { ip });
  } catch {
    return Response.json({ error: 'Authentication is temporarily unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}

export { handle as GET, handle as POST };
