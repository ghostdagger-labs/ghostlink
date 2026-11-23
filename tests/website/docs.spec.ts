import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync, mkdirSync } from 'node:fs';
import { docsManifest, docsPath } from '../../website/tools/docs-manifest';
mkdirSync('artifacts/website', { recursive: true });

for (const width of [360, 390, 768, 1280, 1460]) for (const theme of ['dark', 'light']) {
  test(`documentation ${theme} ${width}: responsive reader and accessibility`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/docs/installation');
    await expect(page.getByRole('button', { name: 'Use light theme' })).toBeEnabled();
    if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Installation');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    if (width < 768) {
      await page.getByRole('button', { name: 'Browse docs' }).click();
      const dialog = page.getByRole('dialog', { name: 'Documentation' });
      await expect(dialog).toBeVisible();
      expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
      await page.getByRole('button', { name: 'Close documentation navigation' }).click();
      await expect(page.getByRole('button', { name: 'Browse docs' })).toBeFocused();
    }
    await page.mouse.move(0, 0);
    if (width === 1460 && theme === 'dark') await page.screenshot({ path: 'artifacts/website/docs-preview.png', animations: 'disabled' });
    await info.attach(`docs-${theme}-${width}`, { body: await page.screenshot({ path: `artifacts/website/docs-${theme}-${width}.png`, fullPage: true, animations: 'disabled' }), contentType: 'image/png' });
    if ([390, 1280, 1460].includes(width)) await expect(page).toHaveScreenshot(`docs-${theme}-${width}.png`, { fullPage: true, animations: 'disabled' });
  });
}

for (const theme of ['dark', 'light']) test(`API tables and links: ${theme} reference baseline`, async ({ page }) => {
  await page.goto('/docs/core-api');
  await expect(page.getByRole('button', { name: 'Use light theme' })).toBeEnabled();
  if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
  await page.evaluate(() => document.fonts.ready);
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await expect(page).toHaveScreenshot(`docs-api-${theme}.png`, { fullPage: true, animations: 'disabled' });
});

test('every published page and its exact Markdown source are available without auth', async ({ request }) => {
  for (const entry of docsManifest) {
    const response = await request.get(docsPath(entry.slug));
    expect(response.status(), entry.slug).toBe(200);
    expect(response.headers()['set-cookie'], entry.slug).toBeUndefined();
    const html = await response.text();
    expect(html).toContain('docs-prose');
    expect(html).toContain('rel="canonical"');
    expect(html).not.toContain('support.js');
    expect(html).not.toContain('kaspa_bg.wasm');
    const raw = await request.get(`/docs/${entry.slug}.md`);
    expect(raw.status()).toBe(200);
    expect(await raw.text()).toBe(readFileSync(entry.source, 'utf8'));
  }
  expect((await request.get('/docs/does-not-exist')).status()).toBe(404);
  expect((await request.get('/__docs/does-not-exist.json')).status()).toBe(404);
  expect((await request.get('/__docs/__proto__')).status()).toBe(404);
});

test('search, raw view, section links and browser history work together', async ({ page }) => {
  const errors: string[] = [];
  const authRequests: string[] = [];
  const searchRequests: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => { if (/\/auth\/ghostlink\//.test(request.url())) authRequests.push(request.url()); });
  page.on('request', request => { if (request.url().includes('/__docs/search.json')) searchRequests.push(request.url()); });
  await page.goto('/docs');
  await expect(page.getByRole('button', { name: 'Markdown', exact: true })).toBeEnabled();
  expect(searchRequests).toEqual([]);
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('searchbox', { name: 'Search the docs', exact: true });
  await expect(search).toBeFocused();
  await search.fill('revocationPending');
  await expect(page.locator('.docs-sidebar').getByRole('link', { name: 'Provider lifecycle', exact: true })).toBeVisible();
  expect(searchRequests).toHaveLength(1);
  await search.fill('no-matching-page-xyz');
  await expect(page.locator('.docs-sidebar')).toContainText('Nothing matches');
  await search.press('Escape');
  await page.locator('.docs-sidebar').getByRole('link', { name: 'Authentication and sessions', exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/sessions$/);
  await page.getByRole('button', { name: 'Markdown', exact: true }).click();
  await expect(page.getByLabel('Markdown source')).toHaveText(readFileSync('docs/concepts/sessions.md', 'utf8'));
  await page.locator('.docs-right').getByRole('link', { name: 'Expiry and logout', exact: true }).click();
  await expect(page).toHaveURL(/#expiry-and-logout$/);
  await expect(page.getByRole('button', { name: 'Rendered', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#expiry-and-logout')).toBeFocused();
  await page.goBack();
  await page.goBack();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Introduction');
  await page.goForward();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Authentication and sessions');
  expect(errors).toEqual([]);
  expect(authRequests).toEqual([]);
});

test('copy succeeds with exact code and reports clipboard denial honestly', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/docs/installation');
  const copy = page.getByRole('button', { name: 'Copy sh code', exact: true }).first();
  await copy.click();
  const expected = await page.locator('#docs-code-0').textContent();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(expected);
  await expect(page.getByRole('status')).toHaveText('Code copied to clipboard.');
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async () => { throw new Error('Permission denied'); } }); });
  await copy.click();
  await expect(page.getByRole('status')).toContainText('Could not copy');
  await expect(copy).toHaveText('retry');
});

test('Markdown view preserves framework code through server bundling', async ({ page }) => {
  for (const framework of ['vue', 'react']) {
    await page.goto(`/docs/${framework}`);
    await page.getByRole('button', { name: 'Markdown', exact: true }).click();
    expect(await page.getByLabel('Markdown source').textContent()).toBe(readFileSync(`docs/integration/${framework}.md`, 'utf8'));
  }
});

test('mobile search, trapped focus and navigation close the drawer', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/docs');
  await expect(page.getByRole('button', { name: 'Browse docs' })).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  const dialog = page.getByRole('dialog', { name: 'Documentation' });
  const search = dialog.getByRole('searchbox', { name: 'Search the docs' });
  await expect(search).toBeFocused();
  await search.fill('Neon');
  await dialog.getByRole('link', { name: 'Postgres / Neon', exact: true }).click();
  await expect(page).toHaveURL(/\/docs\/postgres$/);
  await expect(page.getByRole('dialog')).not.toBeVisible();
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden');
  await page.getByRole('button', { name: 'Browse docs' }).click();
  await dialog.getByRole('button', { name: 'Close documentation navigation' }).focus();
  await page.keyboard.press('Shift+Tab');
  await expect(dialog.getByRole('link').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(dialog).not.toBeVisible();
});

test('direct heading links and no-JavaScript reading remain usable', async ({ browser, baseURL }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL, viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  await page.goto('/docs/installation#import-styles');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Installation');
  await expect(page.locator('#import-styles')).toBeInViewport();
  await page.getByText('Browse documentation', { exact: true }).click();
  await page.locator('.docs-mobile-fallback').getByRole('link', { name: 'React', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Integrate Ghostlink with React');
  await context.close();
});
