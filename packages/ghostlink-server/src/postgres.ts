import type { AuthSession } from '@ghostdagger/ghostlink-core';
import type { BrowserRecord, ChallengeRecord, GhostlinkStorage } from './storage.js';

/** Structural subset shared by pg and @neondatabase/serverless Pool clients. */
export interface PostgresConnection {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
  release(destroy?: boolean): void;
}
/** Supply a writable primary pool. Read replicas and HTTP-only query functions are not supported. */
export interface PostgresPool {
  connect(): Promise<PostgresConnection>;
}
/** Isolate each application/environment in its own schema or database. */
export interface PostgresStorageOptions {
  /** Owned schema, default ghostlink. Lowercase SQL identifier, at most 63 characters. */
  schema?: string;
}

function namespace(options: PostgresStorageOptions): string {
  const schema = options.schema ?? 'ghostlink';
  if (!/^[a-z_][a-z0-9_]{0,62}$/.test(schema) || schema === 'public' || schema.startsWith('pg_') || schema === 'information_schema') {
    throw new Error('Use a dedicated lowercase Postgres schema name (at most 63 characters).');
  }
  return `"${schema}"`;
}

async function connection<T>(pool: PostgresPool, work: (client: PostgresConnection) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try { return await work(client); }
  finally { client.release(); }
}

async function transaction<T>(pool: PostgresPool, work: (client: PostgresConnection) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  let destroy = false;
  try {
    // A fresh snapshot after acquiring the browser lock is essential. Do not inherit
    // a pool/database default of REPEATABLE READ, or reuse a caller's transaction.
    await client.query('BEGIN ISOLATION LEVEL READ COMMITTED');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    try { await client.query('ROLLBACK'); } catch { destroy = true; }
    // Never retry an ambiguous commit: the challenge may already be consumed.
    throw error;
  } finally { client.release(destroy); }
}

/** Apply the versioned schema once during deployment, using a migration role. Safe to call concurrently. The caller owns the pool and must await pool.end() when finished. */
export async function migratePostgresStorage(pool: PostgresPool, options: PostgresStorageOptions = {}): Promise<void> {
  const ns = namespace(options);
  await transaction(pool, async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`ghostlink:migrate:${ns}`]);
    await client.query(`CREATE SCHEMA IF NOT EXISTS ${ns}`);
    await client.query(`CREATE TABLE IF NOT EXISTS ${ns}.schema_version (singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton), version INTEGER NOT NULL)`);
    const version = (await client.query(`SELECT version FROM ${ns}.schema_version WHERE singleton=TRUE`)).rows[0]?.version;
    if (version !== undefined && version !== 1) throw new Error('Unsupported Ghostlink Postgres storage schema.');
    if (version === 1) return;
    await client.query(`
      CREATE TABLE ${ns}.browsers (hash TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires BIGINT NOT NULL);
      CREATE INDEX ON ${ns}.browsers (expires);
      CREATE TABLE ${ns}.challenges (
        id TEXT PRIMARY KEY, browser TEXT NOT NULL UNIQUE REFERENCES ${ns}.browsers(hash) ON DELETE CASCADE,
        expires BIGINT NOT NULL, data JSONB NOT NULL
      );
      CREATE INDEX ON ${ns}.challenges (expires);
      CREATE TABLE ${ns}.sessions (
        hash TEXT PRIMARY KEY, browser TEXT NOT NULL UNIQUE REFERENCES ${ns}.browsers(hash) ON DELETE CASCADE,
        expires BIGINT NOT NULL, last_seen BIGINT NOT NULL, data JSONB NOT NULL, receipt JSONB NOT NULL
      );
      CREATE INDEX ON ${ns}.sessions (expires);
      CREATE TABLE ${ns}.limits (key TEXT PRIMARY KEY, expires BIGINT NOT NULL, count BIGINT NOT NULL);
      CREATE INDEX ON ${ns}.limits (expires);
      INSERT INTO ${ns}.schema_version (version) VALUES (1);
    `);
  });
}

