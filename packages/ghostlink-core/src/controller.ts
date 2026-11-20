import { defaultAdapters } from './adapters.js';
import { createAuthClient } from './auth-client.js';
import { accountId, addressPrefix, isNetwork, formatKas, parseLoginMessage } from './protocol.js';
import type { Network } from './protocol.js';
import { GhostlinkError } from './types.js';
import type { AuthSession, AuthTransport, AuthenticationListener, GhostlinkConfig, GhostlinkSnapshot, WalletAdapter, WalletAccount, TransactionRequest, TransferRequest } from './types.js';

/** Framework-neutral controller. Construction is passive; providers own browser attachment. */
export class Ghostlink {
  /** Application metadata copied and frozen at construction. */
  readonly app: GhostlinkConfig['app'];
  /** Configured wallet adapters. Discovery and capability checks start after attachment. */
  readonly adapters: readonly WalletAdapter[];
  private readonly auth: AuthTransport;
  private readonly closeOnAuthenticate: boolean;
  private state: GhostlinkSnapshot;
  private listeners = new Set<() => void>();
  private authenticationListeners = new Set<AuthenticationListener>();
  private epoch = 0;
  private destroyed = false;
  private locked = false;
  private unsubscribeWallet?: () => void;
  private timer?: ReturnType<typeof setInterval>;
  private channel?: BroadcastChannel;
  private revokeTask: Promise<void> | null = null;
  private nextRevocationAttempt = 0;
  private revocationFailures = 0;
  private restoration: Promise<void> | null = null;
  private restorationAbort?: AbortController;
  private attachments = 0;
  private uiHosts = 0;
  private review: { resolve: () => void; reject: (error: Error) => void } | null = null;

