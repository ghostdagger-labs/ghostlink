import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { injectWallet, login } from '../browser/helpers';

test('Docker keeps the verified session across a container restart', async ({ page, request }) => {
  const container = process.env.GHOSTLINK_TEST_CONTAINER;
  test.skip(!container, 'Opt-in check: requires the dedicated local test container.');
  await injectWallet(page); await login(page, 'KasWare', '/demo');
  execFileSync('docker', ['restart', container!], { timeout: 25_000, stdio: 'pipe' });
  await expect.poll(async () => {
    try { return (await request.get('/api/health', { timeout: 1000 })).status(); } catch { return 0; }
  }).toBe(200);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Ownership verified' })).toBeVisible();
  await page.getByRole('button', { name: 'Test protected API' }).click();
  await expect(page.locator('.example-result')).toContainText('Your protected backend request succeeded.');
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click();
});
