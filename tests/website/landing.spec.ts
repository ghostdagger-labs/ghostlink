import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdirSync, readFileSync } from 'node:fs';
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

test('published packages, working examples, keyboard access and guide links', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('/');
  for (const [label, file] of [['TypeScript', 'app.ts'], ['Vue', 'Connect.vue'], ['React', 'Connect.tsx'], ['Node', 'server.ts']]) {
    const button = page.getByRole('group', { name: 'Code examples' }).getByRole('button', { name: label, exact: true });
    await button.click(); await expect(button).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByLabel('Integration code')).toContainText(label === 'TypeScript' ? 'client.authenticate()' : label === 'Node' ? 'createGhostlinkServer' : 'GhostlinkConnectButton');
    const example = page.getByLabel('Integration code');
    expect(await example.textContent()).toBe(readFileSync(`website/snippets/${file}`, 'utf8'));
    expect(await example.locator('code span').evaluateAll(tokens => new Set(tokens.map(token => getComputedStyle(token).color)).size)).toBeGreaterThan(2);
  }
  await expect(page.locator('main')).not.toContainText(/coming soon/i);
  for (const name of ['core', 'vue', 'react', 'server']) {
    await expect(page.getByRole('link', { name: `View on npm: ghostlink-${name}`, exact: true })).toHaveAttribute('href', `https://www.npmjs.com/package/@ghostdagger/ghostlink-${name}/v/0.1.0-beta.2`);
  }
  for (const name of ['Vue', 'React', 'TypeScript']) {
    await page.getByRole('group', { name: 'Choose your framework' }).getByRole('button', { name, exact: true }).click();
    const expected = `npm install @ghostdagger/ghostlink-core@0.1.0-beta.2${name === 'TypeScript' ? '' : ` @ghostdagger/ghostlink-${name.toLowerCase()}@0.1.0-beta.2`}`;
    await expect(page.getByLabel('Frontend install command')).toHaveText(expected);
    await expect(page.getByLabel('Backend install command')).toHaveText('npm install @ghostdagger/ghostlink-server@0.1.0-beta.2');
  }
  const wallets = page.locator('#wallets');
  await expect(wallets.getByText('Supported', { exact: true })).toHaveCount(2);
  await expect(wallets.getByText('Beta', { exact: true })).toHaveCount(0);
  await expect(wallets.getByText('Planned', { exact: true })).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(/11kB|seven-day|2,000 lines|@ghostlink\/sdk|relay reconnect|all nine states|Kaspium|Kaspire|KSPR|Kuro|Tangem|Ledger|mobile|hardware/i);
  await page.getByRole('link', { name: 'Wallets', exact: true }).hover();
  await expect(page.getByRole('link', { name: 'Wallets', exact: true })).toHaveCSS('color', 'rgb(243, 244, 247)');
  await page.getByRole('link', { name: 'Wallets', exact: true }).click(); await expect(page).toHaveURL(/#wallets$/);
  await page.getByRole('link', { name: 'How it works', exact: true }).click(); await expect(page).toHaveURL(/#how$/);
  for (const link of await page.locator('a[href]').all()) expect(await link.getAttribute('href')).toMatch(/^(\/|#|https:\/\/(github\.com\/ghostdagger-labs\/ghostlink(?:[\/#]|$)|www\.npmjs\.com\/package\/@ghostdagger\/ghostlink-))/);
  await page.getByRole('link', { name: 'Read the docs', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Introduction');
  await page.goBack(); await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kaspa wallet login for your dApp.');
  await page.goto('/'); await page.keyboard.press('Tab'); await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused();
  expect(errors).toEqual([]);
});

test('Get started opens guides, demo remains reachable and styles do not leak on return', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Get started', exact: true }).click();
  await expect(page).toHaveURL(/\/docs$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Introduction');
  await page.getByRole('link', { name: 'Open the demo', exact: true }).last().click();
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
  expect(html).toContain('class="highlighted-code"');
  expect(html).not.toContain('support.js'); expect(html).not.toContain('kaspa_bg.wasm');
  expect((await request.get('/docs')).status()).toBe(200);
});
