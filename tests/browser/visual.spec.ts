import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { injectWallet, login } from './helpers';

for (const width of [1280, 390]) for (const theme of ['dark', 'light']) test(`Vue ${theme} chooser at ${width}px matches reviewed baseline`, async ({ page }) => {
  await page.setViewportSize({ width, height: 1000 }); await page.goto('/');
  if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
  await page.evaluate(() => document.fonts.ready);
  await expect(page.getByRole('button', { name: 'Connect wallet', exact: true }).first()).toHaveScreenshot(`connect-${theme}-${width}.png`);
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  const dialog = page.getByRole('dialog'); await expect(dialog).toBeVisible();
  await expect(dialog).toHaveScreenshot(`chooser-${theme}-${width}.png`);
  const violations = (await new AxeBuilder({ page }).include('dialog').analyze()).violations; expect(violations).toEqual([]);
  const box = await dialog.boundingBox(); expect(box!.width).toBe(width === 1280 ? 440 : 358);
  expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
});

test('native Vue and React chooser rendering is visually identical', async ({ page, context }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click(); await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: 'body{background:#0e0f11!important}body>:not(dialog){visibility:hidden!important}' });
  const vue = await page.getByRole('dialog').screenshot({ animations: 'disabled' });
  const reactPage = await context.newPage(); await reactPage.goto('/react.html'); await reactPage.getByRole('button', { name: 'Connect wallet', exact: true }).click(); await reactPage.evaluate(() => document.fonts.ready);
  await reactPage.addStyleTag({ content: 'body{background:#0e0f11!important}body>:not(dialog){visibility:hidden!important}' });
  const react = await reactPage.getByRole('dialog').screenshot({ animations: 'disabled' });
  expect(react.equals(vue), 'Both renderers should produce identical modal pixels on the same background').toBe(true);
});

test('theme overrides propagate to the teleported modal and connect control', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Try custom branding' }).click();
  const button = page.getByRole('button', { name: 'Connect wallet', exact: true }).first();
  await expect(button).toHaveCSS('background-color', 'rgb(185, 229, 215)'); await button.click();
  await expect(page.locator('.gl-tab[aria-pressed=true]')).toHaveCSS('background-color', 'rgb(185, 229, 215)');
  await expect(page.locator('.gl-title')).toHaveCSS('font-family', 'Figtree, sans-serif');
});

test('shared tokens and geometry retain the preserved prototype values', async ({ page }) => {
  const original = readFileSync(new URL('../../docs/design/Ghostlink UI/Ghostlink Prototype.html', import.meta.url), 'utf8');
  await page.goto('/'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  for (const [prototype, token] of [['surf','surface'],['surf2','surface-2'],['ink','text'],['ink2','text-secondary'],['ink3','text-muted'],['accent','accent'],['danger','danger'],['ok','success']]) {
    const value = original.match(new RegExp(`--${prototype}:([^;]+);`))?.[1]; expect(value).toBeTruthy();
    expect(await page.getByRole('dialog').evaluate((el, token) => getComputedStyle(el).getPropertyValue(token).trim(), `--ghostlink-${token}`)).toBe(value);
  }
  await expect(page.getByRole('dialog')).toHaveCSS('border-radius', '20px');
  await expect(page.locator('.gl-body')).toHaveCSS('padding', '18px');
  await expect(page.locator('.gl-header')).toHaveCSS('padding', '15px 18px');
  await expect(page.locator('.gl-wallet').first()).toHaveCSS('border-radius', '13px');
});

for (const theme of ['dark', 'light']) test(`authenticated ${theme} button retains the supplied address-control layout`, async ({ page }) => {
  await injectWallet(page, 'kastle', 'normal', 'mainnet');
  await login(page, 'Kastle', '/', 'mainnet');
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  if (theme === 'light') await page.getByRole('button', { name: 'Use light theme' }).click();
  await page.evaluate(() => document.fonts.ready);
  const button = page.locator('.example-header .gl-connect');
  await expect(button).toHaveText(/kaspa:qpu…[a-z0-9]{4}/);
  await expect(button).toHaveScreenshot(`authenticated-${theme}.png`);
  await button.click();
  await expect(page.getByRole('heading', { name: 'Session active' })).toBeVisible();
});
