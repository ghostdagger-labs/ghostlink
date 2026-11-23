import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Pool as PgPool } from 'pg';
import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless';
import { WebSocket } from 'ws';
import { createPostgresStorage, migratePostgresStorage, type PostgresPool, type PostgresConnection } from '../../packages/ghostlink-server/src/postgres';
import { assertStorageConformance } from '../../packages/ghostlink-server/src/storage-conformance';
import type { ChallengeRecord, SessionRecord } from '../../packages/ghostlink-server/src/storage';
import { createGhostlinkServer } from '../../packages/ghostlink-server/src/server';
import { account, sign } from '../fixtures/keys';
import { startNeonProxy } from './neon-proxy';

const connectionString = process.env.GHOSTLINK_TEST_DATABASE_URL!;
interface TestPool extends PostgresPool {
  query: PostgresConnection['query'];
  end(): Promise<void>;
  readonly idleCount: number;
  readonly totalCount: number;
}
const now = Date.parse('2026-11-22T12:00:00Z');
const browser = (hash = 'a') => ({ hash, csrf: 'csrf', expiresAt: now + 10000 });
const challenge = (id = 'c', browserHash = 'a'): ChallengeRecord => ({ id, browserHash, ...account, profile: 'ghostlink-kaspa-v1', message: 'fixture', issuedAt: now, expiresAt: new Date(now + 1000).toISOString() });
const session = (hash = 's', browserHash = 'a'): SessionRecord => ({
  hash, browserHash, lastSeen: now,
  session: { ...account, accountId: 'fixture', chainId: 'kaspa:testnet-11', issuedAt: new Date(now).toISOString(), expiresAt: new Date(now + 4000).toISOString(), idleExpiresAt: new Date(now + 2000).toISOString() },
  receipt: { profile: 'ghostlink-kaspa-v1', message: 'fixture', signature: 'fixture' },
});
function gate() {
  let resolve!: () => void;
  const promise = new Promise<void>(r => { resolve = r; });
  return { promise, resolve };
}

let proxy: Awaited<ReturnType<typeof startNeonProxy>>;
beforeAll(async () => {
  proxy = await startNeonProxy(connectionString);
  neonConfig.wsProxy = () => proxy.address;
  neonConfig.useSecureWebSocket = false;
  neonConfig.webSocketConstructor = WebSocket;
  neonConfig.pipelineConnect = false;
});
afterAll(async () => { await proxy?.close(); });

