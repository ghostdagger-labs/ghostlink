import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGhostlink } from './controller';
import { kaspiumAdapter, kastleAdapter, kaswareAdapter } from './adapters';
import { GhostlinkError } from './types';
import type { AuthSession, AuthTransport, WalletAdapter, TransactionRequest } from './types';
import { account, sign } from '../../../tests/fixtures/keys';
import { serializeLoginMessage } from './protocol';
const clean: (() => void)[] = [];
afterEach(() => { clean.splice(0).forEach(f => f()); vi.unstubAllGlobals(); vi.useRealTimers(); });
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture() {
  let event = () => {};
  const session: AuthSession = { ...account, accountId: 'kaspa:testnet-11:' + account.address.split(':')[1], chainId: 'kaspa:testnet-11', issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+86_400_000).toISOString(), idleExpiresAt: new Date(Date.now()+1_800_000).toISOString() };
  const challenge = { id: '1'.repeat(64), profile: 'ghostlink-kaspa-v1' as const, ...account, expiresAt: new Date(Date.parse(session.issuedAt)+300_000).toISOString(), message: '' };
  challenge.message = serializeLoginMessage({ ...account, domain: 'app.example', uri: 'https://app.example/login', nonce: '1'.repeat(64), issuedAt: session.issuedAt, expiresAt: challenge.expiresAt });
  const auth = { challenge: vi.fn(async () => challenge), verify: vi.fn(async () => session), session: vi.fn(async (): Promise<AuthSession | null> => session), logout: vi.fn(async () => {}) } satisfies AuthTransport;
  const adapter: WalletAdapter = { id: 'test', name: 'Test Wallet', mark: 'T', kind: 'injected', installUrl: 'https://example.com', capabilities: { authentication: 'compatibility', domainBinding: 'not-enforced', messageSigning: true, transfer: true, transactionFormats: ['kaspa-transaction-json'] }, isAvailable: () => true, connect: vi.fn(async () => account), getAccount: vi.fn(async () => account), signMessage: vi.fn(async m => sign(m)), sendTransaction: vi.fn(async () => 'txid'), signTransaction: vi.fn(async () => '{"signed":true}'), subscribe: fn => { event = fn; return () => { event = () => {}; }; } };
  const client = createGhostlink({ app: { name: 'App', url: 'https://app.example' }, adapters: [adapter, kaspiumAdapter()], auth }); clean.push(() => client.destroy());
  return { client, adapter, auth, challenge, session, event: () => event(), login: async () => { await client.connect('test'); await client.authenticate(); } };
}
describe('controller security transitions', () => {
  it('authenticates only after backend verification', async () => {
    const f = fixture(); const gate = deferred<AuthSession>(); f.auth.verify.mockImplementation(() => gate.promise);
    await f.client.connect('test'); const operation = f.client.authenticate(); await vi.waitFor(() => expect(f.auth.verify).toHaveBeenCalled());
    expect(f.client.getSnapshot().session).toBeNull(); gate.resolve(f.session); await operation;
    expect(f.client.getSnapshot().authentication).toBe('authenticated');
  });
  it('serializes approval prompts and ignores a late cancelled login', async () => {
    const f = fixture(); const gate = deferred<string>(); vi.mocked(f.adapter.signMessage).mockImplementation(() => gate.promise);
    await f.client.connect('test'); const login = f.client.authenticate(); const rejection = expect(login).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.waitFor(() => expect(f.adapter.signMessage).toHaveBeenCalled());
    await expect(f.client.authenticate()).rejects.toMatchObject({ code: 'BUSY' }); f.client.close(); gate.resolve(sign(f.challenge.message)); await rejection;
    expect(f.auth.verify).not.toHaveBeenCalled(); expect(f.client.getSnapshot().session).toBeNull(); expect(f.auth.logout).toHaveBeenCalled();
  });
  it('revokes if verification completes after cancellation', async () => {
    const f = fixture(); const gate = deferred<AuthSession>(); f.auth.verify.mockImplementation(() => gate.promise);
    await f.client.connect('test'); const login = f.client.authenticate(); const rejection = expect(login).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.waitFor(() => expect(f.auth.verify).toHaveBeenCalled()); f.client.close(); gate.resolve(f.session); await rejection;
    expect(f.client.getSnapshot().session).toBeNull(); expect(f.auth.logout).toHaveBeenCalled();
  });
  it('supports manual authentication and restoration without live connectivity', async () => {
    const f = fixture(); await f.client.connect('kaspium'); await f.client.prepareAuthentication(account.address); await f.client.authenticate({ signature: sign(f.challenge.message) });
    expect(f.client.getSnapshot()).toMatchObject({ connection: 'manual', authentication: 'authenticated' });
    await f.client.restoreSession(); expect(f.client.getSnapshot().session?.address).toBe(account.address);
    await expect(f.client.signMessage('message')).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await f.client.disconnect(); expect(f.auth.logout).toHaveBeenCalled();
  });
  it('normalizes grouped manual-address whitespace before creating the exact challenge', async () => {
    const f = fixture(); await f.client.connect('kaspium');
    await f.client.prepareAuthentication(account.address.match(/.{1,8}/g)!.join(' \n'));
    expect(f.auth.challenge).toHaveBeenCalledWith({ address: account.address, network: account.network });
    expect(f.client.getSnapshot().challenge?.message).toBe(f.challenge.message);
  });
  it('never downgrades native authentication after a rejection or message mismatch', async () => {
    const f = fixture(); f.adapter.capabilities.authentication = 'caip122'; f.adapter.signIn = vi.fn(async () => { throw new GhostlinkError('USER_REJECTED', 'Wrong domain'); });
    await f.client.connect('test'); await expect(f.client.authenticate()).rejects.toMatchObject({ code: 'USER_REJECTED' });
    expect(f.adapter.signMessage).not.toHaveBeenCalled();
    f.adapter.signIn = vi.fn(async () => ({ message: 'changed', signature: sign('changed') }));
    await expect(f.client.authenticate()).rejects.toMatchObject({ code: 'INVALID_REQUEST' }); expect(f.auth.verify).not.toHaveBeenCalled();
  });
  it('invalidates observed wallet changes and reports failed revocation truthfully', async () => {
    const f = fixture(); await f.login(); f.auth.logout.mockRejectedValue(new Error('offline')); f.event();
    await vi.waitFor(() => expect(f.client.getSnapshot()).toMatchObject({ session: null, revocationPending: true }));
    await expect(f.client.connect('test')).rejects.toMatchObject({ code: 'SERVER_ERROR' });
    f.auth.logout.mockResolvedValue(); await f.client.connect('test'); expect(f.client.getSnapshot().revocationPending).toBe(false);
  });
  it('requires reauthentication on network change and restores no expired server session', async () => {
    const f = fixture(); await f.login(); await f.client.setNetwork('mainnet'); expect(f.client.getSnapshot()).toMatchObject({ session: null, network: 'mainnet' });
    f.auth.session.mockResolvedValue(null); await f.client.restoreSession(); expect(f.client.getSnapshot().authentication).toBe('unauthenticated');
  });
  it('honors protected-route activity at the server without polling idle sessions alive', async () => {
    vi.useFakeTimers(); vi.stubGlobal('window', { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const f = fixture(); await f.login();
    f.auth.session.mockResolvedValue({ ...f.session, idleExpiresAt: new Date(Date.now() + 2_700_000).toISOString() });
    await vi.advanceTimersByTimeAsync(1_799_000); expect(f.auth.session).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1000);
    expect(f.auth.session).toHaveBeenCalledTimes(1); expect(f.auth.logout).not.toHaveBeenCalled();
    expect(f.client.getSnapshot().session?.idleExpiresAt).toBe(new Date(Date.parse(f.session.issuedAt) + 2_700_000).toISOString());
    f.auth.session.mockResolvedValue(null);
    await vi.advanceTimersByTimeAsync(900_000);
    expect(f.client.getSnapshot().authentication).toBe('unauthenticated');
  });
  it('prevents stale restoration from replacing a newly started connection', async () => {
    const f = fixture(); const gate = deferred<AuthSession | null>(); f.auth.session.mockImplementation(() => gate.promise);
    const restore = f.client.restoreSession(); const stale = expect(restore).rejects.toMatchObject({ code: 'CANCELLED' }); await Promise.resolve();
    await f.client.connect('test'); gate.resolve(f.session); await stale; expect(f.client.getSnapshot().session).toBeNull();
  });
  it('keeps signing-only separate from broadcast and snapshots requests before review', async () => {
    const f = fixture(); await f.login(); const detach = f.client.attachUI();
    const request: TransactionRequest = { format: 'kaspa-transaction-json', payload: '{"approved":true}', network: account.network, address: account.address };
    const operation = f.client.signTransaction(request); await vi.waitFor(() => expect(f.client.getSnapshot().request).not.toBeNull());
    request.payload = '{"changed":true}'; f.client.confirmRequest(); await operation;
    expect(f.adapter.signTransaction).toHaveBeenCalledWith(expect.objectContaining({ payload: '{"approved":true}' })); expect(f.adapter.sendTransaction).not.toHaveBeenCalled(); detach();
  });
  it('cancels a UI review without calling the wallet', async () => {
    const f = fixture(); await f.login(); f.client.attachUI(); vi.mocked(f.adapter.signMessage).mockClear();
    const operation = f.client.signMessage('Read this'); const rejection = expect(operation).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.waitFor(() => expect(f.client.getSnapshot().request).not.toBeNull()); f.client.back(); await rejection; expect(f.adapter.signMessage).not.toHaveBeenCalled();
  });
});
describe('actual provider normalization', () => {
  it('uses the real KasWare network names and refuses ambiguous testnet aliases', async () => {
    const p = { requestAccounts: async () => [account.address], getAccounts: async () => [account.address], getPublicKey: async () => account.publicKey, getNetwork: vi.fn(async () => 'kaspa_testnet_11'), switchNetwork: vi.fn(async () => {}) };
    vi.stubGlobal('window', { kasware: p }); const a = kaswareAdapter();
    expect(await a.connect('testnet-11')).toEqual(account);
    await a.switchNetwork!('mainnet'); expect(p.switchNetwork).toHaveBeenCalledWith('kaspa_mainnet');
    await a.switchNetwork!('testnet-11'); expect(p.switchNetwork).toHaveBeenCalledWith('kaspa_testnet_11');
    p.getNetwork.mockResolvedValue('kaspa_testnet'); await expect(a.getAccount()).rejects.toMatchObject({ code: 'NETWORK_MISMATCH' });
  });
  it('passes the exact KasWare signing parameters and never broadcasts PSKT', async () => {
    const p = { signMessage: vi.fn(async () => 'sig'), signPskt: vi.fn(async () => 'signed'), sendKaspa: vi.fn(async () => 'tx') }; vi.stubGlobal('window', { kasware: p }); const a = kaswareAdapter();
    await a.signMessage('hello'); expect(p.signMessage).toHaveBeenCalledWith('hello', { type: 'schnorr' });
    await a.signTransaction!({ format: 'pskt-json', payload: '{}', ...account }); expect(p.signPskt).toHaveBeenCalledWith({ txJsonString: '{}' }); expect(p.sendKaspa).not.toHaveBeenCalled();
    await expect(a.sendTransaction!({ toAddress: account.address, amountSompi: BigInt(Number.MAX_SAFE_INTEGER)+1n })).rejects.toMatchObject({ code: 'INVALID_REQUEST' }); expect(p.sendKaspa).not.toHaveBeenCalled();
    await a.sendTransaction!({ toAddress: account.address, amountSompi: 1n }); expect(p.sendKaspa).toHaveBeenCalledWith(account.address, 1, { priorityFee: 0 });
  });
  it('uses Kastle native JSON signing and exposes only present capabilities', async () => {
    const p = { signTx: vi.fn(async () => 'signed') }; vi.stubGlobal('window', { kastle: p }); const a = kastleAdapter();
    expect(a.capabilities.transfer).toBe(false); await a.signTransaction!({ format: 'kaspa-transaction-json', payload: '{}', ...account }); expect(p.signTx).toHaveBeenCalledWith('testnet-11', '{}');
    await expect(a.signTransaction!({ format: 'pskt-json', payload: '{}', ...account })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
  });
  it('blocks the Kastle testnet-11 switch crash and uses the explicit testnet-10 identifier', async () => {
    const p = { switchNetwork: vi.fn(async () => 'testnet-10'), connect: vi.fn(async () => true) };
    vi.stubGlobal('window', { kastle: p }); const a = kastleAdapter();
    await expect(a.connect('testnet-11')).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await expect(a.switchNetwork!('testnet-11')).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(p.connect).not.toHaveBeenCalled(); expect(p.switchNetwork).not.toHaveBeenCalled();
    await a.switchNetwork!('testnet-10'); expect(p.switchNetwork).toHaveBeenCalledWith('testnet-10');
  });
});
