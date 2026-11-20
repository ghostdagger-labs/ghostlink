import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import type { Network } from '../../packages/ghostlink-core/src/protocol';
import { keyAccount, sign } from '../fixtures/keys';
export async function injectWallet(page: Page, wallet: 'kasware' | 'kastle' = 'kasware', mode: 'normal' | 'reject' | 'defer' = 'normal', network: Network = wallet === 'kastle' ? 'testnet-10' : 'testnet-11') {
  await page.exposeFunction('__testSign', (message: string) => sign(message));
  await page.addInitScript(({ account, wallet, mode }) => {
    const test = window as unknown as Record<string, any>;
    const listeners = new Map<string, Set<() => void>>();
    test.__walletCalls = [];
    test.__emitWallet = (event: string) => listeners.get(event)?.forEach(fn => fn());
    const readAccount = () => {
      const fault = sessionStorage.getItem('ghostlink:fixture:account-lookup');
      if (fault === 'throws') throw new Error('Wallet is still initializing');
      return fault === 'empty' ? null : account;
    };
    const p = {
      requestAccounts: async () => [account.address], connect: async () => true,
      getAccounts: async () => { const a = readAccount(); return a ? [a.address] : []; }, getAccount: async () => readAccount(),
      getPublicKey: async () => account.publicKey, getNetwork: async () => wallet === 'kasware' ? `kaspa_${account.network.replace('-', '_')}` : account.network,
      getBalance: async () => wallet === 'kasware' ? { total: 123456789 } : { balance: '123456789' }, getVersion: async () => 'automated-test-fixture',
      signMessage: async (message: string) => { test.__walletCalls.push('signMessage'); if (mode === 'reject') throw { code: 4001 }; if (mode === 'defer') await new Promise(r => { test.__finishSign = r; }); return test.__testSign(message); },
      signPskt: async () => { test.__walletCalls.push('signPskt'); return '{"testOnly":true}'; },
      signTx: async () => { test.__walletCalls.push('signTx'); return '{"testOnly":true}'; },
      sendKaspa: async () => { test.__walletCalls.push('sendKaspa'); return 'automated-test-transaction'; },
      on: (event: string, fn: () => void) => { if (!listeners.has(event)) listeners.set(event, new Set()); listeners.get(event)!.add(fn); },
      removeListener: (event: string, fn: () => void) => listeners.get(event)?.delete(fn), disconnect: async () => {},
    };
    test[wallet] = p;
  }, { account: keyAccount(undefined, network), wallet, mode });
}
export async function login(page: Page, wallet = 'KasWare', route = '/', network?: Network) {
  await page.goto(route);
  if (route === '/' && (network || wallet === 'Kastle')) await page.getByLabel('Network', { exact: true }).selectOption(network ?? 'testnet-10');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: new RegExp(`${wallet} Browser wallet Installed`) }).click();
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await page.getByRole('button', { name: 'Sign message', exact: true }).click();
  await expectSignedIn(page);
}
export async function expectSignedIn(page: Page) {
  await expect(page.getByRole('dialog')).not.toBeVisible();
  await expect(page.getByRole('button', { name: /^Account / }).first()).toBeVisible();
}
export async function openAccount(page: Page) {
  await page.getByRole('button', { name: /^Account / }).first().click();
  await expect(page.getByRole('heading', { name: 'Session active' })).toBeVisible();
  await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
}
