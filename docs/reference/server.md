---
description: "Node server configuration, HTTP contracts, storage ownership, migrations, and low-level verification exports."
updated: '2026-11-23'
api:
  "@ghostdagger/ghostlink-server": ["createGhostlinkServer","createNodeHandler","GhostlinkServerConfig","RequestContext","createSqliteStorage","createPostgresStorage","migratePostgresStorage","PostgresPool","PostgresConnection","PostgresStorageOptions","GhostlinkStorage","BrowserRecord","ChallengeRecord","SessionRecord","assertStorageConformance","validateKaspaAddress","verifyKaspaSignature"]
---
# Server / storage API

## Entry points

| Import | Exports |
| --- | --- |
| `@ghostdagger/ghostlink-server` | All server, storage, Node adapter, and verification exports |
| `@ghostdagger/ghostlink-server/server` | `createGhostlinkServer`, `GhostlinkServerConfig`, `RequestContext` |
| `@ghostdagger/ghostlink-server/postgres` | Postgres adapter, migration, and pool/connection/options types |
| `@ghostdagger/ghostlink-server/sqlite` | SQLite adapter |

Use dedicated server/Postgres entry points to avoid importing SQLite on a Postgres host. All verification remains Node-only. Dedicated entry points and Postgres are available in beta.2.

## createGhostlinkServer

`createGhostlinkServer(config)` validates policy immediately and returns `origin`, `prefix`, `handle(request, context?)`, and `getSession(request)`. It does not start a listener or own database shutdown.

| Configuration | Default / requirement |
| --- | --- |
| `origin` | Required exact public origin, including port; no path or trailing slash |
| `loginUri` | Required absolute same-origin URI; no credentials or fragment |
| `storage` | Required `GhostlinkStorage` |
| `networks` | Mainnet, Testnet 10, and Testnet 11; nonempty supported list |
| `prefix` | `/auth/ghostlink`, without trailing slash |
| `allowInsecureLocalhost` | `false`; opt-in loopback HTTP only |
| `challengeTtlMs` | 300,000; positive and at most five minutes |
| `sessionTtlMs` | 86,400,000; positive safe integer |
| `idleTtlMs` | 1,800,000; positive safe integer |
| `clockSkewMs` | 30,000; permitted range 0–30,000 |
| `now` | `Date.now`; injectable clock in Unix milliseconds |

`handle()` returns a Web Response for the session, challenge, verify, and logout routes. It enforces browser binding, CSRF, exact origin, body bounds, replay prevention, and rate limits. Supply `RequestContext.ip` only from trusted ingress; without it, peer requests share a rate-limit bucket.

`getSession(request): Promise<AuthSession | null>` checks the browser/session cookies and expiry, refreshing idle activity. It can reject on storage failure. It supplies identity only: application authorization and mutation CSRF are separate responsibilities.

## HTTP endpoint contracts

The core transport manages these calls. All auth responses use `Cache-Control: no-store`. POSTs use JSON, an Origin header matching policy, browser cookies, and `X-Ghostlink-CSRF`.

| Endpoint | Input | Success response |
| --- | --- | --- |
| GET `/session` | Browser/session cookies | `{ session: AuthSession \| null, csrfToken: string }` |
| POST `/challenge` | `{ address, network }` | `AuthChallenge` |
| POST `/verify` | `{ challengeId, message, signature, publicKey? }` | `AuthSession` |
| POST `/logout` | Empty JSON object | `{ ok: true }` |

Errors expose `{ error, code }` with an appropriate failure status. Do not treat HTTP failure or uncertain storage commits as authentication success, and do not automatically retry a verification commit.

## Node adapter

`createNodeHandler(auth)` returns an async `(IncomingMessage, ServerResponse) => Promise<void>` handler. Mount it under `auth.prefix`. It validates Host, bounds bodies to 16 KiB, forwards every cookie header, and takes the peer address from the socket.

## Storage factories

`createSqliteStorage(path): GhostlinkStorage` opens/initializes persistent SQLite and owns a synchronous `close()`. The host calls it after requests drain.

`createPostgresStorage(pool, { schema? }?): GhostlinkStorage` uses an externally owned pool. Default schema: `ghostlink`. It performs no network I/O or migration on construction and has no close method.

`migratePostgresStorage(pool, { schema? }?): Promise<void>` runs the idempotent, serialized schema migration. Run it separately before traffic with migration credentials. Use writable-primary `pg.Pool` or Neon `Pool`, not replicas or the HTTP-only Neon helper.

`PostgresPool`, `PostgresConnection`, and `PostgresStorageOptions` describe the minimal driver interface. Release checked-out clients and let the host close the pool asynchronously.

## GhostlinkStorage

All stored times and method time arguments are Unix milliseconds.

| Methods | Required behavior |
| --- | --- |
| `getBrowser`, `putBrowser` | Persist browser binding, CSRF, and expiry |
| `putChallenge`, `getChallenge` | Replace outstanding browser challenges and read only within the binding |
| `commitLogin` | Atomically consume one valid challenge and rotate/create the session; return false if unusable |
| `getSession` | Enforce binding and expiry; atomically extend idle activity without resurrecting revoked rows |
| `revokeBrowser` | Revoke sessions and challenges across instances |
| `consumeRateLimit` | Atomically enforce the requested count/window |
| `prune` | Remove expired records |
| `close?` | Optional synchronous shutdown |

`BrowserRecord`, `ChallengeRecord`, and `SessionRecord` are exported storage types. Session records include a verification receipt; restrict access and backup permissions.

Run `assertStorageConformance(storage)` against an isolated empty store. It mutates test state and verifies concurrency-sensitive guarantees.

## Low-level verification

`validateKaspaAddress(value, network)` validates a canonical standard Schnorr public-key address/checksum and returns address, accountId, and publicKey. Unsupported or invalid addresses throw `INVALID_REQUEST`.

`verifyKaspaSignature(input)` returns a boolean for the exact message and a 64-byte lowercase hex Schnorr signature. It does not enforce login audience, expiry, browser binding, replay protection, or authorization; use the complete server for login.

Read [Node setup](../backend/node.md), [Postgres/Neon](../integration/postgres.md), and the [security model](../security/model.md) before deployment.
