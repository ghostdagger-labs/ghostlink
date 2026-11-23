import { test, expect } from '@playwright/test';
import { expectSignedIn, injectWallet } from './helpers';

export function connectionFocusCase(route: '/' | '/react.html' | '/demo') {
  test(`KasWare: returning from connection approval preserves the sign-in review on ${route}`, async ({ page }) => {
    await injectWallet(page, 'kasware', 'normal', 'testnet-10');
    await page.goto(route);
    if (route !== '/react.html') await page.getByLabel('Network', { exact: true }).selectOption('testnet-10');
    await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
    await page.getByRole('button', { name: /KasWare Browser wallet Installed/ }).click();
    await expect(page.getByRole('heading', { name: 'Review session' })).toBeVisible();

    // Wallet approval finishes before the popup returns focus to the application.
    const restoration = page.waitForResponse(response => response.url().endsWith('/auth/ghostlink/session'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    const response = await restoration;
    expect((await response.json()).session).toBeNull();
    await response.finished();
    await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))));
    await expect(page.getByRole('heading', { name: 'Review session' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Connect a Kaspa wallet' })).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).__walletCalls)).toEqual([]);
    expect((await page.request.get('/api/private')).status()).toBe(401);

    await page.getByRole('button', { name: 'Continue to sign in' }).click();
    await page.getByRole('button', { name: 'Sign message', exact: true }).click();
    await expectSignedIn(page);
    expect(await page.evaluate(() => (window as any).__walletCalls)).toEqual(['signMessage']);
    expect((await page.request.get('/api/private')).status()).toBe(200);
  });
}

export function restorationCases(route: '/' | '/demo') {
  for (const wallet of ['KasWare', 'Kastle'] as const) for (const fault of ['empty', 'throws'] as const) {
    test(`${wallet}: reload preserves login when account lookup ${fault}, then restores connectivity`, async ({ page }) => {
      await injectWallet(page, wallet === 'KasWare' ? 'kasware' : 'kastle', 'normal', 'mainnet');
      await page.goto(route);
      await page.getByLabel('Network', { exact: true }).selectOption('mainnet');
      await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
      await page.getByRole('button', { name: new RegExp(`${wallet} Browser wallet Installed`) }).click();
      await page.getByRole('button', { name: 'Continue to sign in' }).click();
      await page.getByRole('button', { name: 'Sign message', exact: true }).click();
      await expectSignedIn(page);
      await page.evaluate(value => sessionStorage.setItem('ghostlink:fixture:account-lookup', value), fault);
      const logoutRequests: string[] = [];
      page.on('request', request => { if (request.url().endsWith('/auth/ghostlink/logout')) logoutRequests.push(request.url()); });

      await page.reload();
      await expect(page.getByRole('heading', { name: 'Ownership verified' })).toBeVisible();
      await expect(page.getByText('Authentication only', { exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Request message signature' })).toBeDisabled();
      await page.getByRole('button', { name: 'Test protected API' }).click();
      await expect(page.locator('.example-result')).toContainText('Your protected backend request succeeded.');
      expect(logoutRequests).toEqual([]);

      await page.evaluate(() => {
        sessionStorage.removeItem('ghostlink:fixture:account-lookup');
        window.dispatchEvent(new Event('focus'));
      });
      await expect(page.getByRole('button', { name: 'Request message signature' })).toBeEnabled();
      await expect(page.getByText('Authentication only', { exact: true })).toHaveCount(0);
      expect(await page.evaluate(() => (window as any).__walletCalls)).toEqual([]);
      expect(logoutRequests).toEqual([]);

      // A confirmed provider event must still revoke authentication after recovery.
      const logout = page.waitForResponse(response => response.url().endsWith('/auth/ghostlink/logout'));
      await page.evaluate(() => (window as any).__emitWallet('accountsChanged'));
      expect((await logout).status()).toBe(200);
      await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
      expect((await page.request.get('/api/private')).status()).toBe(401);
      expect(logoutRequests).toHaveLength(1);
    });
  }
}
