import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { injectWallet, login } from './helpers';
import type { Page } from '@playwright/test';

async function connectScreenshot(page: Page, background: string) {
  // Use an identical backdrop and pixel position; the example and harness have different layouts.
  await page.addStyleTag({ content: `body,.example{background:${background}!important}` });
  const button = page.getByRole('button', { name: 'Connect wallet', exact: true }).first();
  await button.evaluate(el => { el.id = 'parity-button'; });
  const isolation = await page.addStyleTag({ content: 'body *{visibility:hidden!important}#parity-button,#parity-button *{visibility:visible!important}' });
  await button.evaluate(el => Object.assign(el.style, { position: 'fixed', left: '32px', top: '32px' }));
  const screenshot = await button.screenshot({ animations: 'disabled' });
  await button.evaluate(el => ['position', 'left', 'top'].forEach(property => el.style.removeProperty(property)));
  await button.evaluate(el => el.removeAttribute('id'));
  await isolation.evaluate(el => el.remove());
  return screenshot;
}

for (const width of [1280, 390]) for (const theme of ['dark', 'light']) test(`Vue ${theme} chooser at ${width}px matches reviewed baseline`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.goto('/');
  await expect(page.getByRole('region', { name: 'Wallet requests', exact: true })).toHaveCount(0);
  if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
  await page.evaluate(() => document.fonts.ready);
  expect(await page.evaluate(() => document.fonts.check('600 20px Sora'))).toBe(true);
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content', theme === 'dark' ? '#0C0D11' : '#F3F3F5');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await test.info().attach(`example-${theme}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true }).first()).toHaveScreenshot(`connect-${theme}-${width}.png`);
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await expect(dialog.locator('.gl-wallet-name')).toHaveText(['KasWare', 'Kastle']);
  await expect(dialog.getByRole('textbox', { name: 'Search wallets' })).toHaveCount(0);
  await expect(dialog.getByLabel('Wallet categories')).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: /mobile|hardware|Kaspium/i })).toHaveCount(0);
  await expect(dialog).toHaveScreenshot(`chooser-${theme}-${width}.png`);
  const violations = (await new AxeBuilder({ page }).include('dialog').analyze()).violations; expect(violations).toEqual([]);
  const box = await dialog.boundingBox(); expect(box!.width).toBe(width === 1280 ? 440 : 358);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

for (const theme of ['dark', 'light']) test(`native Vue and React ${theme} rendering is visually identical`, async ({ page, context }) => {
  await page.goto('/');
  if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
  await page.evaluate(() => document.fonts.ready);
  const background = theme === 'dark' ? '#0c0d11' : '#f3f3f5';
  const vueButton = await connectScreenshot(page, background);
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.addStyleTag({ content: `body{background:${background}!important}body>:not(dialog){visibility:hidden!important}` });
  const vue = await page.getByRole('dialog').screenshot({ animations: 'disabled' });
  const reactPage = await context.newPage(); await reactPage.goto('/react.html');
  // The development harness renders dark defaults; exercise the shared light selector without adding UI.
  await reactPage.locator('.gl-theme').evaluateAll((elements, theme) => elements.forEach(el => el.setAttribute('data-ghostlink-theme', theme)), theme);
  await reactPage.evaluate(() => document.fonts.ready);
  const reactButton = await connectScreenshot(reactPage, background);
  expect(reactButton.equals(vueButton), 'Both renderers should produce identical connect controls').toBe(true);
  await reactPage.getByRole('button', { name: 'Connect wallet', exact: true }).click();
  await expect(reactPage.locator('.gl-wallet-name')).toHaveText(['KasWare', 'Kastle']);
  await expect(reactPage.getByRole('textbox', { name: 'Search wallets' })).toHaveCount(0);
  await expect(reactPage.getByLabel('Wallet categories')).toHaveCount(0);
  await expect(reactPage.getByRole('button', { name: /mobile|hardware|Kaspium/i })).toHaveCount(0);
  await reactPage.addStyleTag({ content: `body{background:${background}!important}body>:not(dialog){visibility:hidden!important}` });
  const react = await reactPage.getByRole('dialog').screenshot({ animations: 'disabled' });
  expect(react.equals(vue), 'Both renderers should produce identical modal pixels on the same background').toBe(true);
});

