import { randomBytes, createHash, timingSafeEqual } from 'node:crypto';
import { PROFILE, NETWORKS, serializeLoginMessage, isNetwork, chainId, GhostlinkError } from 'ghostlink-core';
import type { Network, AuthSession } from 'ghostlink-core';
import { validateKaspaAddress, verifyKaspaSignature } from './crypto.js';
import type { GhostlinkStorage, BrowserRecord, ChallengeRecord } from './storage.js';

export interface GhostlinkServerConfig {
  origin: string; loginUri: string; storage: GhostlinkStorage; networks?: readonly Network[];
  prefix?: string; allowInsecureLocalhost?: boolean;
  challengeTtlMs?: number; sessionTtlMs?: number; idleTtlMs?: number; clockSkewMs?: number;
  /** Injectable clock for deterministic tests. */
  now?: () => number;
}
export interface RequestContext { /** Supply only a trusted peer address; never an unvalidated forwarded header. */ ip?: string; }
const token = () => randomBytes(32).toString('hex');
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const equal = (a: string, b: string) => a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
const hexToken = (s: unknown): s is string => typeof s === 'string' && /^[a-f0-9]{64}$/.test(s);
function cookies(request: Request): Record<string, string> {
  const result: Record<string, string> = Object.create(null);
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const i = part.indexOf('='); if (i < 0) continue;
    const name = part.slice(0, i).trim();
    // Duplicated security cookies are ambiguous and must not be accepted.
    result[name] = name in result ? '' : part.slice(i + 1).trim();
  }
  return result;
}
async function boundedJson(request: Request): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get('content-type') ?? '')) throw new GhostlinkError('INVALID_REQUEST', 'Expected application/json.');
  if (Number(request.headers.get('content-length') ?? 0) > 16384) throw new GhostlinkError('INVALID_REQUEST', 'Request is too large.');
  const reader = request.body?.getReader(); if (!reader) throw new GhostlinkError('INVALID_REQUEST', 'Missing request body.');
  let bytes = 0; const parts: Uint8Array[] = [];
  while (true) { const next = await reader.read(); if (next.done) break; bytes += next.value.length; if (bytes > 16384) { await reader.cancel(); throw new GhostlinkError('INVALID_REQUEST', 'Request is too large.'); } parts.push(next.value); }
  try { const value: unknown = JSON.parse(Buffer.concat(parts).toString('utf8')); if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(); return value as Record<string, unknown>; }
  catch { throw new GhostlinkError('INVALID_REQUEST', 'Invalid JSON request.'); }
}
export function createGhostlinkServer(config: GhostlinkServerConfig) {
  const origin = new URL(config.origin); const uri = new URL(config.loginUri);
  if (origin.origin !== config.origin || uri.origin !== origin.origin || uri.username || uri.password || uri.hash) throw new Error('Configure an exact trusted origin and a same-origin login URI.');
  const insecure = origin.protocol === 'http:' && !!config.allowInsecureLocalhost && ['localhost', '127.0.0.1', '[::1]'].includes(origin.hostname);
  if (origin.protocol !== 'https:' && !insecure) throw new Error('HTTPS is required except for explicitly configured loopback development.');
  const prefix = config.prefix ?? '/auth/ghostlink';
  if (!/^\/[a-zA-Z0-9/_-]+$/.test(prefix) || prefix.endsWith('/')) throw new Error('Invalid authentication path prefix.');
  const store = config.storage; const now = config.now ?? Date.now;
  const challengeTtl = config.challengeTtlMs ?? 300_000; const sessionTtl = config.sessionTtlMs ?? 86_400_000;
  const idleTtl = config.idleTtlMs ?? 1_800_000; const skew = config.clockSkewMs ?? 30_000;
  for (const v of [challengeTtl, sessionTtl, idleTtl]) if (!Number.isSafeInteger(v) || v <= 0) throw new Error('Session and challenge durations must be positive integers.');
  if (challengeTtl > 300_000 || !Number.isSafeInteger(skew) || skew < 0 || skew > 30_000) throw new Error('Challenge duration or clock skew exceeds the profile limit.');
  const networks = config.networks ?? NETWORKS;
  if (!networks.length || networks.some(n => !isNetwork(n))) throw new Error('Configure supported Kaspa networks.');
  const browserName = insecure ? 'ghostlink-browser' : '__Host-ghostlink-browser';
  const sessionName = insecure ? 'ghostlink-session' : '__Host-ghostlink-session';
  const browserTtl = Math.max(604_800_000, sessionTtl);
  function cookie(name: string, value: string, maxAge: number) { return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.floor(maxAge / 1000)}${insecure ? '' : '; Secure'}`; }
  function response(data: unknown, status = 200, setCookies: string[] = []) {
    const headers = new Headers({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie, Origin' });
    for (const c of setCookies) headers.append('Set-Cookie', c);
    return new Response(JSON.stringify(data), { status, headers });
  }
  function checkOrigin(request: Request) {
    if (new URL(request.url).origin !== origin.origin || request.headers.get('sec-fetch-site') === 'cross-site') throw new GhostlinkError('INVALID_REQUEST', 'Untrusted request origin.');
    const supplied = request.headers.get('origin');
    if ((supplied !== null && supplied !== origin.origin) || (request.method !== 'GET' && supplied !== origin.origin)) throw new GhostlinkError('INVALID_REQUEST', 'Untrusted request origin.');
  }
  async function browserFor(request: Request): Promise<BrowserRecord | null> { const value = cookies(request)[browserName]; return hexToken(value) ? store.getBrowser(hash(value), now()) : null; }
  async function getSession(request: Request): Promise<AuthSession | null> {
    const b = await browserFor(request); const value = cookies(request)[sessionName];
    if (!b || !hexToken(value)) return null;
    return store.getSession(hash(value), b.hash, now(), idleTtl);
  }
  async function handle(request: Request, context: RequestContext = {}): Promise<Response> {
    try {
      checkOrigin(request);
      const path = new URL(request.url).pathname;
      if (!path.startsWith(`${prefix}/`)) return response({ error: 'Not found.' }, 404);
      const endpoint = path.slice(prefix.length);
      if (!['/session', '/challenge', '/verify', '/logout'].includes(endpoint)) return response({ error: 'Not found.' }, 404);
      if ((endpoint === '/session' && request.method !== 'GET') || (endpoint !== '/session' && request.method !== 'POST')) return response({ error: 'Method not allowed.' }, 405);
      const time = now();
      if (!await store.consumeRateLimit(`peer:${hash(context.ip ?? 'shared')}`, time, 60_000, 180)) return response({ code: 'SERVER_ERROR', error: 'Too many requests. Wait a minute and try again.' }, 429);
      await store.prune(time);
      let browser = await browserFor(request);
      if (endpoint === '/session') {
        const setCookies: string[] = [];
        if (!browser) { const value = token(); browser = { hash: hash(value), csrf: token(), expiresAt: time + browserTtl }; await store.putBrowser(browser); setCookies.push(cookie(browserName, value, browserTtl)); }
        const session = await getSession(request);
        return response({ session, csrfToken: browser.csrf }, 200, setCookies);
      }
      const csrf = request.headers.get('x-ghostlink-csrf') ?? '';
      if (!browser || !hexToken(csrf) || !equal(csrf, browser.csrf)) return response({ code: 'UNAUTHENTICATED', error: 'Reload this application before signing in.' }, 403);
      if (!await store.consumeRateLimit(`browser:${browser.hash}`, time, 60_000, 30)) return response({ code: 'SERVER_ERROR', error: 'Too many requests. Wait a minute and try again.' }, 429);
      const body = await boundedJson(request);
      if (endpoint === '/logout') { await store.revokeBrowser(browser.hash); return response({ ok: true }, 200, [cookie(sessionName, '', 0)]); }
      if (endpoint === '/challenge') {
        if (!isNetwork(body.network) || !networks.includes(body.network) || typeof body.address !== 'string') throw new GhostlinkError('INVALID_REQUEST', 'Unsupported account or network.');
        const a = validateKaspaAddress(body.address, body.network);
        const expiresAt = new Date(time + challengeTtl).toISOString();
        const message = serializeLoginMessage({ domain: origin.host, address: a.address, network: body.network, uri: uri.href, nonce: token(), issuedAt: new Date(time).toISOString(), expiresAt });
        const record: ChallengeRecord = { id: token(), profile: PROFILE, message, address: a.address, network: body.network, expiresAt, issuedAt: time, browserHash: browser.hash };
        await store.putChallenge(record);
        const { browserHash: _browser, issuedAt: _issued, ...challenge } = record;
        return response(challenge);
      }
      if (!hexToken(body.challengeId) || typeof body.message !== 'string' || body.message.length > 2000 || typeof body.signature !== 'string' || !/^[a-f0-9]{128}$/.test(body.signature) || (body.publicKey !== undefined && (typeof body.publicKey !== 'string' || !/^(?:[a-fA-F0-9]{64}|0[23][a-fA-F0-9]{64})$/.test(body.publicKey)))) throw new GhostlinkError('INVALID_REQUEST', 'Invalid verification request.');
      const challenge = await store.getChallenge(body.challengeId, browser.hash);
      if (!challenge || Date.parse(challenge.expiresAt) <= time || challenge.issuedAt > time + skew) throw new GhostlinkError('EXPIRED', 'The challenge expired or was already used. Generate a new message.');
      if (body.message !== challenge.message || !networks.includes(challenge.network)) throw new GhostlinkError('INVALID_SIGNATURE', 'The signed message does not match this login request.');
      if (!verifyKaspaSignature({ address: challenge.address, network: challenge.network, message: challenge.message, signature: body.signature, publicKey: body.publicKey as string | undefined })) throw new GhostlinkError('INVALID_SIGNATURE', 'The signature does not match the signing address and message.');
      const verifiedTime = now(); const value = token();
      const session: AuthSession = { accountId: validateKaspaAddress(challenge.address, challenge.network).accountId, address: challenge.address, network: challenge.network, chainId: chainId(challenge.network), issuedAt: new Date(verifiedTime).toISOString(), expiresAt: new Date(verifiedTime + sessionTtl).toISOString(), idleExpiresAt: new Date(verifiedTime + Math.min(idleTtl, sessionTtl)).toISOString() };
      const committed = await store.commitLogin(challenge.id, browser.hash, verifiedTime, { hash: hash(value), browserHash: browser.hash, lastSeen: verifiedTime, session, receipt: { profile: PROFILE, message: challenge.message, signature: body.signature, publicKey: body.publicKey as string | undefined } });
      if (!committed) throw new GhostlinkError('EXPIRED', 'The challenge expired or was already used. Generate a new message.');
      return response(session, 200, [cookie(sessionName, value, sessionTtl)]);
    } catch (error) {
      if (error instanceof GhostlinkError) return response({ code: error.code, error: error.message }, error.code === 'INVALID_REQUEST' ? 400 : 401);
      return response({ code: 'SERVER_ERROR', error: 'The authentication service could not complete this request.' }, 500);
    }
  }
  return { handle, getSession, origin: origin.origin, prefix };
}
