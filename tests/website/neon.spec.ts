import { expect, test } from '@playwright/test';
import { injectWallet, expectSignedIn } from '../browser/helpers';

for (const wallet of ['KasWare', 'Kastle'] as const) test(`${wallet}: real website sign-in preserves cookies, restoration and copied-cookie revocation`, async ({ page, context }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await injectWallet(page, wallet === 'KasWare' ? 'kasware' : 'kastle');
  await page.goto('/demo');
  if (wallet === 'Kastle') {
    const changed = page.waitForResponse(response => response.url().endsWith('/auth/ghostlink/logout'));
    await page.getByLabel('Network', { exact: true }).selectOption('testnet-10');
    expect((await changed).status()).toBe(200);
  }
  await page.reload();
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: new RegExp(`${wallet} Browser wallet Installed`) }).click();
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await page.getByRole('button', { name: 'Sign message', exact: true }).click();
  await expectSignedIn(page);
  await page.getByRole('button', { name: 'Test protected API' }).click();
  await expect(page.locator('.example-result')).toContainText('Your protected backend request succeeded.');
  const cookies = (await context.cookies()).filter(cookie => /^(?:__Host-)?ghostlink-/.test(cookie.name));
  expect(cookies.length).toBe(2);
  expect(cookies.every(cookie => cookie.httpOnly && cookie.sameSite === 'Lax')).toBe(true);
  if (new URL(page.url()).protocol === 'https:') {
    expect(cookies.every(cookie => cookie.secure && cookie.name.startsWith('__Host-') && cookie.path === '/')).toBe(true);
  }
  const copiedCookie = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ownership verified' })).toBeVisible();
  const authorized = await page.request.get('/api/private');
  expect(authorized.status()).toBe(200);
  expect(authorized.headers()['cache-control']).toBe('no-store');
  const logout = page.waitForResponse(response => response.url().endsWith('/auth/ghostlink/logout'));
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
  expect((await logout).status()).toBe(200);
  expect((await page.request.get('/api/private', { headers: { cookie: copiedCookie } })).status()).toBe(401);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
  expect(errors).toEqual([]);
});

test('website rejects untrusted origins and missing CSRF without caching identity', async ({ request, baseURL }) => {
  const bootstrap = await request.get('/auth/ghostlink/session');
  expect(bootstrap.status()).toBe(200);
  expect(bootstrap.headers()['cache-control']).toBe('no-store');
  expect((await request.post('/auth/ghostlink/logout', { data: {}, headers: { origin: 'https://untrusted.example' } })).status()).toBe(400);
  expect((await request.post('/auth/ghostlink/logout', { data: {}, headers: { origin: new URL(baseURL!).origin } })).status()).toBe(403);
  expect((await request.get('/api/private', { headers: { 'sec-fetch-site': 'cross-site' } })).status()).toBe(403);
  const signedOut = await request.get('/api/private');
  expect(signedOut.status()).toBe(401);
  expect(signedOut.headers()['cache-control']).toBe('no-store');
});


test('website blocks wallet connection until network-change logout completes', async ({ page }) => {
  await page.goto('/demo');
  const connect = page.getByRole('button', { name: 'Connect wallet', exact: true }).first();
  await expect(connect).toBeEnabled();
  let resume!: () => void;
  const waiting = new Promise<void>(resolve => { resume = resolve; });
  await page.route('**/auth/ghostlink/logout', async route => { await waiting; await route.continue(); });
  try {
    await page.getByLabel('Network', { exact: true }).selectOption('testnet-10');
    await expect(connect).toBeDisabled();
  } finally { resume(); }
  await expect(connect).toBeEnabled();
});