for (const theme of ['dark', 'light']) test(`${theme} overrides propagate to the teleported modal and connect control`, async ({ page }) => {
  await page.goto('/');
  if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
  await page.getByRole('button', { name: 'Try custom branding' }).click();
  const button = page.getByRole('button', { name: 'Connect wallet', exact: true }).first();
  await expect(button).toHaveCSS('background-color', 'rgb(185, 229, 215)');
  await expect(button).toHaveCSS('color', 'rgb(19, 41, 33)');
  await expect(button.locator('circle').first()).toHaveCSS('fill', 'rgb(19, 41, 33)');
  await button.click();
  await expect(page.locator('.gl-title')).toHaveCSS('font-family', 'Figtree, sans-serif');
  await expect(page.locator('dialog .gl-link')).toHaveCSS('color', theme === 'dark' ? 'rgb(127, 200, 169)' : 'rgb(47, 125, 91)');
  await page.getByRole('dialog').evaluate(el => Promise.all(el.getAnimations().map(animation => animation.finished)));
  expect((await new AxeBuilder({ page }).include('dialog').analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await page.getByRole('button', { name: 'Default branding' }).click();
  await expect(button).toHaveCSS('background-color', theme === 'dark' ? 'rgb(243, 244, 247)' : 'rgb(19, 21, 26)');
});

for (const theme of ['dark', 'light']) test(`${theme} tokens follow the brand while geometry stays unchanged`, async ({ page }) => {
  const brand = readFileSync(new URL('../../docs/design/brand/Ghostlink Brand.dc.html', import.meta.url), 'utf8');
  const palette = brand.match(theme === 'dark' ? /:root\{([^}]+)\}/ : /\[data-theme="light"\]\{([^}]+)\}/)![1]!;
  await page.goto('/');
  if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
  const button = page.getByRole('button', { name: 'Connect wallet', exact: true }).first();
  await expect(button).toHaveCSS('background-color', theme === 'dark' ? 'rgb(243, 244, 247)' : 'rgb(19, 21, 26)');
  await expect(button).toHaveCSS('color', theme === 'dark' ? 'rgb(12, 13, 17)' : 'rgb(255, 255, 255)');
  await expect(button.locator('svg')).toHaveAttribute('aria-hidden', 'true');
  await button.click();
  for (const [source, token] of [['bg','bg'],['surf','surface'],['surf2','surface-2'],['ink','text'],['ink2','text-secondary'],['ink3','text-muted'],['acc','accent'],['line','line'],['line2','line-strong'],['danger','danger'],['dangerSoft','danger-soft'],['dangerLine','danger-line'],['ok','success'],['chip','chip']]) {
    const value = palette.match(new RegExp(`--${source}:([^;]+);`))?.[1]; expect(value).toBeTruthy();
    expect(await page.getByRole('dialog').evaluate((el, token) => getComputedStyle(el).getPropertyValue(token).trim(), `--ghostlink-${token}`)).toBe(value);
  }
  await expect(page.getByRole('dialog')).toHaveCSS('border-radius', '20px');
  await expect(page.locator('.gl-body')).toHaveCSS('padding', '18px');
  await expect(page.locator('.gl-header')).toHaveCSS('padding', '15px 18px');
  await expect(page.locator('.gl-wallet').first()).toHaveCSS('border-radius', '13px');
  const wallet = page.locator('.gl-wallet').first();
  await wallet.hover();
  await expect(wallet).toHaveCSS('background-color', theme === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(14, 16, 22, 0.06)');
  await expect(wallet).toHaveCSS('border-top-color', theme === 'dark' ? 'rgba(255, 255, 255, 0.22)' : 'rgba(14, 16, 22, 0.2)');
  await test.info().attach(`wallet-hover-${theme}`, { body: await wallet.screenshot(), contentType: 'image/png' });
  await page.getByRole('button', { name: 'Close', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(wallet).toBeFocused();
  const focusColor = theme === 'dark' ? 'rgb(141, 148, 157)' : 'rgb(102, 109, 118)';
  await expect(wallet).toHaveCSS('outline-color', focusColor);
  await expect(wallet).toHaveCSS('outline-width', '2px');
  await test.info().attach(`wallet-focus-${theme}`, { body: await page.getByRole('dialog').screenshot(), contentType: 'image/png' });
  await page.keyboard.press('Tab');
  await expect(page.locator('.gl-wallet').nth(1)).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Get started →' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
});

for (const width of [1280, 390]) for (const theme of ['dark', 'light']) test(`authenticated ${theme} button at ${width}px retains the supplied address-control layout`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 });
  await injectWallet(page, 'kastle', 'normal', 'mainnet');
  await login(page, 'Kastle', '/', 'mainnet');
  if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
  await page.evaluate(() => document.fonts.ready);
  const button = page.locator('.example-header .gl-connect');
  await expect(button).toHaveText(/kaspa:qpu…[a-z0-9]{4}/);
  await expect(button).toHaveScreenshot(width === 1280 ? `authenticated-${theme}.png` : `authenticated-${theme}-${width}.png`);
  await expect(button).toHaveCSS('background-color', theme === 'dark' ? 'rgb(20, 22, 27)' : 'rgb(255, 255, 255)');
  await page.getByRole('button', { name: 'Try custom branding' }).click();
  await expect(button).toHaveCSS('background-color', 'rgb(185, 229, 215)');
  await expect(button).toHaveCSS('color', 'rgb(19, 41, 33)');
  await expect(page.locator('.example-panel .gl-primary').first()).toHaveCSS('background-color', 'rgb(185, 229, 215)');
  await expect(page.locator('.example-panel .gl-primary').first()).toHaveCSS('color', 'rgb(19, 41, 33)');
  await expect(button).toHaveCSS('border-top-color', 'rgb(47, 125, 91)');
  await button.click();
  await expect(page.getByRole('heading', { name: 'Session active' })).toBeVisible();
});
