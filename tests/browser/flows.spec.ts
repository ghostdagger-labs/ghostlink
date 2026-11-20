import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { expectSignedIn, injectWallet, login, openAccount } from './helpers';
import { account, keyAccount, sign } from '../fixtures/keys';
import { createMessageQr } from '../../packages/ghostlink-core/src/presentation';

for (const wallet of ['KasWare', 'Kastle']) test(`${wallet}: verified login, protected request and restoration`, async ({ page }) => {
  await injectWallet(page, wallet.toLowerCase() as 'kasware' | 'kastle'); await login(page, wallet);
  await openAccount(page);
  await expect(page.getByRole('dialog').getByRole('button', { name: /Test sign|Refresh balance/ })).toHaveCount(0);
  const scan = await new AxeBuilder({ page }).include('dialog').analyze(); expect(scan.violations).toEqual([]);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Wallet requests', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Test protected API' }).click(); await expect(page.locator('.example-result')).toContainText(account.address.split(':')[1]!);
  await page.reload(); await expect(page.getByRole('heading', { name: 'Ownership verified' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Wallet requests', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Sign out', exact: true }).first().click(); await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Wallet requests', exact: true })).toHaveCount(0);
  await expect(page.locator('.example-result')).toHaveCount(0);
});
test('manual Kaspium QR and paste authenticate without a provider or exported key', async ({ page }) => {
  await page.goto('/manual.html'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: /Kaspium Mobile/ }).click(); await page.getByLabel('Signing address', { exact: true }).fill(account.address);
  await page.getByRole('button', { name: 'Create login message' }).click();
  await expect(page.getByAltText('QR code containing the exact login message')).toBeVisible();
  const message = await page.locator('dialog details pre').textContent(); expect(message).toContain('URI: http://127.0.0.1:5173/');
  // Round-trip the displayed QR through the same browser scanner used for uploaded signatures.
  const decoded = await page.evaluate(async moduleUrl => {
    const { scanQrImage } = await import(/* @vite-ignore */ moduleUrl);
    const img = document.querySelector('.gl-qr-frame img') as HTMLImageElement;
    return scanQrImage(new File([await (await fetch(img.src)).blob()], 'challenge.png'));
  }, '/@fs' + new URL('../../packages/ghostlink-core/src/presentation.ts', import.meta.url).pathname);
  expect(decoded).toBe(message);
  const signature = sign(message!); const qr = await createMessageQr(signature);
  await page.getByLabel('Upload signature QR').setInputFiles({ name: 'signature.png', mimeType: 'image/png', buffer: Buffer.from(qr.split(',')[1]!, 'base64') });
  await expect(page.getByLabel('Signature from Kaspium')).toHaveValue(signature);
  await page.getByRole('button', { name: 'Verify and sign in' }).click(); await expectSignedIn(page); await openAccount(page);
  await expect(page.getByRole('dialog')).toContainText('Authentication only');
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await expect(page.getByRole('button', { name: 'Request message signature' })).toBeDisabled();
  await page.reload(); await expect(page.getByRole('heading', { name: 'Ownership verified' })).toBeVisible();
});
test('manual wrong signing key and expired challenge never authenticate', async ({ page }) => {
  await page.clock.install();
  await page.goto('/manual.html'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click(); await page.getByRole('button', { name: /Kaspium Mobile/ }).click(); await page.getByLabel('Signing address', { exact: true }).fill(account.address); await page.getByRole('button', { name: 'Create login message' }).click();
  const message = await page.locator('dialog details pre').textContent(); await page.getByLabel('Signature from Kaspium').fill(sign(message!, '2'.padStart(64, '0')));
  await page.getByRole('button', { name: 'Verify and sign in' }).click(); await expect(page.getByRole('alert')).toContainText('does not match');
  await page.getByRole('button', { name: 'Try again' }).click(); await expect(page.getByRole('heading', { name: 'Scan to sign' })).toBeVisible(); await page.clock.fastForward(301_000); await expect(page.getByRole('button', { name: 'Generate a new message' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Ownership verified' })).not.toBeVisible();
});
test('wallet rejection and late cancellation do not show success', async ({ page }) => {
  await injectWallet(page, 'kasware', 'defer'); await page.goto('/'); await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click(); await page.getByRole('button', { name: /KasWare Browser/ }).click(); await page.getByRole('button', { name: 'Continue to sign in' }).click(); await page.getByRole('button', { name: 'Sign message', exact: true }).click();
  await expect.poll(() => page.evaluate(() => typeof (window as any).__finishSign)).toBe('function');
  const logout = page.waitForResponse(r => r.url().endsWith('/logout'));
  await page.keyboard.press('Escape'); await page.evaluate(() => (window as any).__finishSign());
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
  await logout;
  expect((await (await page.request.get('/auth/ghostlink/session')).json()).session).toBeNull();
});
test('signing-only never broadcasts; transfer requires its own confirmation', async ({ page }) => {
  await injectWallet(page); await login(page);
  await page.getByText('Advanced: sign without broadcasting').click(); await page.getByLabel('Transaction format').selectOption('pskt-json'); await page.getByLabel('Serialized transaction').fill('{"fixture":true}'); await page.getByRole('button', { name: 'Request transaction signature' }).click();
  await expect(page.getByRole('dialog')).toContainText('does not broadcast'); await page.getByRole('button', { name: 'Continue in wallet' }).click();
  expect(await page.evaluate(() => (window as any).__walletCalls)).toEqual(['signMessage', 'signPskt']);
  await page.getByRole('button', { name: 'Close', exact: true }).click(); await page.getByLabel('Recipient').fill(keyAccount('2'.padStart(64, '0')).address); await page.getByLabel('Amount in KAS', { exact: true }).fill('0.00000001'); await page.getByRole('button', { name: 'Review transfer in wallet' }).click();
  await expect(page.getByRole('dialog')).toContainText('sign and broadcast'); await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__walletCalls)).not.toContain('sendKaspa');
});
test('account changes revoke the session across tabs', async ({ page, context }) => {
  await injectWallet(page); await login(page);
  const second = await context.newPage(); await injectWallet(second); await second.goto('/'); await expect(second.getByRole('heading', { name: 'Ownership verified' })).toBeVisible();
  await page.evaluate(() => (window as any).__emitWallet('accountsChanged'));
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible(); await expect(second.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
});
test('React native components complete the same authenticated flow', async ({ page }) => {
  await injectWallet(page, 'kastle'); await login(page, 'Kastle', '/react.html');
  await expect(page.getByLabel('Authentication completions')).toHaveText('1');
  await openAccount(page);
  await expect(page.getByRole('dialog').getByRole('button', { name: /Test sign|Refresh balance/ })).toHaveCount(0);
  await expect(page.getByRole('dialog')).toContainText(account.address.slice(-4));
  const scan = await new AxeBuilder({ page }).include('dialog').analyze(); expect(scan.violations).toEqual([]);
  await page.getByRole('button', { name: 'Sign out', exact: true }).click(); await expect(page.getByRole('heading', { name: 'Connect a Kaspa wallet' })).toBeVisible();
});
for (const route of ['/manual.html?keep-open', '/react.html?keep-open']) test(`host can keep account details open after authentication on ${route}`, async ({ page }) => {
  await injectWallet(page, 'kasware', 'normal', route.startsWith('/react') ? 'testnet-10' : 'testnet-11');
  await page.goto(route);
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: /KasWare Browser wallet Installed/ }).click();
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await page.getByRole('button', { name: 'Sign message', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Session active' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('button', { name: /Test sign|Refresh balance/ })).toHaveCount(0);
  expect((await page.request.get('/api/private')).status()).toBe(200);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await openAccount(page);
  await page.getByRole('dialog').getByRole('button', { name: 'Sign out', exact: true }).click();
  expect((await page.request.get('/api/private')).status()).toBe(401);
});
test('host completion fires once for login and not for reopening or restoring the session', async ({ page }) => {
  await injectWallet(page, 'kasware', 'normal', 'testnet-10'); await login(page, 'KasWare', '/react.html');
  await expect(page.getByLabel('Authentication completions')).toHaveText('1');
  await expect(page.getByRole('button', { name: /^Account / })).toBeFocused();
  await openAccount(page);
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  const restoration = page.waitForResponse(response => response.url().endsWith('/auth/ghostlink/session'));
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  await (await restoration).finished();
  await expect(page.getByLabel('Authentication completions')).toHaveText('1');
  await page.reload(); await expectSignedIn(page);
  await expect(page.getByLabel('Authentication completions')).toHaveText('0');
});
test('example owns balance refresh and test signing outside account details', async ({ page }) => {
  await injectWallet(page); await login(page);
  const requests = page.getByRole('region', { name: 'Wallet requests', exact: true });
  await page.evaluate(() => { (window as any).kasware.getBalance = async () => ({ total: 250000000 }); });
  await requests.getByRole('button', { name: 'Refresh balance' }).click();
  await expect(page.getByRole('region', { name: 'Authentication state' })).toContainText('2.5 KAS');
  await requests.getByRole('button', { name: 'Test sign', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('This message does not authorize a transaction.');
  await page.getByRole('button', { name: 'Continue in wallet' }).click();
  await expect(page.getByRole('heading', { name: 'Session active' })).toBeVisible();
  await page.getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.locator('.example-result')).toContainText(/[0-9a-f]{128}/);
  expect(await page.evaluate(() => (window as any).__walletCalls)).toEqual(['signMessage', 'signMessage']);
});
test('keyboard focus stays in the modal and returns to its trigger', async ({ page }) => {
  await page.goto('/'); const trigger = page.getByRole('button', { name: 'Connect wallet', exact: true }).first(); await trigger.focus(); await page.keyboard.press('Enter');
  for (let i = 0; i < 18; i++) { await page.keyboard.press('Tab'); expect(await page.evaluate(() => !!document.activeElement?.closest('dialog'))).toBe(true); }
  await page.keyboard.press('Escape'); await expect(trigger).toBeFocused();
});

test('network mismatch offers an explicit wallet switch before retrying login', async ({ page }) => {
  await injectWallet(page);
  await page.addInitScript(() => {
    const fixture = window as any;
    let network = 'kaspa_mainnet';
    fixture.kasware.getNetwork = async () => network;
    fixture.kasware.switchNetwork = async (requested: string) => {
      fixture.__walletCalls.push(`switchNetwork:${requested}`);
      network = requested;
    };
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: /KasWare Browser/ }).click();
  await expect(page.getByRole('alert')).toContainText('Switch your wallet to testnet-11');
  expect(await page.evaluate(() => (window as any).__walletCalls)).toEqual([]);
  await page.getByRole('button', { name: 'Switch to testnet-11' }).click();
  await expect(page.getByRole('heading', { name: 'Review session' })).toBeVisible();
  expect(await page.evaluate(() => (window as any).__walletCalls)).toEqual(['switchNetwork:kaspa_testnet_11']);
  await page.getByRole('button', { name: 'Continue to sign in' }).click();
  await page.getByRole('button', { name: 'Sign message', exact: true }).click();
  await expectSignedIn(page);
});

test('Kastle unsupported Testnet 11 shows useful guidance without opening a wallet prompt', async ({ page }) => {
  await injectWallet(page, 'kastle');
  await page.addInitScript(() => { (window as any).kastle.connect = async () => { throw new Error('Must not open this prompt'); }; });
  await page.goto('/');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: /Kastle Browser/ }).click();
  await expect(page.getByRole('alert')).toContainText('Kastle supports Mainnet and Testnet 10');
  await expect(page.getByRole('button', { name: 'Switch to testnet-11' })).not.toBeVisible();
});

test('manual signature paste completes verification and a protected request', async ({ page }) => {
  await page.goto('/manual.html');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: /Kaspium Mobile/ }).click();
  await page.getByLabel('Signing address', { exact: true }).fill(account.address.match(/.{1,8}/g)!.join(' '));
  await page.getByRole('button', { name: 'Create login message' }).click();
  await expect(page.getByAltText('QR code containing the exact login message')).toBeVisible();
  const violations = (await new AxeBuilder({ page }).include('dialog').analyze()).violations;
  expect(violations).toEqual([]);
  const message = await page.locator('dialog details pre').textContent();
  await page.getByLabel('Signature from Kaspium').fill(sign(message!));
  await page.getByRole('button', { name: 'Verify and sign in' }).click();
  await expectSignedIn(page);
  await page.getByRole('button', { name: 'Test protected API' }).click();
  await expect(page.locator('.example-result')).toContainText(account.address.split(':')[1]!);
});

