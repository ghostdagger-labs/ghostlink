import { expect, test } from '@playwright/test';
import { account } from '../fixtures/keys';

for (const mode of ['react', 'vue', 'vue-plugin'] as const) {
  test(`${mode}: provider initializes without a connect button and releases a borrowed client`, async ({ page }) => {
    await page.goto('/lifecycle.html');
    await page.waitForFunction(() => !!(window as any).lifecycle);
    await page.evaluate(mode => (window as any).lifecycle.mount(mode), mode);
    await expect(page.getByTestId('state')).toHaveText('restoring|unauthenticated');
    const session = { address: account.address, network: account.network, chainId: 'kaspa:testnet-11', accountId: 'kaspa:testnet-11:fixture', issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 86_400_000).toISOString(), idleExpiresAt: new Date(Date.now() + 1_800_000).toISOString() };
    await page.evaluate(session => (window as any).lifecycle.resolve(session), session);
    await expect(page.getByTestId('state')).toHaveText('ready|authenticated');
    expect(await page.evaluate(() => (window as any).lifecycle.stats())).toMatchObject({ sessions: 1, prompts: 0, subscriptions: 1, destroyed: 0 });
    await page.evaluate(() => (window as any).lifecycle.unmount());
    const stopped = await page.evaluate(() => (window as any).lifecycle.stats());
    expect(stopped).toMatchObject({ logouts: 0, subscriptions: 0, destroyed: 0, snapshot: { initialization: 'idle', session: { address: account.address } } });
    await page.evaluate(() => { window.dispatchEvent(new Event('focus')); window.dispatchEvent(new Event('kasware#initialized')); });
    expect(await page.evaluate(() => (window as any).lifecycle.stats())).toEqual(stopped);
    await page.evaluate(mode => (window as any).lifecycle.mount(mode), mode);
    await expect(page.getByTestId('state')).toHaveText('restoring|authenticated');
    await page.evaluate(() => (window as any).lifecycle.resolve());
    await expect(page.getByTestId('state')).toHaveText('ready|authenticated');
    const restarted = await page.evaluate(() => (window as any).lifecycle.stats());
    expect(restarted).toMatchObject({ sessions: 2, logouts: 0, prompts: 0, subscriptions: 1, destroyed: 0 });
    expect(restarted.observed).toBeGreaterThan(stopped.observed);
    await page.evaluate(() => (window as any).lifecycle.unmount());
  });

  test(`${mode}: hydration starts from idle and a failed check is retryable`, async ({ page }) => {
    await page.goto('/lifecycle.html');
    await page.waitForFunction(() => !!(window as any).lifecycle);
    await page.evaluate(mode => (window as any).lifecycle.mount(mode, true), mode);
    await expect(page.getByTestId('state')).toHaveText('restoring|unauthenticated');
    await page.evaluate(() => (window as any).lifecycle.reject());
    await expect(page.getByTestId('state')).toHaveText('error|unauthenticated');
    expect(await page.evaluate(() => (window as any).lifecycle.stats())).toMatchObject({ hydrationErrors: [], snapshot: { initializationError: { code: 'SERVER_ERROR' } } });
    await page.evaluate(() => (window as any).lifecycle.retry());
    await expect(page.getByTestId('state')).toHaveText('restoring|unauthenticated');
    await page.evaluate(() => (window as any).lifecycle.resolve(null));
    await expect(page.getByTestId('state')).toHaveText('ready|unauthenticated');
    expect(await page.evaluate(() => (window as any).lifecycle.stats())).toMatchObject({ prompts: 0, logouts: 0, hydrationErrors: [], snapshot: { initializationError: null } });
    await page.evaluate(() => (window as any).lifecycle.unmount());
  });
}

test('Vue showcase distinguishes restoration failure from being signed out', async ({ page }) => {
  await page.route('**/auth/ghostlink/session', route => route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ code: 'SERVER_ERROR', error: 'Session service unavailable' }) }));
  await page.goto('/');
  await expect(page.getByRole('alert')).toHaveText('Session service unavailable');
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).not.toBeVisible();
  await page.unroute('**/auth/ghostlink/session');
  await page.getByRole('button', { name: 'Retry session check' }).click();
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
});
