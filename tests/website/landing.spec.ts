import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync } from 'node:fs';
mkdirSync('artifacts/website', { recursive: true });

for (const width of [360, 390, 768, 1280]) for (const theme of ['dark', 'light']) {
  test(`landing ${theme} ${width}: layout, accessibility and visual evidence`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kaspa wallet login for your dApp.');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.mouse.move(0, 0);
    await info.attach(`landing-${theme}-${width}`, { body: await page.screenshot({ path: `artifacts/website/landing-${theme}-${width}.png`, fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
    if (width === 390 || width === 1280) await expect(page).toHaveScreenshot(`landing-${theme}-${width}.png`, { fullPage: true, animations: 'disabled' });
    await expect(page.locator('.landing')).toHaveAttribute('data-theme', theme);
    expect(await page.locator('h1').evaluate(el => getComputedStyle(el).fontFamily)).toContain('Sora');
  });
}

test('truthful content, tabs, keyboard access, links and unavailable package', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  for (const label of ['TypeScript', 'Vue', 'React']) {
    const button = page.getByRole('button', { name: label, exact: true });
    await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Integration code')).toContainText(label === 'TypeScript' ? 'createGhostlink' : 'GhostlinkConnectButton');
  }
  await expect(page.getByRole('button', { name: 'Package coming soon', exact: true })).toHaveCount(2);
  for (const button of await page.getByRole('button', { name: 'Package coming soon', exact: true }).all()) await expect(button).toBeDisabled();
  const wallets = page.locator('#wallets');
  await expect(wallets.getByText('Supported', { exact: true })).toHaveCount(2);
  await expect(wallets.getByText('Beta', { exact: true })).toHaveCount(0);
  await expect(wallets.getByText('Planned', { exact: true })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/11kB|seven-day|2,000 lines|@ghostlink\/sdk|relay reconnect|all nine states|Kaspium|Kaspire|KSPR|Kuro|Tangem|Ledger|mobile|hardware/i);
  await page.getByRole('link', { name: 'Wallets', exact: true }).hover();
  await expect(page.getByRole('link', { name: 'Wallets', exact: true })).toHaveCSS('color', 'rgb(243, 244, 247)');
  await page.getByRole('link', { name: 'Wallets', exact: true }).click(); await expect(page).toHaveURL(/#wallets$/);
  await page.getByRole('link', { name: 'How it works', exact: true }).click(); await expect(page).toHaveURL(/#how$/);
  for (const link of await page.locator('a[href]').all()) expect(await link.getAttribute('href')).toMatch(/^(\/|#|https:\/\/github.com\/ghostdagger-labs\/ghostlink$)/);
  await page.getByRole('link', { name: 'Read the docs', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Documentation coming soon.');
  await page.goBack(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kaspa wallet login for your dApp.');
  await page.goto('/'); await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('Get Started opens the existing demo; styles do not leak on return', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get Started', exact: true }).click();
  await expect(page).toHaveURL(/\/demo$/);
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
  await page.getByRole('button', { name: 'Use light theme' }).click();
  await page.locator('.example-logo').click();
  await expect(page.locator('.landing')).toHaveCSS('background-color', 'rgb(12, 13, 17)');
  await expect(page.locator('header a[href="/docs"]').last()).toHaveCSS('background-color', 'rgb(141, 123, 255)');
});

test('public HTML is server rendered and no verifier ships to browsers', async ({ request }) => {
  const response = await request.get('/'); const html = await response.text();
  expect(html).toContain('Kaspa wallet login for your dApp.');
  expect(html).not.toContain('support.js'); expect(html).not.toContain('kaspa_bg.wasm');
  expect((await request.get('/docs')).status()).toBe(200);
});
