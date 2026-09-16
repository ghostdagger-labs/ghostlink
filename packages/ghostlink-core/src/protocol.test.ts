import { describe, expect, it } from 'vitest';
import { accountId, chainId, formatKas, parseKasAmount, parseLoginMessage, serializeLoginMessage } from './protocol';
import { account } from '../../../tests/fixtures/keys';
import fixture from '../../../tests/fixtures/login-v1.json';
const fields = { domain: 'app.example', uri: 'https://app.example/login', ...account, nonce: 'a'.repeat(64), issuedAt: '2026-09-16T12:00:00.000Z', expiresAt: '2026-09-16T12:05:00.000Z' };
describe('proposed authentication profile conformance', () => {
  const message = serializeLoginMessage(fields);
  const context = { origin: 'https://app.example', network: account.network, now: Date.parse(fields.issuedAt) };
  it('preserves the published v1 fixture byte-for-byte', () => {
    expect(message).toBe(fixture.message);
    expect(Buffer.from(message).toString('hex')).toBe(fixture.utf8Hex);
  });
  it('separates native addresses, account segments and chains', () => {
    expect(chainId(account.network)).toBe('kaspa:testnet-11');
    expect(accountId(account.address, account.network)).toBe(`kaspa:testnet-11:${account.address.split(':')[1]}`);
    expect(message.split('\n')[1]).toBe(account.address.split(':')[1]);
    expect(parseLoginMessage(message, context)).toMatchObject({ address: account.address });
  });
  it('rejects domain mismatch, wrong scheme, account/network changes and expiry', () => {
    expect(() => parseLoginMessage(message, { ...context, origin: 'https://evil.example' })).toThrow();
    expect(() => parseLoginMessage(message, { ...context, origin: 'http://app.example' })).toThrow();
    expect(() => parseLoginMessage(message, { ...context, network: 'mainnet' })).toThrow();
    expect(() => parseLoginMessage(message, { ...context, network: 'testnet-10' })).toThrow();
    expect(() => parseLoginMessage(message, { ...context, now: Date.parse(fields.expiresAt) })).toThrow();
    expect(() => parseLoginMessage(message, { ...context, now: context.now - 30_001 })).toThrow();
  });
  it('roundtrips the distinct Testnet 10 chain without treating it as Testnet 11', () => {
    const testnet10 = serializeLoginMessage({ ...fields, network: 'testnet-10' });
    expect(parseLoginMessage(testnet10, { ...context, network: 'testnet-10' })).toMatchObject({ network: 'testnet-10', address: account.address });
    expect(() => parseLoginMessage(testnet10, context)).toThrow();
    expect(testnet10).not.toBe(message);
  });
  it.each(['\n', ' ', '\r'])('rejects added serialization byte %j', suffix => expect(() => parseLoginMessage(message + suffix, context)).toThrow());
  it('rejects extra fields, ambiguous time and unsafe audience', () => {
    expect(() => serializeLoginMessage({ ...fields, issuedAt: '2026-09-16T12:00:00Z' })).toThrow();
    expect(() => serializeLoginMessage({ ...fields, uri: 'javascript:alert(1)' })).toThrow();
    expect(() => serializeLoginMessage({ ...fields, expiresAt: fields.issuedAt })).toThrow();
    expect(() => parseLoginMessage(message.replace('Request ID:', 'Extra:'), context)).toThrow();
  });
});
describe('sompi amounts', () => {
  it.each(['0', '0.00000001', '12.12345678', '90071992.54740993'])('roundtrips %s without floating point', amount => expect(formatKas(parseKasAmount(amount))).toBe(amount));
  it.each(['-1', '1e8', 'NaN', '.5', '01', '0.000000001', '1 ', ''])('rejects %s', value => expect(() => parseKasAmount(value)).toThrow());
});