test('localhost navigation redirects to the exact configured authentication origin', async ({ page }) => {
  await page.goto('http://localhost:5173/');
  await expect(page).toHaveURL('http://127.0.0.1:5173/');
  await expect(page.getByRole('heading', { name: 'Ready when you are' })).toBeVisible();
  expect((await page.request.get('/auth/ghostlink/session')).status()).toBe(200);
  const wrongHost = await page.request.get('/auth/ghostlink/session', { headers: { Host: 'localhost:5173' } });
  expect(wrongHost.status()).toBe(400);
});

test('manual checksum errors let the user edit the address and continue', async ({ page }) => {
  await page.goto('/manual.html');
  await page.getByRole('button', { name: 'Connect wallet', exact: true }).first().click();
  await page.getByRole('button', { name: /Kaspium Mobile/ }).click();
  await page.getByLabel('Signing address', { exact: true }).fill(account.address + 'q');
  await page.getByRole('button', { name: 'Create login message' }).click();
  await expect(page.getByRole('alert')).toContainText('checksum');
  await page.getByRole('button', { name: 'Edit address' }).click();
  await page.getByLabel('Signing address', { exact: true }).fill(account.address);
  await page.getByRole('button', { name: 'Create login message' }).click();
  await expect(page.getByRole('heading', { name: 'Scan to sign' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('Settings → Advanced → Sign message');
});
