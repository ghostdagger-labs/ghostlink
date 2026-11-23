# Postgres and Neon storage

Ghostlink supports SQLite on persistent Node servers and Postgres on serverless or multi-instance servers. Both implement the same `GhostlinkStorage` contract. The Postgres adapter works with `pg.Pool` and `@neondatabase/serverless.Pool`; it has no runtime driver dependency. Use Node 24. Edge runtimes are not supported by Ghostlink's current Kaspa verifier.

This adapter is in the source checkout; the published `0.1.0-beta.1` package predates it. Use the workspace example or locally packed packages until the next SDK release. Keep all Ghostlink package versions matched.

## Connect and migrate

Install `pg` for standard Postgres or `@neondatabase/serverless` for Neon. Use the writable primary endpoint, with TLS for remote databases. Read replicas, eventually consistent caches, IndexedDB, and Neon's HTTP-only `neon()` function do not satisfy this adapter's interactive transaction requirements.

```ts
import { Pool } from '@neondatabase/serverless'; // Or: import { Pool } from 'pg';
import { migratePostgresStorage } from '@ghostdagger/ghostlink-server/postgres';

const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  await migratePostgresStorage(pool, { schema: 'ghostlink' });
} finally {
  await pool.end();
}
```

Run migrations before serving traffic, separately from request handlers. Migration creates an owned schema, a version table, browser bindings, challenges, sessions/receipts, rate limits, and expiry indexes. A transaction-scoped advisory lock serializes concurrent migrations. Migration is idempotent and rejects unknown versions. No SQLite data is migrated; switching stores signs existing users out unless you separately implement and review a data migration.

The default schema is `ghostlink`. Use a distinct schema/database per application and deployment environment. Names must be lowercase SQL identifiers of at most 63 characters; system schemas and `public` are rejected. The adapter quotes validated identifiers and parameterizes record values. Do not allow request input to choose the schema or connection string.

Use an owner/migration connection for DDL. The request-time role needs `USAGE` on the schema and `SELECT, INSERT, UPDATE, DELETE` on its data tables; it does not need to create or drop tables. For example, after creating your runtime role through your database administration tools:

```sql
GRANT USAGE ON SCHEMA ghostlink TO ghostlink_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON ghostlink.browsers, ghostlink.challenges, ghostlink.sessions, ghostlink.limits
  TO ghostlink_runtime;
```

Keep schema ownership and all database credentials on the server. Do not grant browser clients access to these tables. Receipts contain signed login messages and wallet addresses; restrict their access along with the rest of the authentication state.

## Create the server

```ts
import { Pool } from '@neondatabase/serverless';
import { createGhostlinkServer } from '@ghostdagger/ghostlink-server/server';
import { createPostgresStorage } from '@ghostdagger/ghostlink-server/postgres';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 3,
  idleTimeoutMillis: 5000,
  connectionTimeoutMillis: 10000,
});
pool.on('error', () => console.error('Authentication database connection failed.'));
const storage = createPostgresStorage(pool, { schema: 'ghostlink' });
const auth = createGhostlinkServer({
  origin: 'https://app.example',
  loginUri: 'https://app.example/login',
  networks: ['testnet-11'],
  storage,
});

// Same-origin Node Web handler:
// return auth.handle(request, { ip: trustedIngressAddress });
// Protected application handler:
// const session = await auth.getSession(request);
// On graceful server shutdown, after requests finish: await pool.end();
```

`createPostgresStorage` performs no migration or network I/O at construction, does not own the supplied pool, and does not implement `storage.close()`. The host owns `await pool.end()`. Do not close a shared pool after each request. Keep its maximum small relative to your database's connection limit and expected number of function instances. Neon pooled endpoints are supported: every transaction uses one checked-out connection and transaction-scoped locks, without relying on session-scoped state.

The `/server` and `/postgres` entry points avoid importing `node:sqlite`. Existing root imports, including `createSqliteStorage`, remain compatible; `/sqlite` is also available as a dedicated entry point. The generic server remains Node-only even when SQLite is not imported.

## Preserved security behavior

- Cookie tokens remain opaque and hashed in storage. Production cookies retain HttpOnly, Secure, SameSite=Lax, `__Host-`, and host-only scope.
- Browser binding, CSRF, trusted origin, network/address checks, exact-message signature verification, and body limits remain in the shared server implementation.
- Challenge replacement, login, and logout lock the same browser row, then operate inside a READ COMMITTED transaction. Only one concurrent verification can consume a challenge. Session creation failure rolls back consumption and preserves the previous session.
- Login rotates the session. Logout revokes existing sessions and outstanding challenges across function instances, including a verification racing logout. A fresh challenge created after logout can intentionally start a new login.
- Session checks enforce absolute/idle expiry and update activity atomically. An older request cannot move activity backwards. Updates cannot recreate a row deleted by logout. A request already authorized before logout may finish; revocation governs subsequent checks.
- Rate limits use atomic database increments. Ingress abuse limits should supplement them. Without trusted peer metadata the server deliberately uses a shared peer bucket.
- Storage failures fail closed. Authentication handlers return an error; protected routes must handle rejected `getSession()` calls without granting access. Failed or uncertain commits are not automatically retried.

Expiry is checked on access, independently of cleanup. The server currently invokes `prune()` on auth endpoint requests; the adapter deletes expired rows through indexed expiry columns. Sessions/receipts are retained until absolute expiry cleanup even after idle expiry. Account for network round trips and write load: protected session reads touch idle activity, and auth endpoints also perform rate limits and pruning. Place functions near the primary database. Do not cache an authenticated session across requests or use a replica for authorization.

## Verification

CI tests Postgres 16 and 18, the `pg` driver, and the Neon WebSocket driver against real Postgres. The local WebSocket bridge is a test fixture only; deployed Neon clients retain their normal TLS defaults. CI also builds the Next.js example, verifies function WASM traces, and exercises browser login/restoration/logout. This does not certify a live Neon/Vercel account or real wallet extension version.

```sh
docker run --rm -d --name ghostlink-postgres-test \
  -e POSTGRES_USER=ghostlink -e POSTGRES_PASSWORD=ghostlink-test \
  -e POSTGRES_DB=ghostlink_test -p 127.0.0.1:55439:5432 postgres:18-alpine
export GHOSTLINK_TEST_DATABASE_URL=postgresql://ghostlink:ghostlink-test@127.0.0.1:55439/ghostlink_test
pnpm test:postgres
pnpm build:vercel
pnpm test:vercel
docker stop ghostlink-postgres-test
```

Tests create and drop randomly named schemas; use an isolated test database and an owner connection. They do not silently skip when the database URL is absent. SQLite continues to run the same expanded conformance suite in `pnpm test`.

See the [complete Vercel + Neon example](../../examples/vercel-neon/README.md), [security model](../security/model.md), [Neon driver documentation](https://neon.com/docs/serverless/serverless-driver), and [Vercel connection-pool guidance](https://vercel.com/docs/functions/functions-api-reference/vercel-functions-package#attachdatabasepool).
