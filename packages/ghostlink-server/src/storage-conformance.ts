import type { GhostlinkStorage, SessionRecord } from './storage.js';
/** Reusable behavioral checks for a new storage adapter. Run against an isolated, empty test database. */
export async function assertStorageConformance(store: GhostlinkStorage): Promise<void> {
  const assert = (condition: unknown, message: string) => { if (!condition) throw new Error(`Storage conformance: ${message}`); };
  const now = Date.parse('2026-09-16T12:00:00.000Z');
  await store.putBrowser({ hash: 'browser-a', csrf: 'csrf', expiresAt: now + 10000 });
  await store.putBrowser({ hash: 'browser-b', csrf: 'csrf', expiresAt: now + 10000 });
  const challenge = { id: 'challenge-a', browserHash: 'browser-a', profile: 'ghostlink-kaspa-v1' as const, address: 'fixture-address', network: 'testnet-11' as const, message: 'fixture', issuedAt: now, expiresAt: new Date(now + 1000).toISOString() };
  await store.putChallenge(challenge);
  assert(await store.getChallenge(challenge.id, 'browser-b') === null, 'challenge binding');
  const session: SessionRecord = { hash: 'session-a', browserHash: 'browser-a', lastSeen: now, session: { address: 'fixture-address', accountId: 'fixture-account', chainId: 'kaspa:testnet-11', network: 'testnet-11', issuedAt: new Date(now).toISOString(), expiresAt: new Date(now+4000).toISOString(), idleExpiresAt: new Date(now+2000).toISOString() }, receipt: { profile: 'ghostlink-kaspa-v1', message: 'fixture', signature: 'fixture' } };
  const results = await Promise.all([store.commitLogin(challenge.id, 'browser-a', now, session), store.commitLogin(challenge.id, 'browser-a', now, { ...session, hash: 'session-other' })]);
  assert(results.filter(Boolean).length === 1, 'single atomic challenge consumption');
  const winningHash = results[0] ? session.hash : 'session-other';
  assert(await store.getSession(winningHash, 'browser-b', now, 2000) === null, 'session binding');
  assert(await store.getSession(winningHash, 'browser-a', now+1999, 2000) !== null, 'session idle refresh');
  assert(await store.getSession(winningHash, 'browser-a', now+3999, 2000) === null, 'idle expiry');
  assert(await store.getSession(winningHash, 'browser-a', now+4000, 5000) === null, 'absolute expiry');
  await store.putChallenge(challenge); await store.revokeBrowser('browser-a');
  assert(await store.getChallenge(challenge.id, 'browser-a') === null, 'revoke outstanding challenges');
  assert(await store.getSession(winningHash, 'browser-a', now, 2000) === null, 'revoke sessions');
  await store.putChallenge(challenge); assert(await store.commitLogin(challenge.id, 'browser-a', now+1000, session) === false, 'challenge expiry at commit');
  assert(await store.consumeRateLimit('fixture-limit', now, 1000, 1), 'first rate-limit request');
  assert(!await store.consumeRateLimit('fixture-limit', now, 1000, 1), 'rate-limit enforcement');
  assert(await store.consumeRateLimit('fixture-limit', now+1000, 1000, 1), 'rate-limit reset');
  await store.prune(now+10000); assert(await store.getBrowser('browser-a', now) === null, 'expired browser pruning');
}
