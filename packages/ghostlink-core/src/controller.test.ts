import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGhostlink } from './controller';
import { kaspiumAdapter, kastleAdapter, kaswareAdapter } from './adapters';
import { GhostlinkError } from './types';
import type { AuthSession, AuthTransport, GhostlinkConfig, WalletAdapter, TransactionRequest } from './types';
import { account, sign } from '../../../tests/fixtures/keys';
import { serializeLoginMessage } from './protocol';
const clean: (() => void)[] = [];
afterEach(() => { clean.splice(0).forEach(f => f()); vi.unstubAllGlobals(); vi.useRealTimers(); });
const deferred = <T>() => { let resolve!: (value: T) => void; let reject!: (e: unknown) => void; const promise = new Promise<T>((a,b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function fixture(config: Pick<GhostlinkConfig, 'closeOnAuthenticate'> = {}) {
  let event = () => {};
  const session: AuthSession = { ...account, accountId: 'kaspa:testnet-11:' + account.address.split(':')[1], chainId: 'kaspa:testnet-11', issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now()+86_400_000).toISOString(), idleExpiresAt: new Date(Date.now()+1_800_000).toISOString() };
  const challenge = { id: '1'.repeat(64), profile: 'ghostlink-kaspa-v1' as const, ...account, expiresAt: new Date(Date.parse(session.issuedAt)+300_000).toISOString(), message: '' };
  challenge.message = serializeLoginMessage({ ...account, domain: 'app.example', uri: 'https://app.example/login', nonce: '1'.repeat(64), issuedAt: session.issuedAt, expiresAt: challenge.expiresAt });
  const auth = { challenge: vi.fn(async () => challenge), verify: vi.fn(async () => session), session: vi.fn(async (): Promise<AuthSession | null> => session), logout: vi.fn(async () => {}) } satisfies AuthTransport;
  const adapter: WalletAdapter = { id: 'test', name: 'Test Wallet', mark: 'T', kind: 'injected', installUrl: 'https://example.com', capabilities: { authentication: 'compatibility', domainBinding: 'not-enforced', messageSigning: true, transfer: true, transactionFormats: ['kaspa-transaction-json'] }, isAvailable: () => true, connect: vi.fn(async () => account), getAccount: vi.fn(async () => account), signMessage: vi.fn(async m => sign(m)), sendTransaction: vi.fn(async () => 'txid'), signTransaction: vi.fn(async () => '{"signed":true}'), subscribe: fn => { event = fn; return () => { event = () => {}; }; } };
  const client = createGhostlink({ app: { name: 'App', url: 'https://app.example' }, adapters: [adapter, kaspiumAdapter()], auth, ...config }); clean.push(() => client.destroy());
  const completed = vi.fn(); client.onAuthenticated(completed);
  return { client, adapter, auth, challenge, session, completed, event: () => event(), login: async () => { await client.connect('test'); return client.authenticate(); } };
}
describe('controller security transitions', () => {
  it('preserves the connection review when focus restoration finds no login session yet', async () => {
    const f = fixture(); f.auth.session.mockResolvedValue(null);
    await f.client.connect('test');
    await f.client.restoreSession();
    expect(f.auth.session).toHaveBeenCalledOnce();
    expect(f.client.getSnapshot()).toMatchObject({ open: true, step: 'review', account, connection: 'connected', authentication: 'unauthenticated', session: null });
    expect(f.adapter.signMessage).not.toHaveBeenCalled(); expect(f.auth.verify).not.toHaveBeenCalled();
    await f.client.prepareAuthentication();
    expect(f.client.getSnapshot().step).toBe('sign');
    await f.client.authenticate();
    expect(f.client.getSnapshot().authentication).toBe('authenticated');
    expect(f.adapter.connect).toHaveBeenCalledOnce();
  });
  it('returns to the chooser when restoration finds that an authenticated session ended', async () => {
    const f = fixture(); await f.login(); f.client.open();
    f.auth.session.mockResolvedValue(null);
    await f.client.restoreSession();
    expect(f.client.getSnapshot()).toMatchObject({ open: true, step: 'choose', authentication: 'unauthenticated', session: null });
    await expect(f.client.signMessage('message')).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(f.adapter.signMessage).toHaveBeenCalledOnce();
  });
  it('authenticates only after backend verification', async () => {
    const f = fixture(); const gate = deferred<AuthSession>(); f.auth.verify.mockImplementation(() => gate.promise);
    const observed = vi.fn(); f.client.onAuthenticated(() => { observed(f.client.getSnapshot()); });
    await f.client.connect('test'); const operation = f.client.authenticate(); await vi.waitFor(() => expect(f.auth.verify).toHaveBeenCalled());
    expect(f.client.getSnapshot()).toMatchObject({ open: true, step: 'verifying', session: null }); expect(f.completed).not.toHaveBeenCalled();
    gate.resolve(f.session); const session = await operation;
    expect(session).toEqual(f.session); expect(Object.isFrozen(session)).toBe(true);
    expect(f.client.getSnapshot()).toMatchObject({ open: false, busy: false, authentication: 'authenticated' });
    expect(f.completed).toHaveBeenCalledExactlyOnceWith(session); expect(f.auth.logout).not.toHaveBeenCalled();
    expect(observed).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ open: false, busy: false, authentication: 'authenticated', session: f.session }));
    f.client.open(); expect(f.client.getSnapshot()).toMatchObject({ open: true, step: 'connected' });
    expect(f.completed).toHaveBeenCalledTimes(1);
  });
  it('serializes approval prompts and ignores a late cancelled login', async () => {
    const f = fixture(); const gate = deferred<string>(); vi.mocked(f.adapter.signMessage).mockImplementation(() => gate.promise);
    await f.client.connect('test'); const login = f.client.authenticate(); const rejection = expect(login).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.waitFor(() => expect(f.adapter.signMessage).toHaveBeenCalled());
    await expect(f.client.authenticate()).rejects.toMatchObject({ code: 'BUSY' }); f.client.close(); gate.resolve(sign(f.challenge.message)); await rejection;
    expect(f.auth.verify).not.toHaveBeenCalled(); expect(f.client.getSnapshot().session).toBeNull(); expect(f.auth.logout).toHaveBeenCalled();
    expect(f.completed).not.toHaveBeenCalled();
  });
  it('revokes if verification completes after cancellation', async () => {
    const f = fixture(); const gate = deferred<AuthSession>(); f.auth.verify.mockImplementation(() => gate.promise);
    await f.client.connect('test'); const login = f.client.authenticate(); const rejection = expect(login).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.waitFor(() => expect(f.auth.verify).toHaveBeenCalled()); f.client.close(); gate.resolve(f.session); await rejection;
    expect(f.client.getSnapshot().session).toBeNull(); expect(f.auth.logout).toHaveBeenCalled();
    expect(f.completed).not.toHaveBeenCalled();
  });
  it('supports manual authentication and restoration without live connectivity', async () => {
    const f = fixture(); await f.client.connect('kaspium'); await f.client.prepareAuthentication(account.address); await f.client.authenticate({ signature: sign(f.challenge.message) });
    expect(f.client.getSnapshot()).toMatchObject({ open: false, connection: 'manual', authentication: 'authenticated' });
    expect(f.completed).toHaveBeenCalledExactlyOnceWith(f.session);
    await f.client.restoreSession(); expect(f.client.getSnapshot().session?.address).toBe(account.address);
    await expect(f.client.signMessage('message')).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    await f.client.disconnect(); expect(f.auth.logout).toHaveBeenCalled();
  });
  it.each(['empty', 'throws', 'missing'] as const)('restores authentication while a saved wallet is %s, then reconnects without signing', async mode => {
    vi.stubGlobal('localStorage', { getItem: () => 'test' });
    const f = fixture(); const subscribe = vi.spyOn(f.adapter, 'subscribe');
    f.adapter.isAvailable = vi.fn(() => mode !== 'missing');
    if (mode === 'throws') vi.mocked(f.adapter.getAccount).mockRejectedValue(new Error('Wallet initializing'));
    else vi.mocked(f.adapter.getAccount).mockResolvedValue(null);
    await f.client.restoreSession();
    expect(f.client.getSnapshot()).toMatchObject({ session: f.session, authentication: 'authenticated', connection: 'disconnected' });
    expect(f.auth.logout).not.toHaveBeenCalled(); expect(subscribe).not.toHaveBeenCalled();
    await expect(f.client.signMessage('message')).rejects.toMatchObject({ code: 'UNSUPPORTED' });

    f.adapter.isAvailable = () => true; vi.mocked(f.adapter.getAccount).mockResolvedValue(account);
    await f.client.restoreSession(); await f.client.restoreSession();
    expect(f.client.getSnapshot()).toMatchObject({ session: f.session, connection: 'connected', walletId: 'test', account });
    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(f.adapter.connect).not.toHaveBeenCalled(); expect(f.adapter.signMessage).not.toHaveBeenCalled();
    expect(f.auth.verify).not.toHaveBeenCalled(); expect(f.auth.logout).not.toHaveBeenCalled();
    expect(f.completed).not.toHaveBeenCalled();
  });
  it.each(['empty', 'throws'] as const)('retains an existing login when a restoration lookup is %s', async mode => {
    const f = fixture(); await f.login();
    if (mode === 'throws') vi.mocked(f.adapter.getAccount).mockRejectedValue(new Error('Wallet locked'));
    else vi.mocked(f.adapter.getAccount).mockResolvedValue(null);
    await f.client.restoreSession();
    expect(f.client.getSnapshot()).toMatchObject({ session: f.session, authentication: 'authenticated', connection: 'disconnected', balance: null });
    expect(f.auth.logout).not.toHaveBeenCalled();
    await expect(f.client.sendTransaction({ toAddress: account.address, amountSompi: 1n })).rejects.toMatchObject({ code: 'UNSUPPORTED' });
    expect(f.adapter.sendTransaction).not.toHaveBeenCalled();
    vi.mocked(f.adapter.getAccount).mockResolvedValue(account); await f.client.restoreSession();
    expect(f.client.getSnapshot().connection).toBe('connected');
    f.event(); await vi.waitFor(() => expect(f.auth.logout).toHaveBeenCalledOnce());
    expect(f.client.getSnapshot().session).toBeNull();
  });
  it.each(['address', 'network'] as const)('still revokes restoration when the wallet reports a different %s', async field => {
    vi.stubGlobal('localStorage', { getItem: () => 'test' });
    const f = fixture();
    vi.mocked(f.adapter.getAccount).mockResolvedValue(field === 'address' ? { ...account, address: 'kaspatest:other' } : { ...account, network: 'mainnet' });
    await f.client.restoreSession();
    expect(f.client.getSnapshot()).toMatchObject({ session: null, authentication: 'unauthenticated' });
    expect(f.auth.logout).toHaveBeenCalledOnce();
  });
  it('does not restore a wallet lookup that completes after sign-out', async () => {
    vi.stubGlobal('localStorage', { getItem: () => 'test' });
    const f = fixture(); const gate = deferred<typeof account | null>();
    vi.mocked(f.adapter.getAccount).mockImplementation(() => gate.promise);
    const restore = f.client.restoreSession(); const stale = expect(restore).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.waitFor(() => expect(f.adapter.getAccount).toHaveBeenCalled());
    await f.client.disconnect(); gate.resolve(account); await stale;
    expect(f.client.getSnapshot()).toMatchObject({ session: null, authentication: 'unauthenticated', connection: 'disconnected' });
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
    expect(f.completed).not.toHaveBeenCalled();
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
describe('authentication completion', () => {
  it.each(['test', 'kaspium'])('can keep account details open after verified %s login', async wallet => {
    const f = fixture({ closeOnAuthenticate: false });
    await f.client.connect(wallet);
    const session = await f.client.authenticate(wallet === 'kaspium' ? { address: account.address, signature: sign(f.challenge.message) } : {});
    expect(f.client.getSnapshot()).toMatchObject({ open: true, step: 'connected', busy: false, session });
    expect(f.completed).toHaveBeenCalledExactlyOnceWith(session);
    f.client.close(); expect(f.client.getSnapshot().session).toEqual(session);
    expect(f.auth.logout).not.toHaveBeenCalled();
  });
  it('signals only fresh logins, not restoration, account details, balance or message requests', async () => {
    const f = fixture();
    await f.client.restoreSession(); expect(f.completed).not.toHaveBeenCalled();
    await f.login(); expect(f.completed).toHaveBeenCalledTimes(1);
    await f.client.restoreSession(); f.client.open(); await f.client.refreshBalance(); await f.client.signMessage('A separate request');
    expect(f.completed).toHaveBeenCalledTimes(1);
    await f.client.disconnect(); await f.login(); expect(f.completed).toHaveBeenCalledTimes(2);
  });
  it('lets a host begin its next operation after authentication releases the lock', async () => {
    const f = fixture(); let continuation: Promise<string> | undefined;
    f.client.onAuthenticated(() => { continuation = f.client.signMessage('Continue the host flow'); });
    await f.login(); await expect(continuation).resolves.toBe(sign('Continue the host flow'));
    expect(f.adapter.signMessage).toHaveBeenLastCalledWith('Continue the host flow');
    expect(f.completed).toHaveBeenCalledTimes(1);
  });
  it.each(['rejection', 'verification failure', 'session mismatch'])('does not signal completion after %s', async failure => {
    const f = fixture();
    if (failure === 'rejection') vi.mocked(f.adapter.signMessage).mockRejectedValue(new GhostlinkError('USER_REJECTED', 'Rejected'));
    else if (failure === 'verification failure') f.auth.verify.mockRejectedValue(new GhostlinkError('INVALID_SIGNATURE', 'Invalid signature'));
    else f.auth.verify.mockResolvedValue({ ...f.session, network: 'mainnet' });
    await f.client.connect('test'); await expect(f.client.authenticate()).rejects.toBeInstanceOf(GhostlinkError);
    expect(f.completed).not.toHaveBeenCalled();
    expect(f.client.getSnapshot()).toMatchObject({ open: true, step: 'error', session: null });
  });
  it('isolates synchronous and asynchronous host errors from successful authentication', async () => {
    const f = fixture(); const report = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      f.client.onAuthenticated(() => { throw new Error('Host navigation failed'); });
      f.client.onAuthenticated(async () => { throw new Error('Host continuation failed'); });
      const otherHost = vi.fn(); f.client.onAuthenticated(otherHost);
      await expect(f.login()).resolves.toEqual(f.session);
      await vi.waitFor(() => expect(report).toHaveBeenCalledTimes(2));
      expect(otherHost).toHaveBeenCalledExactlyOnceWith(f.session);
      expect(f.client.getSnapshot()).toMatchObject({ open: false, authentication: 'authenticated', error: null });
    } finally { report.mockRestore(); }
  });
  it('removes unsubscribed listeners and does not notify after destruction during verification', async () => {
    const f = fixture(); const removed = vi.fn(); const unsubscribe = f.client.onAuthenticated(removed); unsubscribe();
    await f.login(); expect(removed).not.toHaveBeenCalled(); f.completed.mockClear();
    const gate = deferred<AuthSession>(); f.auth.verify.mockImplementation(() => gate.promise);
    await f.client.connect('test'); const operation = f.client.authenticate(); const rejection = expect(operation).rejects.toMatchObject({ code: 'CANCELLED' });
    await vi.waitFor(() => expect(f.auth.verify).toHaveBeenCalledTimes(2));
    f.client.destroy(); gate.resolve(f.session); await rejection;
    expect(f.completed).not.toHaveBeenCalled();
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