/** Create a Postgres/Neon adapter after migratePostgresStorage. No I/O or pool ownership: share a bounded pool, and await pool.end() at shutdown. All security operations use the writable primary. */
export function createPostgresStorage(pool: PostgresPool, options: PostgresStorageOptions = {}): GhostlinkStorage {
  const ns = namespace(options);
  const query = (sql: string, values?: unknown[]) => connection(pool, client => client.query(sql, values));
  // Every operation that replaces/consumes/revokes browser state takes this lock
  // first, so logout also orders against logins on other function instances.
  const lockBrowser = async (client: PostgresConnection, hash: string) =>
    (await client.query(`SELECT expires FROM ${ns}.browsers WHERE hash=$1 FOR UPDATE`, [hash])).rows[0];
  return {
    async getBrowser(hash, now) {
      const row = (await query(`SELECT hash, csrf, expires FROM ${ns}.browsers WHERE hash=$1 AND expires>$2`, [hash, now])).rows[0];
      return row ? { hash: row.hash, csrf: row.csrf, expiresAt: Number(row.expires) } as BrowserRecord : null;
    },
    async putBrowser(browser) {
      await query(`INSERT INTO ${ns}.browsers (hash, csrf, expires) VALUES ($1, $2, $3)`, [browser.hash, browser.csrf, browser.expiresAt]);
    },
    async putChallenge(challenge) {
      await transaction(pool, async client => {
        if (!await lockBrowser(client, challenge.browserHash)) throw new Error('Unknown Ghostlink browser.');
        await client.query(`DELETE FROM ${ns}.challenges WHERE browser=$1`, [challenge.browserHash]);
        await client.query(`INSERT INTO ${ns}.challenges (id, browser, expires, data) VALUES ($1, $2, $3, $4::jsonb)`,
          [challenge.id, challenge.browserHash, Date.parse(challenge.expiresAt), JSON.stringify(challenge)]);
      });
    },
    async getChallenge(id, browserHash) {
      const row = (await query(`SELECT data FROM ${ns}.challenges WHERE id=$1 AND browser=$2`, [id, browserHash])).rows[0];
      return row ? row.data as ChallengeRecord : null;
    },
    async commitLogin(id, browserHash, now, record) {
      return transaction(pool, async client => {
        const browser = await lockBrowser(client, browserHash);
        if (!browser || Number(browser.expires) <= now || record.browserHash !== browserHash) return false;
        const consumed = await client.query(`DELETE FROM ${ns}.challenges WHERE id=$1 AND browser=$2 AND expires>$3 RETURNING id`, [id, browserHash, now]);
        if (!consumed.rows.length) return false;
        await client.query(`DELETE FROM ${ns}.sessions WHERE browser=$1`, [browserHash]);
        await client.query(`INSERT INTO ${ns}.sessions (hash, browser, expires, last_seen, data, receipt) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
          [record.hash, browserHash, Date.parse(record.session.expiresAt), record.lastSeen, JSON.stringify(record.session), JSON.stringify(record.receipt)]);
        return true;
      });
    },
    async getSession(hash, browserHash, now, idleMs) {
      // UPDATE checks expiry and touches activity in one statement; a concurrent
      // logout cannot be undone by writing back a previously read session.
      const row = (await query(`UPDATE ${ns}.sessions SET last_seen=GREATEST(last_seen, $3)
        WHERE hash=$1 AND browser=$2 AND expires>$3 AND last_seen>$3::bigint-$4::bigint
        AND EXISTS (SELECT 1 FROM ${ns}.browsers WHERE hash=$2 AND expires>$3)
        RETURNING data, expires, last_seen`, [hash, browserHash, now, idleMs])).rows[0];
      return row ? { ...row.data as AuthSession, idleExpiresAt: new Date(Math.min(Number(row.expires), Number(row.last_seen) + idleMs)).toISOString() } : null;
    },
    async revokeBrowser(browserHash) {
      await transaction(pool, async client => {
        if (!await lockBrowser(client, browserHash)) return;
        await client.query(`DELETE FROM ${ns}.challenges WHERE browser=$1`, [browserHash]);
        await client.query(`DELETE FROM ${ns}.sessions WHERE browser=$1`, [browserHash]);
      });
    },
    async consumeRateLimit(key, now, windowMs, maximum) {
      const row = (await query(`INSERT INTO ${ns}.limits AS limits (key, expires, count) VALUES ($1, $2, 1)
        ON CONFLICT (key) DO UPDATE SET
          count=CASE WHEN limits.expires<=$3 THEN 1 ELSE limits.count+1 END,
          expires=CASE WHEN limits.expires<=$3 THEN EXCLUDED.expires ELSE limits.expires END
        RETURNING count`, [key, now + windowMs, now])).rows[0]!;
      return Number(row.count) <= maximum;
    },
    async prune(now) {
      // Separate deletes avoid holding locks across unrelated record classes.
      // Expiry is enforced on access even if maintenance fails or runs late.
      await query(`DELETE FROM ${ns}.browsers WHERE expires<=$1`, [now]);
      await query(`DELETE FROM ${ns}.challenges WHERE expires<=$1`, [now]);
      await query(`DELETE FROM ${ns}.sessions WHERE expires<=$1`, [now]);
      await query(`DELETE FROM ${ns}.limits WHERE expires<=$1`, [now]);
    },
  };
}
