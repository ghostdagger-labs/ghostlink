import { createGhostlinkServer, createNodeHandler, createSqliteStorage } from 'ghostlink-server';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
let service: ReturnType<typeof createService> | undefined;
function createService() {
  const origin = process.env.GHOSTLINK_ORIGIN ?? (import.meta.dev ? 'http://127.0.0.1:3000' : '');
  if (!origin) throw new Error('GHOSTLINK_ORIGIN must be configured for the production website.');
  const database = process.env.GHOSTLINK_DATABASE ?? '.data/ghostlink.sqlite';
  mkdirSync(dirname(database), { recursive: true });
  const storage = createSqliteStorage(database);
  try {
    const auth = createGhostlinkServer({ origin, loginUri: `${origin}/demo`, storage, networks: ['mainnet', 'testnet-10', 'testnet-11'], allowInsecureLocalhost: true });
    return { auth, handler: createNodeHandler(auth), storage };
  } catch (error) { storage.close?.(); throw error; }
}
export function getAuthService() { return service ??= createService(); }
export function closeAuthService() { service?.storage.close?.(); service = undefined; }
