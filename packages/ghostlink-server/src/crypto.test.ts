import { describe, expect, it } from 'vitest';
import { account, keyAccount, sdk, sign } from '../../../tests/fixtures/keys';
import { validateKaspaAddress, verifyKaspaSignature } from './crypto';

describe('official Kaspa message signatures', () => {
  // Upstream rusty-kaspa v2.0.1 wallet/core/src/message.rs, test case 0.
  it('verifies a published upstream vector independently of fixture signing', () => {
    const publicKey = 'f9308a019258c31049344f85f89d5229b531c845836f99b08601f113bce036f9';
    const signature = '40b9bb2be0ae02607279eda64015a8d86e3763279170340b8243f7ce5344d77aff1191598baf2fd26149cac3b4b12c2c433261c00834db6098cb172aa48ef522';
    const address = keyAccount('3'.padStart(64, '0')).address;
    expect(verifyKaspaSignature({ address, network: 'testnet-11', publicKey, signature, message: 'Hello Kaspa!' })).toBe(true);
    expect(verifyKaspaSignature({ address, network: 'testnet-11', publicKey, signature, message: 'Not Hello Kaspa!' })).toBe(false);
  });
  it('extracts the public key from the address for manual signing', () => {
    expect(validateKaspaAddress(account.address, account.network).publicKey).toBe(account.publicKey.slice(2));
    expect(verifyKaspaSignature({ ...account, publicKey: undefined, message: 'こんにちは世界', signature: sign('こんにちは世界') })).toBe(true);
  });
  it('rejects a valid signature from the wrong key', () => {
    const other = keyAccount('2'.padStart(64, '0'));
    expect(verifyKaspaSignature({ ...account, publicKey: other.publicKey, message: 'login', signature: sign('login', '2'.padStart(64, '0')) })).toBe(false);
  });
  it.each(['00', '00'.repeat(64), 'ff'.repeat(65), 'not a signature'])('rejects malformed or invalid signatures %s', signature => {
    expect(verifyKaspaSignature({ ...account, message: 'login', signature })).toBe(false);
  });
  it('rejects bad checksums, wrong prefixes and ECDSA accounts', () => {
    expect(() => validateKaspaAddress(account.address.slice(0, -1) + 'q', account.network)).toThrow();
    expect(() => validateKaspaAddress(account.address, 'mainnet')).toThrow();
    const pub = new sdk.PublicKey(account.publicKey); const ecdsa = pub.toAddressECDSA('testnet-11');
    expect(() => validateKaspaAddress(ecdsa.toString(), account.network)).toThrow();
    ecdsa.free(); pub.free();
  });
});
