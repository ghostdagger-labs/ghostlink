import { test, expect } from '@playwright/test';

for (const height of [720, 1000]) test(`long docs keep both side panes reachable and stable at ${height}px`, async ({ page }) => {
  await page.setViewportSize({ width: 1460, height });
  await page.goto('/docs/vue');
  await expect(page.getByRole('button', { name: 'Markdown', exact: true })).toBeEnabled();
  await page.evaluate(() => document.fonts.ready);
  const panes = [page.locator('.docs-sidebar'), page.locator('.docs-right')];
  await page.evaluate(() => window.scrollTo(0, 1000));
  const top = await Promise.all(panes.map(pane => pane.evaluate(element => element.getBoundingClientRect().top)));

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  for (const [index, pane] of panes.entries()) {
    await expect.poll(() => pane.evaluate(element => element.getBoundingClientRect().top)).toBeCloseTo(top[index]!, 0);
    await pane.evaluate(element => { element.scrollTop = element.scrollHeight; });
  }
  const bounds = await page.locator('.docs-right').evaluate(element => {
    const pane = element.getBoundingClientRect();
    const card = element.querySelector('.docs-demo-card')!;
    return { bottom: pane.bottom, cardBottom: card.getBoundingClientRect().bottom, cardHeight: card.clientHeight, contentHeight: card.scrollHeight };
  });
  expect(bounds.cardBottom).toBeLessThanOrEqual(bounds.bottom - 8);
  expect(bounds.contentHeight).toBeLessThanOrEqual(bounds.cardHeight);

  // At either boundary, wheel input over a pane must not scroll the article.
  await page.evaluate(() => window.scrollTo(0, 1000));
  for (const pane of panes) for (const direction of [-1, 1]) {
    await pane.evaluate((element, direction) => { element.scrollTop = direction < 0 ? 0 : element.scrollHeight; }, direction);
    await pane.hover();
    await page.mouse.wheel(0, direction * 600);
    // Native wheel scrolling settles asynchronously, after the input is dispatched.
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.scrollY)).toBe(1000);
  }

  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.locator('.docs-right').evaluate(element => { element.scrollTop = element.scrollHeight; });
  await page.screenshot({ path: `artifacts/website/docs-scroll-bottom-${height}.png`, animations: 'disabled' });
});
