import { afterEach, describe, expect, it } from 'vitest';
import { createGhostlinkServer } from './server';
import { createSqliteStorage } from './sqlite';
import { account, keyAccount, sign } from '../../../tests/fixtures/keys';
import type { AuthChallenge } from 'ghostlink-core';

const cleanup: (() => void)[] = [];
afterEach(() => { cleanup.splice(0).forEach(close => close()); });
function fixture(options: Record<string, unknown> = {}) {
  let now = Date.parse('2026-09-16T12:00:00.000Z');
  const storage = createSqliteStorage(':memory:'); cleanup.push(() => storage.close?.());
  const server = createGhostlinkServer({ origin: 'https://app.example', loginUri: 'https://app.example/login', storage, now: () => now, ...options });
  function browser() {
    const jar: Record<string, string> = {}; let csrf = '';
    async function request(endpoint: string, body?: unknown, headers: Record<string, string> = {}, saveCookies = true) {
      const response = await server.handle(new Request(`https://app.example/auth/ghostlink/${endpoint}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers: { Origin: 'https://app.example', 'Content-Type': 'application/json', Cookie: Object.entries(jar).map(([k,v]) => `${k}=${v}`).join('; '), 'X-Ghostlink-CSRF': csrf, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      }));
      if (saveCookies) for (const cookie of response.headers.getSetCookie()) { const [k,v] = cookie.split(';')[0]!.split('='); jar[k!] = v!; }
      return response;
    }
    async function bootstrap() { const r = await request('session'); const b = await r.json(); csrf = b.csrfToken; return r; }
    async function challenge() { return (await (await request('challenge', account)).json()) as AuthChallenge; }
    const verify = (c: AuthChallenge, changes: Record<string, unknown> = {}) => request('verify', { challengeId: c.id, message: c.message, signature: sign(c.message), ...changes });
    return { jar, request, bootstrap, challenge, verify };
  }
  return { server, storage, browser, advance: (ms: number) => { now += ms; } };
}
describe('browser-bound authentication', () => {
  it('binds Testnet 10 independently from Testnet 11 despite their shared address prefix', async () => {
    const f = fixture({ networks: ['testnet-10', 'testnet-11'] }); const b = f.browser(); await b.bootstrap();
    const c = await (await b.request('challenge', { ...account, network: 'testnet-10' })).json() as AuthChallenge;
    expect(c.message).toContain('Chain ID: kaspa:testnet-10');
    const changed = c.message.replace('kaspa:testnet-10', 'kaspa:testnet-11');
    expect((await b.verify(c, { message: changed, signature: sign(changed) })).status).toBe(401);
    const response = await b.verify(c); expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ network: 'testnet-10', chainId: 'kaspa:testnet-10' });
    const restricted = fixture({ networks: ['testnet-11'] }).browser(); await restricted.bootstrap();
    expect((await restricted.request('challenge', { ...account, network: 'testnet-10' })).status).toBe(400);
  });
  it('sets production cookie protections, verifies and looks up a protected session', async () => {
    const f = fixture(); const b = f.browser(); const bootstrap = await b.bootstrap();
    expect(bootstrap.headers.get('set-cookie')).toMatch(/__Host-ghostlink-browser=.*HttpOnly; SameSite=Lax.*Secure/);
    expect(bootstrap.headers.get('cache-control')).toBe('no-store');
    const c = await b.challenge(); expect(c.message).toContain('Chain ID: kaspa:testnet-11');
    const response = await b.verify(c); expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/__Host-ghostlink-session=.*Secure/);
    const state = await (await b.request('session')).json(); expect(state.session.address).toBe(account.address);
    expect(await f.server.getSession(new Request('https://app.example/private', { headers: { Cookie: Object.entries(b.jar).map(([k,v]) => `${k}=${v}`).join('; ') } }))).toMatchObject({ address: account.address, network: account.network });
  });
  it('allows exactly one concurrent verification and rejects replay', async () => {
    const f = fixture(); const b = f.browser(); await b.bootstrap(); const c = await b.challenge();
    const results = await Promise.all([b.verify(c), b.verify(c)]);
    expect(results.map(r => r.status).sort()).toEqual([200, 401]);
    expect((await b.verify(c)).status).toBe(401);
  });
  it('does not accept a challenge or session in another browser', async () => {
    const f = fixture(); const a = f.browser(), b = f.browser(); await a.bootstrap(); await b.bootstrap();
    const c = await a.challenge(); expect((await b.verify(c)).status).toBe(401);
    await a.verify(c); b.jar['__Host-ghostlink-session'] = a.jar['__Host-ghostlink-session']!;
    expect((await (await b.request('session')).json()).session).toBeNull();
  });
  it.each(['app.example', 'kaspa:testnet-11', account.address.split(':')[1]!])('rejects changed message field %s', async field => {
    const f = fixture(); const b = f.browser(); await b.bootstrap(); const c = await b.challenge();
    const message = c.message.replace(field, 'different');
    expect((await b.verify(c, { message, signature: sign(message) })).status).toBe(401);
    expect((await b.verify(c)).status).toBe(200);
  });
  it('rejects another key, unsupported signature encodings and bad address checksums', async () => {
    const f = fixture(); const b = f.browser(); await b.bootstrap(); const c = await b.challenge();
    expect((await b.verify(c, { publicKey: keyAccount('2'.padStart(64, '0')).publicKey })).status).toBe(401);
    expect((await b.verify(c, { signature: 'base64signature' })).status).toBe(400);
    expect((await b.request('challenge', { ...account, address: account.address + 'q' })).status).toBe(400);
  });
  it('rejects expiry and refresh invalidates older challenges', async () => {
    const f = fixture(); const b = f.browser(); await b.bootstrap(); const first = await b.challenge(); const next = await b.challenge();
    expect((await b.verify(first)).status).toBe(401); f.advance(300_000);
    expect((await b.verify(next)).status).toBe(401);
  });
  it('rejects wrong origins, missing CSRF, cross-site reads and oversized bodies', async () => {
    const f = fixture(); const b = f.browser(); await b.bootstrap();
    expect((await b.request('challenge', account, { Origin: 'https://evil.example' })).status).toBe(400);
    expect((await b.request('challenge', account, { 'X-Ghostlink-CSRF': '' })).status).toBe(403);
    expect((await b.request('session', undefined, { 'Sec-Fetch-Site': 'cross-site' })).status).toBe(400);
    expect((await b.request('challenge', { padding: 'x'.repeat(17000) })).status).toBe(400);
    expect((await b.request('challenge', account, { 'Content-Type': 'application/jsonp' })).status).toBe(400);
  });
  it('revokes sessions and outstanding challenges, even if a verification response arrives late', async () => {
    const f = fixture(); const b = f.browser(); await b.bootstrap(); const c = await b.challenge(); await b.verify(c);
    const oldCookie = b.jar['__Host-ghostlink-session']; const pending = await b.challenge();
    expect((await b.request('logout', {})).status).toBe(200);
    b.jar['__Host-ghostlink-session'] = oldCookie!;
    expect((await (await b.request('session')).json()).session).toBeNull();
    expect((await b.verify(pending)).status).toBe(401);
  });
  it('rotates sessions and ignores a fixed attacker-chosen session token', async () => {
    const f = fixture(); const b = f.browser(); await b.bootstrap(); b.jar['__Host-ghostlink-session'] = '1'.repeat(64);
    await b.verify(await b.challenge()); const first = b.jar['__Host-ghostlink-session']; expect(first).not.toBe('1'.repeat(64));
    await b.verify(await b.challenge()); expect(b.jar['__Host-ghostlink-session']).not.toBe(first);
    b.jar['__Host-ghostlink-session'] = first!; expect((await (await b.request('session')).json()).session).toBeNull();
  });
  it('enforces idle and absolute expiry', async () => {
    const f = fixture({ sessionTtlMs: 3000, idleTtlMs: 2000 }); const b = f.browser(); await b.bootstrap(); await b.verify(await b.challenge());
    f.advance(1000); expect((await (await b.request('session')).json()).session).not.toBeNull();
    f.advance(1999); expect((await (await b.request('session')).json()).session).not.toBeNull();
    f.advance(1); expect((await (await b.request('session')).json()).session).toBeNull();
    await b.verify(await b.challenge()); f.advance(2000); expect((await (await b.request('session')).json()).session).toBeNull();
  });
  it('limits request volume and rejects ambiguous security cookies', async () => {
    const f = fixture(); const b = f.browser(); await b.bootstrap();
    const cookie = `__Host-ghostlink-browser=${b.jar['__Host-ghostlink-browser']}`;
    expect((await b.request('challenge', account, { Cookie: `${cookie}; ${cookie}` })).status).toBe(403);
    for (let i = 0; i < 30; i++) await b.request('challenge', account);
    expect((await b.request('challenge', account)).status).toBe(429);
  });
  it('requires HTTPS or an explicit loopback exception and a network allowlist', async () => {
    expect(() => fixture({ origin: 'http://app.example', loginUri: 'http://app.example/login', allowInsecureLocalhost: true })).toThrow();
    expect(() => fixture({ origin: 'http://localhost', loginUri: 'http://localhost/login' })).toThrow();
    expect(() => fixture({ origin: 'http://localhost', loginUri: 'http://localhost/login', allowInsecureLocalhost: true })).not.toThrow();
    const f = fixture({ networks: ['mainnet'] }); const b = f.browser(); await b.bootstrap();
    expect((await b.request('challenge', account)).status).toBe(400);
  });
});
