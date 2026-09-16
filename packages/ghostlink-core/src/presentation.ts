import { formatKas, shortenAddress } from './protocol.js';
import type { GhostlinkSnapshot, GhostlinkConfig } from './types.js';
export function getPresentation(s: GhostlinkSnapshot, app: GhostlinkConfig['app']) {
  const wallet = s.wallets.find(w => w.id === s.walletId);
  const titles = { choose: 'Connect a Kaspa wallet', connecting: 'Connecting', review: 'Review session', address: 'Sign in with Kaspium', sign: 'Confirm signature', manual: 'Scan to sign', verifying: 'Verifying signature', connected: 'Connected', error: 'Connection failed', getwallet: 'Get a Kaspa wallet' };
  const live = s.connection === 'connected';
  return {
    title: titles[s.step], wallet, domain: new URL(app.url).host,
    networkLabel: s.network === 'mainnet' ? 'Kaspa Mainnet' : `Kaspa Testnet ${s.network.slice('testnet-'.length)}`,
    address: shortenAddress(s.session?.address ?? s.account?.address ?? ''),
    status: s.authentication === 'authenticated' ? 'signed in' : s.connection === 'manual' ? 'manual signing' : live ? 'wallet connected' : 'ready',
    sessionRows: s.session ? [
      { label: 'Account', value: shortenAddress(s.session.address), full: s.session.address },
      { label: 'Chain', value: s.session.chainId },
      ...(s.balance !== null ? [{ label: 'Balance', value: `${formatKas(s.balance)} KAS` }] : []),
      { label: 'Connection', value: live ? (wallet?.name ?? 'Wallet') : 'Authentication only' },
      { label: 'Expiry', value: new Date(s.session.expiresAt).toLocaleString() },
    ] : [],
    methods: ['Sign a login message', ...(wallet?.capabilities.transfer ? ['Request KAS transfers'] : []), ...(wallet?.capabilities.transactionFormats.length ? ['Request transaction signatures'] : [])],
  };
}
export async function createMessageQr(message: string): Promise<string> {
  const { default: QRCode } = await import('qrcode');
  return QRCode.toDataURL(message, { errorCorrectionLevel: 'M', margin: 4, scale: 6, color: { dark: '#15181C', light: '#FFFFFF' } });
}
export async function scanQrImage(file: File): Promise<string> {
  const [{ BrowserQRCodeReader }, { DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const url = URL.createObjectURL(file);
  const hints = new Map([[DecodeHintType.TRY_HARDER, true]]);
  try {
    try { return (await new BrowserQRCodeReader(hints).decodeFromImageUrl(url)).getText(); }
    catch {
      // An exported QR image can have alignment patterns that confuse the finder detector.
      // ZXing's pure-symbol path still validates QR structure and error correction.
      hints.set(DecodeHintType.PURE_BARCODE, true);
      return (await new BrowserQRCodeReader(hints).decodeFromImageUrl(url)).getText();
    }
  }
  finally { URL.revokeObjectURL(url); }
}
export async function scanQrCamera(video: HTMLVideoElement, onResult: (text: string) => void): Promise<() => void> {
  const [{ BrowserQRCodeReader }, { DecodeHintType }] = await Promise.all([import('@zxing/browser'), import('@zxing/library')]);
  const controls = await new BrowserQRCodeReader(new Map([[DecodeHintType.TRY_HARDER, true]])).decodeFromVideoDevice(undefined, video, (result, _error, active) => {
    if (result) { active.stop(); onResult(result.getText()); }
  });
  return () => controls.stop();
}
export function remainingTime(expiresAt: string | undefined, now: number): string {
  const seconds = expiresAt ? Math.max(0, Math.ceil((Date.parse(expiresAt) - now) / 1000)) : 0;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
/** Native dialogs make the page inert; this also keeps Tab from moving into browser chrome. */
export function trapDialogFocus(event: KeyboardEvent, dialog: HTMLDialogElement) {
  if (event.key !== 'Tab') return;
  const items = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), summary, [tabindex="0"]')].filter(el => el.getClientRects().length > 0);
  const first = items[0], last = items.at(-1);
  if (!first || !last) { event.preventDefault(); dialog.focus(); return; }
  if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) { event.preventDefault(); first.focus(); }
}
