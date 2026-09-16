import { test, expect } from '@playwright/test';
import { createMessageQr } from '../../packages/ghostlink-core/src/presentation';
import fixture from '../fixtures/login-v1.json' with { type: 'json' };
test('QR scanner handles dense messages and different signature patterns', async ({ page }) => {
  await page.goto('/react.html');
  const values = [fixture.message, fixture.signature, '9d5ebd745e0edd5e5e4ea42f8bb0ca463a77d7ba7f2f1e70c52b9b40af0ffe478e5fedb5788d0fe047d0a050a312ad9113c86d62151156fbf6a9b945fd0e2a72', '0'.repeat(128), 'abcdef0123456789'.repeat(8)];
  for (const text of values) {
    const url = await createMessageQr(text);
    const result = await page.evaluate(async ({ moduleUrl, url }) => {
      const { scanQrImage } = await import(/* @vite-ignore */ moduleUrl);
      return scanQrImage(new File([await (await fetch(url)).blob()], 'qr.png'));
    }, { moduleUrl: '/@fs' + new URL('../../packages/ghostlink-core/src/presentation.ts', import.meta.url).pathname, url });
    expect(result).toBe(text);
  }
});
