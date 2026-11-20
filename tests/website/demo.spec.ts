import { test, expect } from '@playwright/test';
import { injectWallet, login } from '../browser/helpers';

for (const wallet of ['KasWare', 'Kastle'] as const) test(`${wallet}: Nuxt login, API, reload and sign out`, async ({ page }) => {
  await injectWallet(page, wallet === 'KasWare' ? 'kasware' : 'kastle', 'normal', wallet === 'KasWare' ? 'testnet-11' : 'testnet-10');
  await page.goto('/demo');
  await page.getByLabel('Network', { exact: true }).selectOption(wallet === 'KasWare' ? 'testnet-11' : 'testnet-10');
  await login(page, wallet, '/demo');
  await page.getByRole('button', { name: 'Test protected API' }).click();
  await expect(page.locator('.example-result')).toContainText('Your protected backend request succeeded.');
  await page.reload(); await expect(page.getByRole('heading', { name: 'Ownership verified' })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
  expect((await page.request.get('/api/private')).status()).toBe(401);
});

test('demo chooser and onboarding expose only browser wallets', async ({ page }) => {
  await page.goto('/demo'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.locator('.gl-wallet-name')).toHaveText(['KasWare', 'Kastle']);
  await expect(dialog.getByRole('textbox', { name: 'Search wallets' })).toHaveCount(0);
  await expect(dialog.getByLabel('Wallet categories')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /mobile|hardware|Kaspium/i })).toHaveCount(0);
  await page.getByRole('button', { name: 'Get started →', exact: true }).click();
  await expect(dialog.getByRole('link')).toHaveText(['KasWare', 'Kastle']);
});

test('rejection and expired challenges never report successful login', async ({ page }) => {
  await injectWallet(page, 'kasware', 'reject'); await page.goto('/demo');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: /KasWare Browser/ }).click();
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await page.getByRole('button', { name: 'Sign message', exact: true }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ownership verified' })).not.toBeVisible();
  await page.goto('/demo'); await page.clock.install();
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: /KasWare Browser/ }).click();
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Confirm signature' })).toBeVisible();
  await page.clock.fastForward(301_000);
  await page.getByRole('button', { name: 'Sign message', exact: true }).click();
  await expect(page.getByRole('alert')).toContainText('expired');
  expect(await page.evaluate(() => (window as any).__walletCalls)).toEqual([]);
  expect((await page.request.get('/api/private')).status()).toBe(401);
});

test('authentication routes preserve host, origin and method validation', async ({ request }) => {
  expect((await request.get('/api/health')).status()).toBe(200);
  expect((await request.get('/auth/ghostlink/session')).status()).toBe(200);
  expect([400, 403]).toContain((await request.get('/auth/ghostlink/session', { headers: { Host: 'untrusted.example' } })).status());
  expect((await request.post('/auth/ghostlink/challenge', { headers: { Origin: 'https://untrusted.example' }, data: {} })).status()).toBe(400);
  expect((await request.post('/api/private')).status()).toBe(403);
});

test('client navigation disposes the demo provider subscriptions', async ({ page }) => {
  await injectWallet(page); await page.goto('/');
  await expect(page.getByRole('button', { name: 'Use light theme' })).toBeEnabled();
  await page.evaluate(() => {
    const fixture = window as any;
    fixture.__activeSubscriptions = 0;
    const on = fixture.kasware.on; const off = fixture.kasware.removeListener;
    fixture.kasware.on = (...args: any[]) => { fixture.__activeSubscriptions++; return on(...args); };
    fixture.kasware.removeListener = (...args: any[]) => { fixture.__activeSubscriptions--; return off(...args); };
  });
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: /KasWare Browser/ }).click();
  await expect.poll(() => page.evaluate(() => (window as any).__activeSubscriptions)).toBe(3);
  await page.goBack();
  await expect(page.locator('.landing')).toBeVisible();
  await expect.poll(() => page.evaluate(() => (window as any).__activeSubscriptions)).toBe(0);
  await expect(page.locator('dialog[open]')).toHaveCount(0);
});
