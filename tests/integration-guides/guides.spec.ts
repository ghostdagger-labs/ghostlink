import { expect, test } from '@playwright/test';
import { injectWallet, login } from '../browser/helpers';
import { keyAccount } from '../fixtures/keys';

const signedOut = 'Signed out. Connect a wallet and sign the login message.';
const protectedMessage = 'Your protected backend request succeeded.';

for (const wallet of ['kasware', 'kastle'] as const) {
  test(`${wallet}: login, protected API, cookie restoration without a wallet, and logout`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await injectWallet(page, wallet, 'normal', 'testnet-10');
    expect((await page.request.get('/api/private')).status()).toBe(401);
    // A non-root SPA route also verifies production's index.html fallback.
    await login(page, wallet === 'kasware' ? 'KasWare' : 'Kastle', '/account');
    await expect(page.getByRole('heading', { name: 'Signed in', exact: true })).toBeVisible();
    await expect(page.getByText(protectedMessage)).toBeVisible();
    const response = await page.request.get('/api/private');
    expect(response.status()).toBe(200);
    const profile = await response.json();
    await expect(page.getByText(`Verified account: ${profile.accountId}`, { exact: true })).toBeVisible();
    expect(await page.evaluate(() => (window as any).__walletCalls)).toEqual(['signMessage']);

    // A fresh page keeps cookies but has no injected extension or fixture.
    const restored = await page.context().newPage();
    await restored.goto('/');
    await expect(restored.getByRole('heading', { name: 'Signed in', exact: true })).toBeVisible();
    await expect(restored.getByText(keyAccount(undefined, 'testnet-10').address, { exact: true })).toBeVisible();
    await expect(restored.getByText(protectedMessage)).toBeVisible();
    expect(await restored.evaluate(() => (window as any).__walletCalls)).toBeUndefined();
    const sessionCookie = (await page.context().cookies()).find(cookie => cookie.name === 'ghostlink-session');
    expect(sessionCookie?.httpOnly).toBe(true);

    const loggedOut = restored.waitForResponse(response => response.url().endsWith('/auth/ghostlink/logout'));
    await restored.getByRole('button', { name: 'Sign out', exact: true }).click();
    expect((await loggedOut).status()).toBe(200);
    await expect(restored.getByText(signedOut, { exact: true })).toBeVisible();
    await expect(restored.getByRole('region', { name: 'Protected response' })).toHaveCount(0);
    expect((await restored.request.get('/api/private')).status()).toBe(401);
    await restored.reload();
    await expect(restored.getByText(signedOut, { exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('pending and failed restoration hide identity until a successful retry', async ({ page }) => {
  await injectWallet(page, 'kasware', 'normal', 'testnet-10');
  await login(page);
  await expect(page.getByText(protectedMessage)).toBeVisible();
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route('**/auth/ghostlink/session', async route => {
    await gate;
    await route.fulfill({ status: 503, json: { error: 'Authentication service unavailable.' } });
  });
  try {
    await page.reload();
    await expect(page.getByText('Checking your session…', { exact: true })).toBeVisible();
    await expect(page.getByText(signedOut, { exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Signed in', exact: true })).toHaveCount(0);
    release();
    await expect(page.getByRole('alert')).toContainText('Authentication service unavailable.');
    await expect(page.getByRole('region', { name: 'Protected response' })).toHaveCount(0);
    await page.unroute('**/auth/ghostlink/session');
    await page.getByRole('button', { name: 'Retry session check' }).click();
    await expect(page.getByText(protectedMessage)).toBeVisible();
    expect(await page.evaluate(() => (window as any).__walletCalls)).toEqual([]);
  } finally { release(); }
});

test('a protected 401 revalidates identity instead of displaying protected content', async ({ page }) => {
  await injectWallet(page, 'kasware', 'normal', 'testnet-10');
  let expired = false;
  await page.route('**/api/private', async route => {
    // Revoke on the real server between login and the first protected request.
    const origin = new URL(route.request().url()).origin;
    const bootstrap = await page.request.get('/auth/ghostlink/session');
    const { csrfToken } = await bootstrap.json();
    const logout = await page.request.post('/auth/ghostlink/logout', {
      headers: { Origin: origin, 'X-Ghostlink-CSRF': csrfToken }, data: {},
    });
    expect(logout.status()).toBe(200);
    const response = await route.fetch();
    expect(response.status()).toBe(401);
    expired = true;
    await route.fulfill({ response });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await page.getByRole('button', { name: /KasWare Browser wallet Installed/ }).click();
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await page.getByRole('button', { name: 'Sign message', exact: true }).click();
  await expect.poll(() => expired).toBe(true);
  await expect(page.getByText(signedOut, { exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Protected response' })).toHaveCount(0);
});

test('logout discards a protected response that was still in flight', async ({ page }) => {
  await injectWallet(page, 'kasware', 'normal', 'testnet-10');
  let release!: () => void;
  let received!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  const pending = new Promise<void>(resolve => { received = resolve; });
  await page.route('**/api/private', async route => {
    const response = await route.fetch();
    received();
    await gate;
    await route.fulfill({ response });
  });
  try {
    await login(page);
    await pending;
    await expect(page.getByText('Loading protected data…', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByText(signedOut, { exact: true })).toBeVisible();
    release();
    await expect(page.getByText(protectedMessage)).toHaveCount(0);
    await expect(page.getByRole('region', { name: 'Protected response' })).toHaveCount(0);
  } finally { release(); }
});

test('offline logout reports pending server revocation and retries', async ({ page }) => {
  await injectWallet(page, 'kasware', 'normal', 'testnet-10');
  await login(page);
  await expect(page.getByText(protectedMessage)).toBeVisible();
  await page.route('**/auth/ghostlink/logout', route => route.abort('failed'));
  await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  await expect(page.getByText(signedOut, { exact: true })).toBeVisible();
  await expect(page.getByText('Signed out locally.', { exact: false })).toBeVisible();
  await page.unroute('**/auth/ghostlink/logout');
  const revoked = page.waitForResponse(response => response.url().endsWith('/auth/ghostlink/logout'));
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  expect((await revoked).status()).toBe(200);
  await expect(page.getByText('Signed out locally.', { exact: false })).toHaveCount(0);
  expect((await page.request.get('/api/private')).status()).toBe(401);
});