  /** Validate configuration without browser I/O. Safe during SSR; use a client per request. */
  constructor(config: GhostlinkConfig) {
    this.app = Object.freeze({ ...config.app });
    const appUrl = new URL(config.app.url);
    if (!['http:', 'https:'].includes(appUrl.protocol)) throw new Error('Application URL must use HTTP(S).');
    this.adapters = config.adapters ?? defaultAdapters();
    if (new Set(this.adapters.map(a => a.id)).size !== this.adapters.length) throw new Error('Wallet IDs must be unique.');
    this.auth = config.auth && 'challenge' in config.auth ? config.auth : createAuthClient(config.auth);
    this.closeOnAuthenticate = config.closeOnAuthenticate ?? true;
    const network = config.network ?? 'testnet-11';
    if (!isNetwork(network)) throw new Error('Unsupported network.');
    // Construction is passive, including adapter capability getters and discovery.
    // SSR and the first hydration render must observe the same initial snapshot.
    this.state = Object.freeze({ initialization: 'idle', initializationError: null, open: false, step: 'choose', busy: false, network, walletId: null, account: null, connection: 'disconnected', authentication: 'unauthenticated', session: null, challenge: null, balance: null, error: null, revocationPending: false, wallets: [], request: null });
  }
  /** Read the current read-only snapshot. Its identity is stable until the next controller update. */
  getSnapshot = (): GhostlinkSnapshot => this.state;
  /** Subscribe to future updates, without an initial notification. Call the returned function to unsubscribe. */
  subscribe = (listener: () => void): (() => void) => { this.listeners.add(listener); return () => this.listeners.delete(listener); };
  /** Observe fresh verified logins after busy clears; restoration and connection do not emit. Returns an unsubscribe function. Listener promises are not awaited; failures are logged. */
  onAuthenticated = (listener: AuthenticationListener): (() => void) => {
    if (!this.destroyed) this.authenticationListeners.add(listener);
    return () => { this.authenticationListeners.delete(listener); };
  };
  private patch(change: Partial<GhostlinkSnapshot>) {
    if (this.destroyed) return;
    this.state = Object.freeze({ ...this.state, ...change });
    for (const listener of this.listeners) listener();
  }
  /** Acquire browser activity and begin session restoration; passive on the server. Returns an idempotent release function. Final release stops activity/pending work and preserves established sessions. Providers manage this automatically. Throws CANCELLED after destroy(). */
  attach = (): (() => void) => {
    if (this.destroyed) throw new GhostlinkError('CANCELLED', 'Ghostlink has been destroyed.');
    if (typeof window === 'undefined') return () => {};
    this.attachments++;
    if (this.attachments === 1) {
      this.patch({ initialization: 'idle', initializationError: null });
      this.startBrowserLifecycle();
      this.initializeIfNeeded();
    }
    let released = false;
    return () => {
      if (released || this.destroyed) return;
      released = true;
      if (--this.attachments === 0) this.deactivate();
    };
  };
  private initializeIfNeeded() {
    if (this.attachments && this.state.initialization === 'idle' && !this.locked && !this.state.challenge) {
      void this.restoreSession().catch(() => { /* Readiness exposes the failure to consumers. */ });
    }
  }
  private deactivate() {
    const pendingAuth = !!this.state.challenge || this.state.authentication === 'authenticating';
    this.epoch++;
    this.restorationAbort?.abort(); this.restorationAbort = undefined;
    this.restoration = null;
    this.unsubscribeWallet?.(); this.unsubscribeWallet = undefined;
    clearInterval(this.timer); this.timer = undefined;
    if (this.channel) { this.channel.onmessage = null; this.channel.close(); this.channel = undefined; }
    if (typeof window !== 'undefined') {
      window.removeEventListener('focus', this.onFocus);
      window.removeEventListener('online', this.onOnline);
      window.removeEventListener('kasware#initialized', this.refreshWallets);
    }
    this.review?.reject(new GhostlinkError('CANCELLED', 'This request was cancelled.'));
    this.review = null;
    this.patch({ initialization: 'idle', initializationError: null, open: false, challenge: null, request: null,
      connection: 'disconnected', balance: null, account: this.state.session ? { address: this.state.session.address, network: this.state.session.network } : null,
      authentication: this.state.session ? 'authenticated' : 'unauthenticated', step: this.state.session ? 'connected' : 'choose' });
    // Established sessions survive teardown. Unfinished login attempts must still be cancelled.
    if (pendingAuth) void this.revoke();
  }
  private startBrowserLifecycle() {
    if (typeof window === 'undefined' || this.timer || this.destroyed) return;
    this.timer = setInterval(() => {
      const s = this.state.session;
      if (s && Date.parse(s.expiresAt) <= Date.now()) void this.invalidate(false);
      else if (s && this.state.initialization === 'ready' && Date.parse(s.idleExpiresAt) <= Date.now() && !this.locked && !this.restoration && !this.state.challenge) {
        // Protected application requests may have extended the server's idle deadline.
        // Recheck it only when our last known deadline expires; do not keep idle sessions alive by polling.
        void this.restoreSession().catch(() => { /* A failed check leaves readiness unresolved. */ });
      }
      if (this.state.revocationPending && Date.now() >= this.nextRevocationAttempt) void this.revoke();
    }, 1000);
    window.addEventListener('focus', this.onFocus);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('kasware#initialized', this.refreshWallets);
    if (typeof BroadcastChannel !== 'undefined') {
      this.channel = new BroadcastChannel(`ghostlink:${new URL(this.app.url).origin}`);
      this.channel.onmessage = (event: MessageEvent) => { if (event.data === 'invalidate') void this.invalidate(false); };
    }
  }
  private onFocus = () => { this.refreshWallets(); if (!this.locked) void this.restoreSession().catch(() => {}); };
  private onOnline = () => { if (this.state.revocationPending) void this.revoke(); };
  /** Refresh wallet availability and capability hints without requesting approval. */
  refreshWallets = () => {
    this.patch({ wallets: this.adapters.map(a => ({ id: a.id, name: a.name, kind: a.kind, mark: a.mark, icon: a.icon, installUrl: a.installUrl, available: a.isAvailable(), capabilities: { ...a.capabilities } })) });
  };
  /** Open wallet selection or existing session details. Does not itself authenticate or restore a session. */
  open = () => { this.refreshWallets(); this.patch({ open: true, step: this.state.session ? 'connected' : 'choose', error: null }); };
  /** Close the modal and cancel pending local work/login. An established backend session is preserved. */
  close = () => {
    const pendingAuth = this.state.authentication === 'authenticating' || !!this.state.challenge;
    this.epoch++;
    this.review?.reject(new GhostlinkError('CANCELLED', 'This request was cancelled.')); this.review = null;
    this.patch({ open: false, challenge: null, request: null, authentication: this.state.session ? 'authenticated' : 'unauthenticated' });
    if (pendingAuth) void this.revoke();
  };
  /** Advanced custom UI: register a request-review host and call its release once on unmount. Supplied modals handle this; headless requests go directly to wallet approval. */
  attachUI = () => { this.uiHosts++; return () => { this.uiHosts--; if (!this.uiHosts && this.review) this.close(); }; };
  /** Advanced custom UI: accept the pending application review; wallet approval is still required. */
  confirmRequest = () => { this.review?.resolve(); this.review = null; };
  private async reviewRequest(title: string, message: string) {
    if (!this.uiHosts) return;
    this.patch({ open: true, step: 'sign', request: { title, message } });
    await new Promise<void>((resolve, reject) => { this.review = { resolve, reject }; });
    this.patch({ step: 'connecting', request: null });
  }
  /** Advanced custom UI: select wallet onboarding content; does not open a closed modal. */
  showWalletHelp = () => this.patch({ step: 'getwallet' });
  /** Cancel the current review/login and return to wallet selection or established session details. */
  back = () => { const pending = !!this.state.challenge || this.state.authentication === 'authenticating'; this.epoch++; this.review?.reject(new GhostlinkError('CANCELLED', 'This request was cancelled.')); this.review = null; this.patch({ step: this.state.session ? 'connected' : 'choose', challenge: null, request: null, error: null, authentication: this.state.session ? 'authenticated' : 'unauthenticated' }); if (pending) void this.revoke(); };
  private adapter(): WalletAdapter {
    const a = this.adapters.find(a => a.id === this.state.walletId);
    if (!a) throw new GhostlinkError('UNAVAILABLE', 'Choose a wallet first.');
    return a;
  }
  private check(epoch: number) { if (this.destroyed || epoch !== this.epoch) throw new GhostlinkError('CANCELLED', 'This request was cancelled.'); }
  private async run<T>(operation: (epoch: number) => Promise<T>): Promise<T> {
    if (this.destroyed) throw new GhostlinkError('CANCELLED', 'Ghostlink has been destroyed.');
    if (this.locked) throw new GhostlinkError('BUSY', 'Finish or reject the pending request in your wallet first.');
    this.locked = true; const epoch = ++this.epoch;
    this.patch({ busy: true, error: null });
    try { const result = await operation(epoch); this.check(epoch); return result; }
    catch (e) {
      const error = e instanceof GhostlinkError ? e : new GhostlinkError('SERVER_ERROR', 'The request could not be completed. Please try again.');
      if (epoch === this.epoch && error.code !== 'CANCELLED') this.patch({ step: 'error', error: { code: error.code, message: error.message }, authentication: this.state.session ? 'authenticated' : 'unauthenticated' });
      throw error;
    } finally { this.locked = false; this.patch({ busy: false }); this.initializeIfNeeded(); }
  }
  /** With no ID, open wallet selection. With an ID, revoke any existing session and connect that adapter. Connection alone does not authenticate; finish with authenticate() or the modal. */
  async connect(walletId?: string): Promise<void> {
    if (!walletId) { this.open(); return; }
    await this.run(async epoch => {
      await this.finishRevocation(); this.check(epoch);
      if (this.state.session) { await this.auth.logout(); this.check(epoch); this.channel?.postMessage('invalidate'); }
      this.unsubscribeWallet?.(); this.unsubscribeWallet = undefined;
      this.patch({ open: true, walletId, account: null, session: null, challenge: null, balance: null, connection: 'disconnected', authentication: 'unauthenticated' });
      const a = this.adapter();
      if (a.kind === 'manual') { this.patch({ step: 'address', connection: 'manual' }); return; }
      if (!a.isAvailable()) throw new GhostlinkError('UNAVAILABLE', `Install ${a.name}, then return to connect.`);
      this.patch({ step: 'connecting' });
      const account = await a.connect(this.state.network); this.check(epoch);
      this.validateAccount(account);
      this.patch({ account: { ...account }, connection: 'connected', step: 'review' });
      this.unsubscribeWallet = a.subscribe?.(() => { void this.invalidate(true); });
      this.refreshWallets();
    });
  }
  private validateAccount(a: WalletAccount) {
    if (a.network !== this.state.network) throw new GhostlinkError('NETWORK_MISMATCH', `Select ${this.state.network} in your wallet.`);
    try { accountId(a.address, a.network); } catch { throw new GhostlinkError('INVALID_REQUEST', `Enter your full wallet address starting with ${addressPrefix(this.state.network)}: for ${this.state.network}.`); }
  }
  private async checkAccount(epoch: number) {
    const previous = this.state.account;
    const current = await this.adapter().getAccount(); this.check(epoch);
    if (!previous || !current || previous.address !== current.address || previous.network !== current.network) {
      void this.invalidate(true);
      throw new GhostlinkError('ACCOUNT_CHANGED', 'Your wallet account or network changed. Connect again.');
    }
    return current;
  }
  private async prepare(epoch: number, address?: string) {
    await this.finishRevocation(); this.check(epoch);
    const adapter = this.adapter();
    let account: WalletAccount;
    if (adapter.kind === 'manual') {
      // Mobile address displays and OCR often insert grouping whitespace. Normalize only
      // this pre-challenge input; the backend still checks the exact address checksum.
      account = { address: (address ?? this.state.account?.address ?? '').replace(/\s+/g, ''), network: this.state.network };
      this.validateAccount(account); this.patch({ account });
    } else account = await this.checkAccount(epoch);
    const challenge = await this.auth.challenge(account); this.check(epoch);
    if (challenge.address !== account.address || challenge.network !== account.network || challenge.profile !== 'ghostlink-kaspa-v1' || challenge.message.length > 2000) throw new GhostlinkError('INVALID_REQUEST', 'The authentication service returned an invalid challenge.');
    try {
      const fields = parseLoginMessage(challenge.message, { origin: new URL(this.app.url).origin, network: account.network });
      if (fields.address !== account.address || fields.expiresAt !== challenge.expiresAt) throw new Error('Challenge mismatch');
    } catch { throw new GhostlinkError('INVALID_REQUEST', 'The authentication challenge does not match this application and account.'); }
    this.patch({ challenge, step: adapter.kind === 'manual' ? 'manual' : 'sign', authentication: 'authenticating' });
  }
  /** Create a server login challenge for the connected account. Manual adapters accept an address; no signature is requested yet. The supplied modal manages this step. */
  prepareAuthentication = async (address?: string) => this.run(epoch => this.prepare(epoch, address));
  /** Verify a login and return its readonly session after connecting a wallet. Creates a challenge if needed; requests wallet approval or accepts a manual signature. Emits onAuthenticated after verification and closes the modal by default. */
  async authenticate(input: { address?: string; signature?: string } = {}): Promise<Readonly<AuthSession>> {
    const result = await this.run(async epoch => {
      if (!this.state.challenge) await this.prepare(epoch, input.address);
      const challenge = this.state.challenge!;
      if (Date.parse(challenge.expiresAt) <= Date.now()) throw new GhostlinkError('EXPIRED', 'This login request expired. Generate a new message.');
      const a = this.adapter(); let signature = input.signature; let publicKey = this.state.account?.publicKey;
      if (a.kind === 'manual') {
        if (!signature) throw new GhostlinkError('INVALID_REQUEST', 'Paste or scan the signature from Kaspium.');
      } else {
        await this.checkAccount(epoch);
        this.patch({ step: 'connecting' });
        if (a.capabilities.authentication === 'caip122') {
          if (!a.signIn) throw new GhostlinkError('UNSUPPORTED', 'The wallet has no supported native authentication route.');
          const result = await a.signIn(challenge); this.check(epoch);
          if (result.message !== challenge.message) throw new GhostlinkError('INVALID_REQUEST', 'The wallet changed the login message.');
          signature = result.signature; publicKey = result.publicKey ?? publicKey;
        } else signature = await a.signMessage(challenge.message);
        this.check(epoch); await this.checkAccount(epoch);
      }
      if (!/^(0x)?[0-9a-fA-F]{128}$/.test(signature!)) throw new GhostlinkError('INVALID_SIGNATURE', 'Enter the complete Schnorr signature returned by your wallet.');
      this.patch({ step: 'verifying' });
      let verified: AuthSession;
      try {
        verified = await this.auth.verify({ challengeId: challenge.id, message: challenge.message, signature: signature!.replace(/^0x/, '').toLowerCase(), publicKey });
      } finally {
        // Even a lost verification response may have created a session. Finish any
        // earlier revocation, then revoke again before a new owner can restore it.
        if (this.destroyed || epoch !== this.epoch) {
          await this.revokeTask;
          await this.revoke();
          this.check(epoch);
        }
      }
      const session = Object.freeze({ ...verified });
      this.check(epoch);
      if (session.address !== challenge.address || session.network !== challenge.network) throw new GhostlinkError('INVALID_REQUEST', 'The returned session does not match the signing account.');
      // Do not call close(): that cancels in-flight operations and revokes pending login.
      this.patch({ initialization: 'ready', initializationError: null, session, authentication: 'authenticated', challenge: null, step: 'connected', open: this.closeOnAuthenticate ? false : this.state.open });
      try { if (typeof localStorage !== 'undefined') localStorage.setItem('ghostlink:last-wallet', a.id); } catch { /* Storage is optional. */ }
      void this.refreshBalance();
      return { session, epoch };
    });
    this.check(result.epoch);
    // Host continuation runs after the operation lock is released. Its errors must
    // not turn a verified login into an authentication failure or block other hosts.
    const report = (error: unknown) => { console.error('Ghostlink onAuthenticated listener failed.', error); };
    for (const listener of [...this.authenticationListeners]) {
      if (!this.authenticationListeners.has(listener)) continue;
      try { void Promise.resolve(listener(result.session)).catch(report); } catch (error) { report(error); }
    }
    return result.session;
  }
  /** Recheck the backend session without requesting wallet approval or emitting onAuthenticated. Concurrent checks share work; failures set initializationError and reject. If an approval/challenge is active, returns without checking: inspect initialization for readiness. */
  async restoreSession(): Promise<void> {
    if (this.destroyed) throw new GhostlinkError('CANCELLED', 'Ghostlink has been destroyed.');
    if (this.locked || this.state.challenge) return;
    if (this.restoration) return this.restoration;
    const epoch = this.epoch;
    const abort = new AbortController();
    const task = (async () => {
      await this.finishRevocation(); this.check(epoch);
      this.refreshWallets();
      const session = await this.auth.session({ signal: abort.signal }); this.check(epoch);
      if (this.locked) return;
      if (!session) {
        // No login is expected before signing. Returning from wallet approval must
        // preserve the current step; reset only when an existing session ended.
        this.patch({ initialization: 'ready', initializationError: null, session: null, authentication: 'unauthenticated', step: this.state.session && this.state.open ? 'choose' : this.state.step });
        return;
      }
      if (session.network !== this.state.network) { await this.invalidate(true); return; }
      let walletId = this.state.walletId;
      if (!walletId) {
        try { if (typeof localStorage !== 'undefined') walletId = localStorage.getItem('ghostlink:last-wallet'); } catch { /* Storage is optional. */ }
      }
      const a = this.adapters.find(a => a.id === walletId);
      let account: WalletAccount | null = null;
      if (a?.kind === 'manual') this.patch({ walletId: a.id, connection: 'manual' });
      else {
        if (a?.isAvailable()) {
          try { account = await a.getAccount(); } catch { /* Wallet availability is separate from server authentication. */ }
        }
        this.check(epoch);
        if (account && (account.address !== session.address || account.network !== session.network)) { await this.invalidate(true); return; }
        if (account && a) {
          if (this.state.connection !== 'connected' || this.state.walletId !== a.id) {
            this.unsubscribeWallet?.();
            this.unsubscribeWallet = a.subscribe?.(() => { void this.invalidate(true); });
          }
          this.check(epoch);
          this.patch({ walletId: a.id, connection: 'connected' });
        } else {
          // A locked or initializing provider is not evidence that the signing account changed.
          // Retry on the next restoration/focus; signing remains blocked without a live connection.
          this.unsubscribeWallet?.(); this.unsubscribeWallet = undefined;
          this.patch({ connection: 'disconnected', balance: null });
        }
      }
      this.patch({ initialization: 'ready', initializationError: null, session, authentication: 'authenticated', account: account ?? { address: session.address, network: session.network }, step: this.state.open ? 'connected' : this.state.step });
    })().catch(cause => {
      this.check(epoch);
      const error = cause instanceof GhostlinkError ? cause : new GhostlinkError('SERVER_ERROR', 'Could not check your session. Reconnect and try again.');
      this.patch({ initialization: 'error', initializationError: { code: error.code, message: error.message } });
      throw error;
    }).finally(() => {
      // An old request must not clear a newer attachment's restoration task.
      if (this.restoration !== task) return;
      this.restoration = null;
      this.restorationAbort = undefined;
      if (epoch !== this.epoch && this.state.initialization === 'restoring') this.patch({ initialization: 'idle' });
      this.initializeIfNeeded();
    });
    this.restoration = task;
    this.restorationAbort = abort;
    this.patch({ initialization: 'restoring', initializationError: null });
    return task;
  }
  private revoke(): Promise<void> {
    this.patch({ revocationPending: true });
    this.revokeTask ??= this.auth.logout().then(() => {
      this.revocationFailures = 0; this.nextRevocationAttempt = 0;
      this.patch({ revocationPending: false });
    }).catch(() => {
      this.nextRevocationAttempt = Date.now() + Math.min(30_000, 1000 * 2 ** Math.min(this.revocationFailures++, 5));
      this.patch({ revocationPending: true });
    }).finally(() => { this.revokeTask = null; });
    return this.revokeTask;
  }
  private async finishRevocation() { if (this.state.revocationPending || this.revokeTask) { await this.revoke(); if (this.state.revocationPending) throw new GhostlinkError('SERVER_ERROR', 'Could not close the previous session. Reconnect to the server and try again.'); } }
  private async invalidate(broadcast: boolean) {
    this.epoch++; this.unsubscribeWallet?.(); this.unsubscribeWallet = undefined;
    this.review?.reject(new GhostlinkError('CANCELLED', 'This request was cancelled.')); this.review = null;
    this.patch({ initialization: 'ready', initializationError: null, session: null, account: null, challenge: null, request: null, balance: null, authentication: 'unauthenticated', connection: 'disconnected', step: 'choose' });
    if (broadcast) this.channel?.postMessage('invalidate');
    await this.revoke();
  }
  /** Sign out locally, revoke the server session, and disconnect the wallet when possible. Can resolve with revocationPending if offline; attached clients retry. Provider cleanup does not call this. */
  async disconnect(): Promise<void> {
    const a = this.adapters.find(a => a.id === this.state.walletId);
    await this.invalidate(true);
    if (!this.locked) { try { await a?.disconnect?.(); } catch { /* Application revocation is authoritative; provider permissions may remain. */ } }
    this.patch({ walletId: null });
  }
  /** Change the application network. A different network signs out the current session first; the same network is a no-op. Does not switch the wallet network. */
  async setNetwork(network: Network) { if (!isNetwork(network)) throw new GhostlinkError('INVALID_REQUEST', 'Unsupported network.'); if (network !== this.state.network) { await this.disconnect(); this.patch({ network }); } }
  /** Ask the selected wallet to switch to the application network. May request wallet approval; rejects UNSUPPORTED if the adapter cannot switch. Does not authenticate. */
  async switchWalletNetwork() { const a = this.adapter(); if (!a.switchNetwork) throw new GhostlinkError('UNSUPPORTED', 'Switch networks in your wallet.'); await this.run(async epoch => { this.patch({ step: 'connecting' }); await a.switchNetwork!(this.state.network); this.check(epoch); }); }
  /** Refresh bigint sompi balance for an authenticated live wallet. No-op when unavailable; read snapshot.balance afterward. Read failures set balance to null. */
  async refreshBalance() {
    const epoch = this.epoch; const a = this.adapters.find(a => a.id === this.state.walletId);
    if (!this.state.session || this.state.connection !== 'connected' || !a?.getBalance) return;
    try { const balance = await a.getBalance(); this.check(epoch); this.patch({ balance }); } catch { if (epoch === this.epoch) this.patch({ balance: null }); }
  }
  private async signing<T>(operation: (a: WalletAdapter, epoch: number) => Promise<T>): Promise<T> {
    return this.run(async epoch => {
      if (!this.state.session || this.state.connection !== 'connected') throw new GhostlinkError('UNSUPPORTED', 'This operation requires an authenticated live wallet connection.');
      const session = await this.auth.session(); this.check(epoch);
      if (!session || session.address !== this.state.account?.address || session.network !== this.state.network) { await this.invalidate(true); throw new GhostlinkError('UNAUTHENTICATED', 'Your application session expired. Connect again.'); }
      this.patch({ session });
      await this.checkAccount(epoch); const result = await operation(this.adapter(), epoch); this.check(epoch); await this.checkAccount(epoch);
      this.patch({ step: 'connected', request: null });
      return result;
    });
  }
  /** Request a signature for a 1–2000 character message. Requires a verified session and live wallet; rechecks identity and requests approval. Returns the wallet signature; concurrent approvals reject BUSY. */
  signMessage = (message: string) => this.signing(async (a, epoch) => { if (!message || message.length > 2000) throw new GhostlinkError('INVALID_REQUEST', 'Messages must contain 1–2000 characters.'); await this.reviewRequest('Signature request', message); this.check(epoch); await this.checkAccount(epoch); return a.signMessage(message); });
  /** Request approval to sign supported native transaction JSON for the current account/network. Requires an authenticated live wallet. Returns signed data and never broadcasts. */
  signTransaction = (input: TransactionRequest) => { const request = Object.freeze({ ...input }); return this.signing(async (a, epoch) => {
    if (request.network !== this.state.network || request.address !== this.state.account?.address) throw new GhostlinkError('NETWORK_MISMATCH', 'The transaction account and network must match this session.');
    if (!a.signTransaction || !a.capabilities.transactionFormats.includes(request.format)) throw new GhostlinkError('UNSUPPORTED', 'This transaction format is not supported by your wallet.');
    if (!request.payload || request.payload.length > 1_000_000) throw new GhostlinkError('INVALID_REQUEST', 'Invalid transaction size.');
    try { JSON.parse(request.payload); } catch { throw new GhostlinkError('INVALID_REQUEST', 'Enter a valid serialized JSON transaction.'); }
    await this.reviewRequest('Transaction signature', `Network: ${request.network}\nAccount: ${request.address}\nFormat: ${request.format}\n\nReview the complete inputs, outputs, change and fee in your wallet. This request signs only and does not broadcast.`); this.check(epoch);
    await this.checkAccount(epoch);
    return a.signTransaction(request);
  }); };
  /** Request approval to sign and broadcast a transfer; returns its transaction ID. Requires an authenticated live wallet with transfer capability. Amounts and priority fees are bigint sompi. */
  sendTransaction = (input: TransferRequest) => { const request = Object.freeze({ ...input }); return this.signing(async (a, epoch) => {
    if (!a.sendTransaction || !a.capabilities.transfer) throw new GhostlinkError('UNSUPPORTED', 'This wallet does not support automated transfers.');
    if (typeof request.amountSompi !== 'bigint' || (request.priorityFeeSompi !== undefined && typeof request.priorityFeeSompi !== 'bigint') || request.amountSompi <= 0n || (request.priorityFeeSompi ?? 0n) < 0n) throw new GhostlinkError('INVALID_REQUEST', 'Enter a positive transfer amount and a nonnegative fee.');
    try { accountId(request.toAddress, this.state.network); } catch { throw new GhostlinkError('NETWORK_MISMATCH', 'The recipient address must match this network.'); }
    await this.reviewRequest('Confirm transfer', `Network: ${this.state.network}\nTo: ${request.toAddress}\nAmount: ${formatKas(request.amountSompi)} KAS\nPriority fee: ${formatKas(request.priorityFeeSompi ?? 0n)} KAS\n\nThe wallet displays the final network fee. Approving in your wallet will sign and broadcast this transfer.`); this.check(epoch);
    await this.checkAccount(epoch);
    return a.sendTransaction(request);
  }); };
  /** Permanently retire this client and clear subscriptions/browser resources. Idempotent; preserves established backend sessions but cancels unfinished logins. Use the release function from attach() for reusable lifecycles, including React effect cleanup. */
  destroy() {
    if (this.destroyed) return;
    this.attachments = 0;
    this.deactivate();
    this.listeners.clear(); this.authenticationListeners.clear(); this.destroyed = true;
  }
}
/** Create a passive, SSR-safe client. Keep it stable for the provider lifetime and separate per SSR request. Providers attach on mount; headless consumers call attach() and later call the returned release function. */
export const createGhostlink = (config: GhostlinkConfig): Ghostlink => new Ghostlink(config);
