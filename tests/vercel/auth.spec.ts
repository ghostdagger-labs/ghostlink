import { expect, test } from '@playwright/test';
import { injectWallet, login, expectSignedIn } from '../browser/helpers';

for (const wallet of ['KasWare', 'Kastle'] as const) {
  test(`${wallet}: production example login, protected request, restoration, and revocation`, async ({ page, context }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await injectWallet(page, wallet === 'KasWare' ? 'kasware' : 'kastle');
    await login(page, wallet);
    await page.getByRole('button', { name: 'Test protected request' }).click();
    await expect(page.locator('.result')).toContainText('Protected request succeeded.');
    const cookies = await context.cookies();
    expect(cookies.filter(cookie => cookie.name.startsWith('ghostlink-')).every(cookie => cookie.httpOnly && cookie.sameSite === 'Lax')).toBe(true);
    const copiedCookie = cookies.map(cookie => `${cookie.name}=${cookie.value}`).join('; ');
    await page.reload(); await expectSignedIn(page);
    expect((await page.request.get('/api/private')).status()).toBe(200);
    await page.getByRole('button', { name: 'Sign out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Test protected request' })).toBeDisabled();
    await expect.poll(async () => (await page.request.get('/api/private', { headers: { cookie: copiedCookie } })).status()).toBe(401);
    await page.reload();
    await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('waits for network-change revocation before allowing another wallet connection', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeEnabled();
  let resume!: () => void;
  const waiting = new Promise<void>(resolve => { resume = resolve; });
  await page.route('**/auth/ghostlink/logout', async route => { await waiting; await route.continue(); });
  try {
    await page.getByLabel('Network', { exact: true }).selectOption('testnet-10');
    await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeDisabled();
  } finally { resume(); }
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true })).toBeEnabled();
  await expect(page).toHaveURL(/network=testnet-10/);
});

test('example rejects untrusted origins and missing CSRF without caching identity', async ({ request }) => {
  const bootstrap = await request.get('/auth/ghostlink/session');
  expect(bootstrap.status()).toBe(200);
  expect(bootstrap.headers()['cache-control']).toBe('no-store');
  expect((await request.get('/auth/ghostlink/session', { headers: { host: 'evil.example', 'x-forwarded-host': 'localhost:3200' } })).status()).toBe(400);
  expect((await request.post('/auth/ghostlink/logout', { data: {}, headers: { origin: 'https://evil.example' } })).status()).toBe(400);
  expect((await request.post('/auth/ghostlink/logout', { data: {}, headers: { origin: 'http://localhost:3200' } })).status()).toBe(403);
  expect((await request.get('/api/private', { headers: { 'sec-fetch-site': 'cross-site' } })).status()).toBe(403);
  const privateResponse = await request.get('/api/private');
  expect(privateResponse.status()).toBe(401);
  expect(privateResponse.headers()['cache-control']).toBe('no-store');
});
