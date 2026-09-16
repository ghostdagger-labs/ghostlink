import { GhostlinkError } from './types.js';
import type { Network } from './protocol.js';
import { isNetwork } from './protocol.js';
import type { WalletAdapter, WalletAccount, WalletCapabilities, TransferRequest } from './types.js';

type Provider = Record<string, unknown>;
function getProvider(id: string): Provider | undefined {
  return typeof window === 'undefined' ? undefined : (window as unknown as Record<string, Provider>)[id];
}
async function call(p: Provider | undefined, method: string, ...args: unknown[]): Promise<unknown> {
  if (!p || typeof p[method] !== 'function') throw new GhostlinkError('UNAVAILABLE', 'This wallet or operation is not available.');
  try { return await (p[method] as (...a: unknown[]) => Promise<unknown>).apply(p, args); }
  catch (e) {
    const err = e as { code?: unknown; message?: string };
    if (err.code === 4001 || err.code === 5000 || /reject|denied|declin|cancel/i.test(err.message ?? '')) throw new GhostlinkError('USER_REJECTED', 'The request was declined in your wallet.');
    if (e instanceof GhostlinkError) throw e;
    throw new GhostlinkError('SERVER_ERROR', 'The wallet could not complete this request. Check the wallet and try again.');
  }
}
function networkOf(raw: unknown): Network {
  const aliases: Record<string, Network> = { mainnet: 'mainnet', 'kaspa-mainnet': 'mainnet', 'kaspa_mainnet': 'mainnet', 'testnet-10': 'testnet-10', 'kaspa-testnet-10': 'testnet-10', 'kaspa_testnet_10': 'testnet-10', 'testnet-11': 'testnet-11', 'kaspa-testnet-11': 'testnet-11', 'kaspa_testnet_11': 'testnet-11' };
  const network = typeof raw === 'string' ? aliases[raw] : undefined;
  if (!isNetwork(network)) throw new GhostlinkError('NETWORK_MISMATCH', 'Select Kaspa mainnet, testnet-10, or testnet-11 in your wallet.');
  return network;
}
function stringResult(value: unknown): string { if (typeof value !== 'string' || !value) throw new GhostlinkError('INVALID_REQUEST', 'The wallet returned an invalid response.'); return value; }
function safeNumber(value: bigint): number {
  if (typeof value !== 'bigint' || value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) throw new GhostlinkError('INVALID_REQUEST', 'This wallet cannot represent that amount without losing precision.');
  return Number(value);
}
const baseCaps: WalletCapabilities = { messageSigning: true, transactionFormats: [], transfer: false, domainBinding: 'not-enforced', authentication: 'compatibility' };
function injected(id: 'kasware' | 'kastle'): WalletAdapter {
  const kasware = id === 'kasware';
  const provider = () => getProvider(id);
  function requireSupportedNetwork(network: Network) {
    // Kastle 2.60.0 has only Mainnet and TestnetT10 in its switch-screen lookup.
    // Sending testnet-11 crashes that screen despite the broader API documentation.
    if (!kasware && network === 'testnet-11') throw new GhostlinkError('UNSUPPORTED', 'Kastle supports Mainnet and Testnet 10. Close this dialog and select one of those networks in the application.');
  }
  async function getAccount(): Promise<WalletAccount | null> {
    const p = provider();
    if (!p) return null;
    const network = networkOf(await call(p, 'getNetwork'));
    if (kasware) {
      const accounts = await call(p, 'getAccounts');
      if (!Array.isArray(accounts) || accounts.length === 0) return null;
      return { address: stringResult(accounts[0]), publicKey: stringResult(await call(p, 'getPublicKey')), network };
    }
    const a = await call(p, 'getAccount') as { address?: unknown; publicKey?: unknown } | null;
    return a?.address ? { address: stringResult(a.address), publicKey: stringResult(a.publicKey), network } : null;
  }
  return {
    id, icon: kasware ? new URL('./assets/kasware.png', import.meta.url).href : new URL('./assets/kastle.png', import.meta.url).href, name: kasware ? 'KasWare' : 'Kastle', mark: kasware ? 'KW' : 'K', kind: 'injected',
    installUrl: kasware ? 'https://www.kasware.xyz/' : 'https://kastle.cc/',
    get capabilities(): WalletCapabilities {
      const p = provider();
      return { ...baseCaps, messageSigning: typeof p?.signMessage === 'function', transfer: typeof p?.sendKaspa === 'function', transactionFormats: kasware ? (typeof p?.signPskt === 'function' ? ['pskt-json'] : []) : (typeof p?.signTx === 'function' ? ['kaspa-transaction-json'] : []) };
    },
    isAvailable: () => !!provider(), getAccount,
    async connect(network) {
      requireSupportedNetwork(network);
      const result = await call(provider(), kasware ? 'requestAccounts' : 'connect');
      if (!kasware && result !== true) throw new GhostlinkError('USER_REJECTED', 'Wallet connection was not approved.');
      const a = await getAccount();
      if (!a) throw new GhostlinkError('UNAVAILABLE', 'No wallet account was shared.');
      if (a.network !== network) throw new GhostlinkError('NETWORK_MISMATCH', `Switch your wallet to ${network} and try again.`);
      return a;
    },
    async signMessage(message) { return stringResult(await call(provider(), 'signMessage', ... (kasware ? [message, { type: 'schnorr' }] : [message]))); },
    async signTransaction(request) {
      if (kasware && request.format === 'pskt-json') return stringResult(await call(provider(), 'signPskt', { txJsonString: request.payload }));
      if (!kasware && request.format === 'kaspa-transaction-json') return stringResult(await call(provider(), 'signTx', request.network, request.payload));
      throw new GhostlinkError('UNSUPPORTED', 'This wallet does not support this signing-only transaction format.');
    },
    async sendTransaction(request: TransferRequest) {
      return stringResult(await call(provider(), 'sendKaspa', request.toAddress, safeNumber(request.amountSompi), { priorityFee: safeNumber(request.priorityFeeSompi ?? 0n) }));
    },
    async getBalance() {
      const b = await call(provider(), 'getBalance') as Record<string, unknown>;
      const raw = kasware ? b.total : b.balance;
      if ((typeof raw === 'number' && !Number.isSafeInteger(raw)) || !['number', 'string', 'bigint'].includes(typeof raw)) throw new GhostlinkError('INVALID_REQUEST', 'The wallet returned an invalid balance.');
      return BigInt(raw as string);
    },
    async getVersion() { return stringResult(await call(provider(), 'getVersion')); },
    async switchNetwork(network) { requireSupportedNetwork(network); await call(provider(), 'switchNetwork', kasware ? `kaspa_${network.replace('-', '_')}` : network); },
    async disconnect() { if (kasware && typeof provider()?.disconnect === 'function') await call(provider(), 'disconnect', window.location.origin); },
    subscribe(listener) {
      const p = provider();
      if (typeof p?.on !== 'function' || typeof p.removeListener !== 'function') return () => {};
      for (const event of ['accountsChanged', 'networkChanged', 'disconnect']) (p.on as Function).call(p, event, listener);
      return () => { for (const event of ['accountsChanged', 'networkChanged', 'disconnect']) (p.removeListener as Function).call(p, event, listener); };
    },
  };
}
export const kaswareAdapter = () => injected('kasware');
export const kastleAdapter = () => injected('kastle');
export function kaspiumAdapter(): WalletAdapter {
  const unavailable = async (): Promise<never> => { throw new GhostlinkError('UNSUPPORTED', 'Kaspium uses manual message signing; there is no live wallet connection.'); };
  return { id: 'kaspium', icon: new URL('./assets/kaspium.png', import.meta.url).href, name: 'Kaspium', kind: 'manual', mark: 'KM', installUrl: 'https://kaspium.io/', capabilities: { ...baseCaps }, isAvailable: () => true, connect: unavailable, getAccount: async () => null, signMessage: unavailable };
}
export const defaultAdapters = () => [kaswareAdapter(), kastleAdapter(), kaspiumAdapter()];
