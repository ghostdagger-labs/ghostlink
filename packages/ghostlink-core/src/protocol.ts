export const PROFILE = 'ghostlink-kaspa-v1' as const;
export const NETWORKS = ['mainnet', 'testnet-10', 'testnet-11'] as const;
export type Network = typeof NETWORKS[number];
export type ChainId = `kaspa:${Network}`;
export const addressPrefix = (network: Network) => network === 'mainnet' ? 'kaspa' : 'kaspatest';
export const chainId = (network: Network): ChainId => `kaspa:${network}`;
export function isNetwork(value: unknown): value is Network { return NETWORKS.includes(value as Network); }
export function accountId(address: string, network: Network): string {
  const prefix = `${addressPrefix(network)}:`;
  if (!address.startsWith(prefix) || !/^[a-z0-9]+$/.test(address.slice(prefix.length))) throw new Error('Address does not match the selected network.');
  return `${chainId(network)}:${address.slice(prefix.length)}`;
}
export interface LoginMessageFields {
  domain: string; address: string; network: Network; uri: string; nonce: string;
  issuedAt: string; expiresAt: string;
}
/** Proposed Kaspa profile. Cryptography and address checksum validation belong to the official SDK. */
export function serializeLoginMessage(f: LoginMessageFields): string {
  if (!isNetwork(f.network) || !/^[a-f0-9]{64}$/.test(f.nonce)) throw new Error('Invalid login fields.');
  const url = new URL(f.uri);
  if (!['http:', 'https:'].includes(url.protocol) || url.href !== f.uri || url.host !== f.domain || url.username || url.password || url.hash) throw new Error('Invalid login audience.');
  if (!f.domain || /[\s\r\n]/.test(f.domain)) throw new Error('Invalid login domain.');
  for (const date of [f.issuedAt, f.expiresAt]) {
    if (new Date(date).toISOString() !== date) throw new Error('Non-canonical timestamp.');
  }
  if (Date.parse(f.expiresAt) <= Date.parse(f.issuedAt) || Date.parse(f.expiresAt) - Date.parse(f.issuedAt) > 300_000) throw new Error('Invalid challenge lifetime.');
  const account = accountId(f.address, f.network).split(':')[2]!;
  const message = `${f.domain} wants you to sign in with your Kaspa account:\n${account}\n\nSign in to this application. This signature does not authorize a transaction.\n\nURI: ${f.uri}\nVersion: 1\nNonce: ${f.nonce}\nIssued At: ${f.issuedAt}\nExpiration Time: ${f.expiresAt}\nChain ID: ${chainId(f.network)}\nRequest ID: ${PROFILE}`;
  if (message.length > 2000) throw new Error('Login message exceeds the supported wallet limit.');
  return message;
}
/** Strict proposed-profile parser. A wallet must also compare against its independently trusted origin. */
export function parseLoginMessage(message: string, context: { origin: string; network: Network; now?: number }): LoginMessageFields {
  if (message.length > 2000 || message.includes('\r')) throw new Error('Invalid login message.');
  const lines = message.split('\n');
  const domain = lines[0]?.replace(/ wants you to sign in with your Kaspa account:$/, '') ?? '';
  const value = (line: number, prefix: string) => { if (!lines[line]?.startsWith(prefix)) throw new Error('Invalid message field.'); return lines[line]!.slice(prefix.length); };
  const network = value(10, 'Chain ID: ').replace(/^kaspa:/, '');
  if (!isNetwork(network) || network !== context.network) throw new Error('Wrong authentication network.');
  const fields: LoginMessageFields = { domain, address: `${addressPrefix(network)}:${lines[1]}`, network, uri: value(5, 'URI: '), nonce: value(7, 'Nonce: '), issuedAt: value(8, 'Issued At: '), expiresAt: value(9, 'Expiration Time: ') };
  if (serializeLoginMessage(fields) !== message) throw new Error('Non-canonical login message.');
  const origin = new URL(context.origin);
  if (origin.origin !== context.origin || new URL(fields.uri).origin !== origin.origin || domain !== origin.host) throw new Error('Login domain mismatch.');
  const now = context.now ?? Date.now();
  if (Date.parse(fields.expiresAt) <= now || Date.parse(fields.issuedAt) > now + 30_000) throw new Error('Login message expired or not yet valid.');
  return fields;
}
export function parseKasAmount(value: string): bigint {
  if (!/^(0|[1-9]\d*)(\.\d{1,8})?$/.test(value)) throw new Error('Enter an amount with at most eight decimal places.');
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole!) * 100_000_000n + BigInt(fraction.padEnd(8, '0'));
}
export function formatKas(value: bigint): string {
  const sign = value < 0n ? '-' : ''; const n = value < 0n ? -value : value;
  const fraction = (n % 100_000_000n).toString().padStart(8, '0').replace(/0+$/, '');
  return `${sign}${n / 100_000_000n}${fraction ? '.' + fraction : ''}`;
}
export function shortenAddress(value: string): string { return value.length > 22 ? `${value.slice(0, value.indexOf(':') + 4)}…${value.slice(-4)}` : value; }
