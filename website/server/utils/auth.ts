import { createGhostlinkServer, createPostgresStorage, createSqliteStorage } from '@ghostdagger/ghostlink-server';
import { Pool } from '@neondatabase/serverless';
import { attachDatabasePool } from '@vercel/functions';
let service: ReturnType<typeof createService> | undefined;
function createService() {
  const origin = process.env.GHOSTLINK_ORIGIN ?? (import.meta.dev ? 'http://127.0.0.1:3000' : '');
  if (!origin) throw new Error('GHOSTLINK_ORIGIN must be configured for the production website.');
  if (new URL(origin).origin !== origin) throw new Error('GHOSTLINK_ORIGIN must be an exact origin without a trailing slash.');
  const connectionString = process.env.DATABASE_URL;
  const onVercel = process.env.VERCEL === '1';
  if (onVercel && !connectionString) throw new Error('DATABASE_URL is required on Vercel; local SQLite cannot be used there.');
  let pool: Pool | undefined;
  let storage: ReturnType<typeof createPostgresStorage> | undefined;
  try {
    if (connectionString) {
      pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 5000, connectionTimeoutMillis: 10000 });
      pool.on('error', () => console.error('Ghostlink database connection failed.'));
      if (onVercel) attachDatabasePool(pool);
      storage = createPostgresStorage(pool, { schema: process.env.GHOSTLINK_DATABASE_SCHEMA });
    } else {
      storage = createSqliteStorage(process.env.GHOSTLINK_DATABASE ?? '.data/ghostlink.sqlite');
    }
    const auth = createGhostlinkServer({ origin, loginUri: `${origin}/demo`, storage, networks: ['mainnet', 'testnet-10', 'testnet-11'], allowInsecureLocalhost: !onVercel });
    return { auth, async close() { storage?.close?.(); await pool?.end(); } };
  } catch (error) {
    storage?.close?.();
    void pool?.end().catch(() => {});
    throw error;
  }
}
export function getAuthService() { return service ??= createService(); }
export async function closeAuthService() { const active = service; service = undefined; await active?.close(); }
