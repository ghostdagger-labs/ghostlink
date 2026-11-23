---
description: "Use persistent local SQLite for a Node host, with explicit ownership, backups, and storage conformance."
updated: '2026-11-23'
---
# SQLite

## Create durable storage

SQLite is the simplest option for a single persistent Node deployment. The adapter uses Node 24's built-in SQLite API and initializes its schema when opened.

<!-- docs-check: sqlite.ts -->
```ts
import { createSqliteStorage } from '@ghostdagger/ghostlink-server/sqlite';
import { createGhostlinkServer } from '@ghostdagger/ghostlink-server/server';

const storage = createSqliteStorage('/var/lib/my-app/ghostlink.sqlite');
const auth = createGhostlinkServer({
  origin: 'https://app.example',
  loginUri: 'https://app.example/login',
  networks: ['mainnet'],
  storage,
});
export { auth };
// After your server has drained all requests:
export function shutdown() { storage.close?.(); }
```

Use a path writable by the application user. The adapter creates parent directories and applies private file permissions. The database contains browser bindings, challenges, session hashes and receipts, and rate limits.

## Persistence and concurrency

The adapter enables WAL, foreign keys, transactions, and a busy timeout. Schema version 1 is stored in SQLite's `user_version`; unknown future versions are rejected.

Keep the database on a filesystem with reliable SQLite locking. In a container, mount a persistent volume for the database directory. Do not remove that volume when replacing the container.

> [!WARNING]
> Instance-local SQLite is not shared storage for independently scaled serverless functions. Use [Postgres/Neon](../integration/postgres.md) when requests can reach different instances or local files are ephemeral.

## Backups and cleanup

Use a consistent SQLite backup mechanism, accounting for WAL state. Copying a live database file alone can miss committed data. Restrict access to backups and signed authentication receipts.

Expiry is enforced when records are accessed. The authentication server invokes storage pruning on authentication requests; stale records do not authorize a session while waiting for pruning.

## Changing storage

Moving to Postgres does not automatically migrate SQLite records. Plan for existing sessions to end unless you separately implement and review a migration. The frontend authentication API remains the same.

## Custom implementations

A custom store must implement the asynchronous `GhostlinkStorage` interface and coordinate challenge consumption, login rotation, revocation, and rate limits atomically. Run `assertStorageConformance` only against an isolated empty test store; it writes test records.

Read the [Server/storage API](../reference/server.md) and [security model](../security/model.md) for the exact guarantees.