describe.each(['pg', 'neon'] as const)('%s Postgres storage', driver => {
  let pool: TestPool;
  let peerPool: TestPool;
  let schema: string;
  let store: ReturnType<typeof createPostgresStorage>;
  let peer: ReturnType<typeof createPostgresStorage>;
  beforeEach(async () => {
    const Constructor = driver === 'pg' ? PgPool : NeonPool;
    pool = new Constructor({ connectionString, max: 8, connectionTimeoutMillis: 5000 });
    peerPool = new Constructor({ connectionString, max: 8, connectionTimeoutMillis: 5000 });
    schema = `gl_test_${randomUUID().replaceAll('-', '')}`;
    await migratePostgresStorage(pool, { schema });
    store = createPostgresStorage(pool, { schema });
    peer = createPostgresStorage(peerPool, { schema });
  });
  afterEach(async () => {
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await Promise.all([pool.end(), peerPool.end()]);
  });

  it('passes the reusable contract across independent clients', async () => {
    await assertStorageConformance(store, peer);
  });
  it('migrates concurrently, is idempotent, and refuses unknown versions', async () => {
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
    await Promise.all([migratePostgresStorage(pool, { schema }), migratePostgresStorage(peerPool, { schema })]);
    await store.putBrowser(browser());
    await migratePostgresStorage(pool, { schema });
    expect(await peer.getBrowser('a', now)).not.toBeNull();
    await pool.query(`UPDATE "${schema}".schema_version SET version=2`);
    await expect(migratePostgresStorage(pool, { schema })).rejects.toThrow('Unsupported');
  });
  it('allows only one concurrent commit and persists across pool recreation', async () => {
    await store.putBrowser(browser()); await store.putChallenge(challenge());
    const results = await Promise.all(Array.from({ length: 16 }, (_, i) => (i % 2 ? peer : store).commitLogin('c', 'a', now, session(`s${i}`))));
    expect(results.filter(Boolean)).toHaveLength(1);
    const winner = `s${results.indexOf(true)}`;
    await peerPool.end();
    peerPool = driver === 'pg' ? new PgPool({ connectionString }) : new NeonPool({ connectionString });
    peer = createPostgresStorage(peerPool, { schema });
    expect(await peer.getSession(winner, 'a', now, 2000)).not.toBeNull();
    await peer.revokeBrowser('a');
    expect(await store.getSession(winner, 'a', now, 2000)).toBeNull();
    expect(await store.commitLogin('c', 'a', now, session())).toBe(false);
  });
  it('serializes concurrent challenge replacement and atomically enforces rate limits', async () => {
    await store.putBrowser(browser());
    await Promise.all(Array.from({ length: 12 }, (_, i) => (i % 2 ? peer : store).putChallenge(challenge(`c${i}`))));
    const challenges = await pool.query(`SELECT id FROM "${schema}".challenges`);
    expect(challenges.rows).toHaveLength(1);
    const allowed = await Promise.all(Array.from({ length: 30 }, (_, i) => (i % 2 ? peer : store).consumeRateLimit('same', now, 1000, 5)));
    expect(allowed.filter(Boolean)).toHaveLength(5);
    expect(await peer.consumeRateLimit('same', now + 1000, 1000, 5)).toBe(true);
  });
  it('rolls back challenge consumption and session rotation on insertion failure', async () => {
    await store.putBrowser(browser()); await store.putBrowser(browser('b'));
    await store.putChallenge(challenge()); await store.commitLogin('c', 'a', now, session('old'));
    await store.putChallenge(challenge('other', 'b')); await store.commitLogin('other', 'b', now, session('collision', 'b'));
    await store.putChallenge(challenge('new'));
    await expect(peer.commitLogin('new', 'a', now, session('collision'))).rejects.toThrow();
    expect(await store.getSession('old', 'a', now, 2000)).not.toBeNull();
    expect(await store.getChallenge('new', 'a')).not.toBeNull();
    expect(await store.commitLogin('new', 'a', now, session('fresh'))).toBe(true);
    expect(await peer.getSession('old', 'a', now, 2000)).toBeNull();
  });
  it('rejects expired browser bindings and mismatched session records without consuming a challenge', async () => {
    await store.putBrowser(browser()); await store.putChallenge(challenge());
    expect(await peer.commitLogin('c', 'a', now, session('s', 'b'))).toBe(false);
    expect(await peer.commitLogin('c', 'missing', now, session())).toBe(false);
    await pool.query(`UPDATE "${schema}".browsers SET expires=$1`, [now]);
    expect(await peer.commitLogin('c', 'a', now, session())).toBe(false);
    expect(await store.getChallenge('c', 'a')).not.toBeNull();
  });
  it('does not move last activity backwards or resurrect a revoked session', async () => {
    await store.putBrowser(browser()); await store.putChallenge(challenge()); await store.commitLogin('c', 'a', now, session());
    await store.getSession('s', 'a', now + 1500, 2000);
    expect((await peer.getSession('s', 'a', now + 500, 2000))?.idleExpiresAt).toBe(new Date(now + 3500).toISOString());
    expect(await peer.getSession('s', 'a', now + 3000, 2000)).not.toBeNull();
    await Promise.all([store.getSession('s', 'a', now + 3001, 2000), peer.revokeBrowser('a')]);
    expect(await store.getSession('s', 'a', now + 3002, 2000)).toBeNull();
  });
  it.each(['login', 'logout'] as const)('orders logout against an in-flight login when %s locks first', async first => {
    await store.putBrowser(browser()); await store.putChallenge(challenge());
    const locked = gate(), resume = gate(), secondStarted = gate();
    function intercepted(base: PostgresPool, firstClient: boolean): PostgresPool {
      return { async connect() {
        const client = await base.connect();
        return { release: (destroy?: boolean) => client.release(destroy), async query(sql: string, values?: unknown[]) {
          if (sql.includes('FOR UPDATE') && !firstClient) secondStarted.resolve();
          const result = await client.query(sql, values);
          if (sql.includes('FOR UPDATE') && firstClient) { locked.resolve(); await resume.promise; }
          return result;
        } };
      } };
    }
    const a = createPostgresStorage(intercepted(pool, true), { schema });
    const b = createPostgresStorage(intercepted(peerPool, false), { schema });
    const firstOperation = first === 'login' ? a.commitLogin('c', 'a', now, session()) : a.revokeBrowser('a');
    await locked.promise;
    const secondOperation = first === 'login' ? b.revokeBrowser('a') : b.commitLogin('c', 'a', now, session());
    await secondStarted.promise; resume.resolve();
    const results = await Promise.all([firstOperation, secondOperation]);
    expect(results[first === 'login' ? 0 : 1]).toBe(first === 'login');
    expect(await store.getSession('s', 'a', now, 2000)).toBeNull();
    expect(await peer.getChallenge('c', 'a')).toBeNull();
  });
  it('fails closed without a schema and does not retain a checked-out connection', async () => {
    const absent = createPostgresStorage(pool, { schema: 'gl_absent_test_schema' });
    await expect(absent.getBrowser('a', now)).rejects.toThrow();
    const auth = createGhostlinkServer({ origin: 'https://app.example', loginUri: 'https://app.example/', storage: absent });
    const response = await auth.handle(new Request('https://app.example/auth/ghostlink/session'));
    expect(response.status).toBe(500);
    expect(response.headers.getSetCookie()).toEqual([]);
    expect(pool.idleCount).toBe(pool.totalCount);
  });
  it('authenticates with real signatures, restores on another server, and revokes copied cookies', async () => {
    const config = { origin: 'https://app.example', loginUri: 'https://app.example/', now: () => now };
    const a = createGhostlinkServer({ ...config, storage: store });
    const b = createGhostlinkServer({ ...config, storage: peer });
    const bootstrap = await a.handle(new Request(`${config.origin}/auth/ghostlink/session`));
    const browserCookie = bootstrap.headers.getSetCookie()[0]!.split(';')[0]!;
    const { csrfToken } = await bootstrap.json();
    const headers = { origin: config.origin, cookie: browserCookie, 'content-type': 'application/json', 'x-ghostlink-csrf': csrfToken };
    const post = (endpoint: string, body: unknown) => new Request(`${config.origin}/auth/ghostlink/${endpoint}`, { method: 'POST', headers, body: JSON.stringify(body) });
    const c = await (await a.handle(post('challenge', account))).json();
    const proof = { challengeId: c.id, message: c.message, signature: sign(c.message) };
    const results = await Promise.all([a.handle(post('verify', proof)), b.handle(post('verify', proof))]);
    expect(results.map(r => r.status).sort()).toEqual([200, 401]);
    const cookie = `${browserCookie}; ${results.find(r => r.status === 200)!.headers.getSetCookie()[0]!.split(';')[0]}`;
    const request = new Request(`${config.origin}/private`, { headers: { cookie } });
    expect(await b.getSession(request)).toMatchObject({ address: account.address, network: account.network });
    expect((await b.handle(post('logout', {}))).status).toBe(200);
    expect(await a.getSession(request)).toBeNull();
  });
});
