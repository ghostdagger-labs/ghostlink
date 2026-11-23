---
description: "Configure a same-origin Node verification backend, mount its handlers, and protect application requests."
updated: '2026-11-23'
---
# Node server setup

## Choose storage

Use Node 24 and `@ghostdagger/ghostlink-server@0.1.0-beta.2`. Choose [SQLite](sqlite.md) for a persistent Node host or [Postgres/Neon](../integration/postgres.md) for shared storage across instances.

Keep this module in server-only code. Creating a server does not start an HTTP listener.

<!-- docs-check: backend.ts -->
```ts
import { createGhostlinkServer, createNodeHandler, createSqliteStorage } from '@ghostdagger/ghostlink-server';

const origin = process.env.GHOSTLINK_ORIGIN ?? 'http://127.0.0.1:5173';
const storage = createSqliteStorage('.data/ghostlink.sqlite');
export const auth = createGhostlinkServer({
  origin,
  loginUri: origin + '/',
  networks: ['testnet-11'],
  storage,
  allowInsecureLocalhost: true,
});
export const handleAuth = createNodeHandler(auth);
export function closeStorage() { storage.close?.(); }
```

`allowInsecureLocalhost` only permits loopback HTTP; it never permits an arbitrary public HTTP origin. Set the exact HTTPS origin in production.

## Mount the handlers

Mount `handleAuth(req, res)` under `/auth/ghostlink/*` in your Node server. For frameworks exposing Web Requests, return `auth.handle(request, { ip })` and preserve the complete response, including every Set-Cookie header.

| Route | Method | Purpose |
| --- | --- | --- |
| `/auth/ghostlink/session` | GET | Read session and bootstrap browser binding/CSRF |
| `/auth/ghostlink/challenge` | POST | Create a challenge for the account/network |
| `/auth/ghostlink/verify` | POST | Verify the exact signed challenge and establish the session |
| `/auth/ghostlink/logout` | POST | Revoke sessions and challenges for this browser |

Use `createAuthClient` through the core's default transport rather than manually managing CSRF tokens. All these browser requests use the same public origin.

The [Vue backend walkthrough](../integration/vue.md#3-add-the-backend) supplies a complete Node HTTP listener, static frontend serving, error handling, and graceful shutdown. The React walkthrough uses the same backend. Those examples use Testnet 10; match their frontend or explicitly change both sides to Testnet 11 when combining them with this page.

## Protect an application endpoint

The following Web handler returns verified metadata for the headless example. Mount it at `/api/private` using your framework's Web Request adapter.

<!-- docs-check: protected-api.ts -->
```ts
import type { createGhostlinkServer } from '@ghostdagger/ghostlink-server/server';

export async function privateProfile(
  request: Request,
  auth: ReturnType<typeof createGhostlinkServer>,
) {
  const headers = { 'Cache-Control': 'no-store' };
  if (request.method !== 'GET') {
    return Response.json({ error: 'Use GET' }, { status: 405, headers: { ...headers, Allow: 'GET' } });
  }
  if (new URL(request.url).origin !== auth.origin ||
      request.headers.get('sec-fetch-site') === 'cross-site' ||
      (request.headers.has('origin') && request.headers.get('origin') !== auth.origin)) {
    return Response.json({ error: 'Untrusted origin' }, { status: 403, headers });
  }
  try {
    const session = await auth.getSession(request);
    if (!session) return Response.json({ error: 'Sign in first' }, { status: 401, headers });
    return Response.json({ address: session.address, accountId: session.accountId }, { headers });
  } catch {
    return Response.json({ error: 'Authentication unavailable' }, { status: 503, headers });
  }
}
```

For resources owned by a user, look up permissions using the verified `accountId`. Authentication is not authorization. Add CSRF checks, input validation, and application rate limits for your own state-changing handlers.

## Reverse proxies and deployment

Preserve the configured Host header. Supply peer addresses only from your trusted ingress or socket; arbitrary forwarded headers are untrusted. The Node adapter validates Host, limits request bodies, and uses the socket peer for rate limiting.

Keep the bundled Kaspa JS loader and WASM alongside the server package in production output. Do not deploy the verifier to an edge runtime or serve its assets to the browser. See [Vercel deployment](../../examples/vercel-neon/README.md) or the repository's [Nuxt build configuration](../../website/nuxt.config.ts).

## Shut down cleanly

Stop accepting requests, let in-flight work finish, and call `storage.close?.()` for SQLite. With Postgres, the host instead owns `await pool.end()`. Construction, ordinary requests, and builds must not implicitly migrate Postgres.
