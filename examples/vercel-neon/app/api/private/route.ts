import { getAuthService } from '../../../server/auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const headers = { 'Cache-Control': 'no-store', 'Vary': 'Cookie, Origin' };
  try {
    const auth = getAuthService();
    const supplied = request.headers.get('origin');
    if (request.headers.get('host') !== new URL(auth.origin).host || new URL(request.url).origin !== auth.origin || request.headers.get('sec-fetch-site') === 'cross-site' || (supplied !== null && supplied !== auth.origin)) {
      return Response.json({ error: 'Untrusted request origin.' }, { status: 403, headers });
    }
    const session = await auth.getSession(request);
    if (!session) return Response.json({ error: 'Sign in first.' }, { status: 401, headers });
    // Identity alone is sufficient for this read-only demo. Real application
    // operations must also check permissions, and mutations need CSRF protection.
    return Response.json({ message: 'Protected request succeeded.', accountId: session.accountId }, { headers });
  } catch {
    return Response.json({ error: 'Authentication is temporarily unavailable.' }, { status: 503, headers });
  }
}
