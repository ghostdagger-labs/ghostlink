import 'server-only';
import { Pool } from '@neondatabase/serverless';
import { attachDatabasePool } from '@vercel/functions';
import { createGhostlinkServer } from '@ghostdagger/ghostlink-server/server';
import { createPostgresStorage } from '@ghostdagger/ghostlink-server/postgres';
import { getOrigin } from './config';

let service: ReturnType<typeof createGhostlinkServer> | undefined;

export function getAuthService() {
  if (service) return service;
  const origin = getOrigin();
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error('Configure the server-only DATABASE_URL.');
  const pool = new Pool({ connectionString, max: 3, idleTimeoutMillis: 5000, connectionTimeoutMillis: 10000 });
  // Never log connection strings or database errors containing credentials/queries.
  pool.on('error', () => console.error('Ghostlink database connection failed.'));
  attachDatabasePool(pool);
  service = createGhostlinkServer({
    origin,
    loginUri: `${origin}/`,
    networks: ['testnet-10', 'testnet-11'],
    storage: createPostgresStorage(pool, { schema: process.env.GHOSTLINK_DATABASE_SCHEMA }),
    allowInsecureLocalhost: process.env.VERCEL !== '1' && process.env.GHOSTLINK_ALLOW_INSECURE_LOCALHOST === 'true',
  });
  return service;
}
