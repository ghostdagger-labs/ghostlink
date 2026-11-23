# @ghostdagger/ghostlink-server

Node 24 authentication verification, Web handlers, Node HTTP adapter and durable SQLite or Postgres/Neon sessions for Ghostlink.

```ts
import { createGhostlinkServer, createSqliteStorage, createNodeHandler } from '@ghostdagger/ghostlink-server';
const storage = createSqliteStorage('./data/auth.sqlite');
const auth = createGhostlinkServer({
  origin: 'https://app.example', loginUri: 'https://app.example/login',
  networks: ['testnet-11'], storage,
});
// Web: await auth.handle(request, { ip: trustedPeerAddress });
// Node: createServer(createNodeHandler(auth)).listen(...);
// Protected route: await auth.getSession(request);
// Shutdown: storage.close();
```

Mount `/auth/ghostlink/{session,challenge,verify,logout}` on the same origin. The Node adapter validates Host and uses the socket peer for rate limits. Reverse proxies must preserve the trusted host. `getSession` supplies identity, not application authorization or CSRF protection for your own mutations.

## Postgres / Neon

Supply a `pg.Pool` or `@neondatabase/serverless.Pool` connected to a writable primary. Install your chosen driver separately. The adapter owns neither the driver nor the pool. Use separate entry points to avoid importing SQLite:

```ts
import { Pool } from '@neondatabase/serverless'; // Or 'pg'
import { createGhostlinkServer } from '@ghostdagger/ghostlink-server/server';
import { createPostgresStorage, migratePostgresStorage } from '@ghostdagger/ghostlink-server/postgres';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 3 });
// Run in a deployment migration step, before traffic (not on every request):
await migratePostgresStorage(pool, { schema: 'ghostlink' });
const storage = createPostgresStorage(pool, { schema: 'ghostlink' });
const auth = createGhostlinkServer({
  origin: 'https://app.example', loginUri: 'https://app.example/login',
  networks: ['testnet-11'], storage,
});
// Shutdown after active requests: await pool.end(); storage has no close().
```

The versioned migration is idempotent and serialized across clients. Use a separate schema/database per application and environment, TLS, server-only credentials, and a bounded pool. READ COMMITTED transactions and browser-row locks coordinate challenge replacement, single-use verification, rotation, and logout across server instances. Session activity and rate limits update atomically. Failures do not grant access or automatically retry an uncertain login commit. Read replicas and the HTTP-only Neon `neon()` function are not supported.

See the [Postgres guide](https://github.com/ghostdagger-labs/ghostlink/blob/main/docs/integration/postgres.md) and [complete Next.js/Vercel + Neon example](https://github.com/ghostdagger-labs/ghostlink/tree/main/examples/vercel-neon) for migrations, permissions, pool lifecycle, WASM packaging, environment setup, and testing. The Postgres adapter and dedicated entry points are included starting with `0.1.0-beta.2`. Existing SQLite root imports remain supported, with an additional `/sqlite` entry point.

Defaults: five-minute browser-bound single-use challenges, official Kaspa Schnorr/address checks, 24-hour absolute / 30-minute idle sessions, hashed opaque tokens, HttpOnly/Secure/SameSite=Lax host cookies, CSRF, origin checks, 16-KiB body limit, and persistent rate limits. HTTP requires explicit `allowInsecureLocalhost: true` and a loopback origin. No edge-runtime support.

Only standard Schnorr public-key addresses are accepted. Keys can be extracted from those addresses for manual Kaspium login. Server verification prevents replay and enforces the intended message/account/network, but generic message signing is not phishing-resistant. The profile is proposed; no CACAO interoperability or independent audit is claimed.

The official rusty-kaspa v2.0.1 Node WASM artifact is packaged unmodified with its ISC license and `vendor/provenance.json` checksums. Do not replace it with a similarly named unofficial npm package. New storage adapters must satisfy `GhostlinkStorage` and `assertStorageConformance` against an empty isolated test store, particularly atomic challenge consumption and session revocation.

Pre-release. See the repository's security and live-wallet acceptance documentation before deployment.

Beta acceptance status: live protected-API and real testnet transaction checks are deferred. Transaction APIs remain enabled; automated fixtures do not constitute real-wallet certification. See the [compatibility record](https://github.com/ghostdagger-labs/ghostlink/blob/main/docs/testing/compatibility-v1.json).
