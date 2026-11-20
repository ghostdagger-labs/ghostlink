import { createContext, useContext, useEffect, useId, useRef, useState, useSyncExternalStore } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, X, ScanLine, Check, LoaderCircle, TriangleAlert, Link2, Copy, Camera, Clock, CircleX } from 'lucide-react';
import { GhostlinkError, trapDialogFocus, createMessageQr, getPresentation, remainingTime, scanQrCamera, scanQrImage } from '@ghostdagger/ghostlink-core';
import type { Ghostlink, GhostlinkSnapshot } from '@ghostdagger/ghostlink-core';

const Context = createContext<Ghostlink | null>(null);
/** Borrow a stable client, initialize on mount, and release on cleanup. SSR is passive and Strict Mode replay is supported; cleanup never destroys the client or signs out an established session. */
export function GhostlinkProvider({ client, children }: {
  /** Stable client for this provider lifetime. Use a new provider key to deliberately replace it. */
  client: Ghostlink;
  /** Descendants that consume useGhostlink or the supplied UI. */
  children: ReactNode;
}) {
  const initialClient = useRef(client);
  if (initialClient.current !== client) throw new GhostlinkError('INVALID_REQUEST', 'GhostlinkProvider requires a stable client. Remount the provider with a new key to replace it.');
  useEffect(() => client.attach(), [client]);
  return <Context.Provider value={client}>{children}</Context.Provider>;
}
/** Read the client and nested-readonly snapshot from the nearest provider. Identity is unresolved until snapshot.initialization === 'ready'. Subscription cleanup is automatic; throws outside a provider. */
export function useGhostlink() {
  const client = useContext(Context);
  if (!client) throw new Error('Wrap this component in GhostlinkProvider.');
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot, client.getSnapshot);
  return { client, snapshot };
}
interface Appearance {
  /** Scoped color theme. Defaults to dark. */
  theme?: 'dark' | 'light';
  /** Scoped --ghostlink-* CSS custom properties. Import @ghostdagger/ghostlink-core/styles.css once. */
  variables?: Record<string, string>;
}
/** Open wallet login or account details. Disabled while initialization is idle/restoring; initialization belongs to the provider. */
export function GhostlinkConnectButton({ theme = 'dark', variables, label = 'Connect wallet', children }: Appearance & {
  /** Signed-out button/accessibility label. Defaults to Connect wallet. */
  label?: string;
  /** Optional button content renderer with a readonly snapshot and open action. */
  children?: (state: { snapshot: GhostlinkSnapshot; open: () => void }) => ReactNode;
}) {
  const { client, snapshot } = useGhostlink(); const view = getPresentation(snapshot, client.app);
  return <button type="button" className="gl-theme gl-connect" data-ghostlink-theme={theme} style={variables as CSSProperties} data-authenticated={!!snapshot.session} disabled={snapshot.initialization === 'idle' || snapshot.initialization === 'restoring'} onClick={client.open} aria-label={snapshot.session ? `Account ${snapshot.session.address}` : label}>
    {children ? children({ snapshot, open: client.open }) : snapshot.session ? <><span className="gl-wallet-mark" data-wallet={view.wallet?.id}>{view.wallet?.icon ? <img src={view.wallet.icon} alt="" /> : view.wallet?.mark ?? 'K'}</span>{view.address}</> : <><svg width="14" height="14" viewBox="0 0 34 20" fill="none" aria-hidden="true" focusable="false"><circle cx="11" cy="10" r="6.4" fill="currentColor" /><circle cx="23" cy="10" r="6.4" stroke="currentColor" strokeWidth="2.1" /></svg>{label}</>}
  </button>;
}
/** Render one modal host per client for login, account details, and request review. Renders no dialog during SSR; releases UI/camera resources on unmount. */
export function GhostlinkModal({ theme = 'dark', variables, children }: Appearance & {
  /** Replace the body with custom content; the host owns accessible review controls and client actions. */
  children?: (state: { snapshot: GhostlinkSnapshot; client: Ghostlink }) => ReactNode;
}) {
  const { client, snapshot: s } = useGhostlink(); const view = getPresentation(s, client.app);
  const titleId = useId(); const dialog = useRef<HTMLDialogElement>(null); const video = useRef<HTMLVideoElement>(null);
  const [mounted, setMounted] = useState(false);
  const [address, setAddress] = useState(''); const [signature, setSignature] = useState(''); const [qr, setQr] = useState('');
  const [notice, setNotice] = useState(''); const [camera, setCamera] = useState(false); const [now, setNow] = useState(Date.now());
  const stopCamera = useRef<(() => void) | undefined>(undefined);
  const expired = !!s.challenge && Date.parse(s.challenge.expiresAt) <= now;
  async function act(work: () => Promise<unknown>) { setNotice(''); try { await work(); } catch { /* Core presents typed failures. */ } }
  function stop() { stopCamera.current?.(); stopCamera.current = undefined; setCamera(false); }
  useEffect(() => { setMounted(true); return client.attachUI(); }, [client]);
  useEffect(() => { const tick = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(tick); }, []);
  useEffect(() => { if (!mounted) return; if (s.open && !dialog.current?.open) dialog.current?.showModal(); if (!s.open && dialog.current?.open) dialog.current.close(); if (!s.open) stop(); }, [s.open, mounted]);
  useEffect(() => { let active = true; setSignature(''); setQr(''); if (s.challenge) void createMessageQr(s.challenge.message).then(image => { if (active) setQr(image); }); return () => { active = false; }; }, [s.challenge?.id]);
  useEffect(() => { setNotice(''); stop(); }, [s.step]);
  useEffect(() => {
    if (!camera || !video.current) return;
    let active = true;
    void scanQrCamera(video.current, text => { setSignature(text.trim()); stop(); }).then(cancel => { if (active) stopCamera.current = cancel; else cancel(); }).catch(() => { if (active) { setNotice('Camera unavailable. Paste the signature or upload its QR image.'); setCamera(false); } });
    return () => { active = false; stopCamera.current?.(); stopCamera.current = undefined; };
  }, [camera]);
  async function copyMessage() { try { await navigator.clipboard.writeText(s.challenge?.message ?? ''); setNotice('Message copied'); } catch { setNotice('Select and copy the message below.'); } }
  async function upload(file: File | undefined) { if (!file) return; try { setSignature((await scanQrImage(file)).trim()); setNotice('Signature scanned'); } catch { setNotice('No readable QR code found. Paste the signature instead.'); } }
  async function retry() { if (view.wallet?.kind === 'manual' && s.error?.code === 'INVALID_REQUEST' && s.walletId) { await act(() => client.connect(s.walletId!)); } else if (s.error?.code === 'NETWORK_MISMATCH' && !s.session && s.walletId) { const id = s.walletId; await act(async () => { await client.switchWalletNetwork(); await client.connect(id); }); } else if (s.session) client.open(); else if (s.account) await act(() => client.prepareAuthentication()); else if (s.walletId) await act(() => client.connect(s.walletId!)); else client.back(); }
  if (!mounted) return null;
  const mark = <span className="gl-wallet-mark" data-wallet={view.wallet?.id}>{view.wallet?.icon ? <img src={view.wallet.icon} alt="" /> : view.wallet?.mark ?? 'K'}</span>;
  let content: ReactNode = null;
  if (s.step === 'choose') content = <section className="gl-body">
    <div className="gl-wallets">{s.wallets.map(w => <button key={w.id} type="button" className="gl-wallet" disabled={s.busy} onClick={() => void act(() => client.connect(w.id))}>
      <span className="gl-wallet-mark" data-wallet={w.id}>{w.icon ? <img src={w.icon} alt="" /> : w.mark}</span><span className="gl-wallet-copy"><span className="gl-wallet-name">{w.name}</span><span className="gl-wallet-note">{w.kind === 'manual' ? 'Mobile · manual message signing' : 'Browser wallet'}</span></span><span className="gl-badge" data-installed={w.kind === 'injected' && w.available}>{w.kind === 'manual' ? 'QR / paste' : w.available ? 'Installed' : 'Install'}</span>
    </button>)}{!s.wallets.length && <p className="gl-copy gl-center">No wallets configured.</p>}</div>
    {s.wallets.some(w => w.id === 'kaspium') && <button type="button" className="gl-button gl-mobile-button" disabled={s.busy} onClick={() => void act(() => client.connect('kaspium'))}><ScanLine size={16} />Sign with a mobile wallet</button>}
    <div className="gl-footer"><span>Don't have a Kaspa wallet?</span><button type="button" className="gl-link" onClick={client.showWalletHelp}>Get started →</button></div>
  </section>;
  else if (s.step === 'connecting' || s.step === 'verifying') content = <section className="gl-wait" aria-live="polite"><div className="gl-wait-mark">{mark}</div><h3 className="gl-heading">{s.step === 'verifying' ? 'Verifying your signature' : `Waiting for ${view.wallet?.name ?? 'your wallet'}`}</h3><p className="gl-copy">{s.step === 'verifying' ? 'Confirming your account and establishing a secure application session.' : 'Review and approve the request in your wallet. Your private keys stay there.'}</p><div className="gl-progress"><LoaderCircle className="gl-spin" size={14} />{s.step === 'verifying' ? 'Checking signature' : 'Awaiting wallet approval'}</div><button type="button" className="gl-button gl-full" onClick={client.close}>Cancel</button></section>;
  else if (s.step === 'review') content = <section className="gl-body">
    <div className="gl-app-card"><span className="gl-app-icon">{client.app.icon ? <img src={client.app.icon} alt="" /> : <Link2 size={20} />}</span><span><span className="gl-app-name">{client.app.name}</span><span className="gl-domain">{view.domain}</span></span></div>
    <h3 className="gl-label">Requested access · Kaspa</h3><div className="gl-rows"><div className="gl-row"><span className="gl-row-label">chain</span><span className="gl-chip">kaspa:{s.network}</span></div><div className="gl-row"><span className="gl-row-label">requests</span><span className="gl-chips">{view.methods.map(method => <span key={method} className="gl-chip">{method}</span>)}</span></div></div>
    <h3 className="gl-label">Signing account</h3><div className="gl-rows"><div className="gl-row"><Check size={16} /><span className="gl-row-value">{s.account?.address}</span></div></div>
    <div className="gl-notice"><TriangleAlert size={15} /><span>This session can <strong>request signatures</strong>, but every transaction still needs a separate in-wallet approval.</span></div>
    <div className="gl-actions"><button type="button" className="gl-button" onClick={() => void act(() => client.disconnect())}>Reject</button><button type="button" className="gl-button gl-primary" disabled={s.busy} onClick={() => void act(() => client.prepareAuthentication())}>Continue to sign in</button></div>
  </section>;
  else if (s.step === 'address') content = <section className="gl-body"><p className="gl-copy">Copy your receiving address from Kaspium and paste it below. Choose that same address in Kaspium’s Sign message tool.</p><form onSubmit={e => { e.preventDefault(); void act(() => client.prepareAuthentication(address)); }}><label className="gl-field"><span>Signing address · {s.network}</span><input value={address} onChange={e => setAddress(e.target.value)} className="gl-input" aria-label="Signing address" placeholder={s.network === 'mainnet' ? 'kaspa:…' : 'kaspatest:…'} required autoComplete="off" spellCheck={false} /></label><button className="gl-button gl-primary gl-full" disabled={s.busy}>Create login message</button></form><div className="gl-notice"><TriangleAlert size={15} /><span>Signing proves control of this address. It does not create a live connection to Kaspium.</span></div></section>;
  else if (s.step === 'manual') content = <section className="gl-body">
    <p className="gl-copy gl-center">In Kaspium, open <strong>Settings → Advanced → Sign message</strong>. Select this address, then use the QR button inside the message field. Return the signature here.</p>
    <div className="gl-rows"><div className="gl-row"><span className="gl-row-label">Account</span><span className="gl-row-value">{s.account?.address}</span></div></div>
    {qr && <div className="gl-qr-frame"><img src={qr} alt="QR code containing the exact login message" /></div>}
    <div className="gl-timer"><Clock size={13} />{expired ? 'Message expired' : `Login expires in ${remainingTime(s.challenge?.expiresAt, now)}`}</div>
    <button type="button" className="gl-button gl-full" onClick={() => void copyMessage()}><Copy size={14} />Copy login message</button>
    <details className="gl-message" style={{ marginTop: 12 }}><summary className="gl-label">Review exact message</summary><pre>{s.challenge?.message}</pre></details>
    <form onSubmit={e => { e.preventDefault(); void act(() => client.authenticate({ signature: signature.trim() })); }}><label className="gl-field"><span>Signature from Kaspium</span><textarea value={signature} onChange={e => setSignature(e.target.value)} className="gl-input" aria-label="Signature from Kaspium" rows={3} placeholder="Paste the complete signature" required autoComplete="off" spellCheck={false} /></label>
      <div className="gl-actions"><button type="button" className="gl-button" onClick={() => camera ? stop() : setCamera(true)}><Camera size={14} />{camera ? 'Stop camera' : 'Scan signature'}</button><label className="gl-button">Upload QR<input type="file" accept="image/*" aria-label="Upload signature QR" className="gl-sr-only" onChange={e => void upload(e.target.files?.[0])} /></label></div>
      {camera && <video ref={video} className="gl-video" autoPlay muted playsInline aria-label="Signature QR scanner" />}
      {expired ? <button type="button" className="gl-button gl-primary gl-full" style={{ marginTop: 14 }} disabled={s.busy} onClick={() => void act(() => client.prepareAuthentication())}>Generate a new message</button> : <button className="gl-button gl-primary gl-full" style={{ marginTop: 14 }} disabled={s.busy || !signature.trim()}>Verify and sign in</button>}
    </form>{notice && <p role="status" className="gl-copy" style={{ marginTop: 12 }}>{notice}</p>}
  </section>;
  else if (s.step === 'sign') content = <section className="gl-body"><div className="gl-app-card"><span className="gl-app-icon"><Link2 size={18} /></span><span><span className="gl-app-name">{s.request?.title ?? 'Signature request'}</span><span className="gl-domain">{view.domain}</span></span></div><div className="gl-message"><h3 className="gl-label">{s.request ? 'Request' : 'Message'}</h3><pre>{s.request?.message ?? s.challenge?.message}</pre></div><div className="gl-row"><span className="gl-row-label">Account</span><span className="gl-row-value">{view.address}</span></div><p className="gl-copy" style={{ marginTop: 12 }}>Continue to your wallet to review and approve.</p><div className="gl-actions"><button type="button" className="gl-button" onClick={client.close}>Cancel</button><button type="button" className="gl-button gl-primary" disabled={s.busy && !s.request} onClick={() => s.request ? client.confirmRequest() : void act(() => client.authenticate())}>{s.request ? 'Continue in wallet' : 'Sign message'}</button></div></section>;
  else if (s.step === 'connected' && s.session) content = <section className="gl-connected"><div className="gl-center" style={{ marginBottom: 16 }}><span className="gl-success-icon"><Check size={30} /></span><h3 className="gl-heading">Session active</h3><p className="gl-copy" style={{ margin: '4px 0 0' }}>{view.wallet?.name ?? 'Kaspa account'} · {view.networkLabel}</p></div>
    <div className="gl-rows">{view.sessionRows.map(row => <div key={row.label} className="gl-row"><span className="gl-row-label">{row.label}</span><span className="gl-row-value" title={row.full}>{row.value}</span></div>)}</div>
    {s.connection !== 'connected' && <p className="gl-copy">Your application session is authenticated. Automated wallet requests require a live provider connection.</p>}
    <button type="button" className="gl-button gl-danger gl-full" onClick={() => void act(() => client.disconnect())}>Sign out</button>
  </section>;
  else if (s.step === 'error') content = <section className="gl-body gl-center" style={{ padding: '30px 22px 20px' }}><span className="gl-error-icon"><CircleX size={28} /></span><h3 className="gl-heading">{s.error?.code === 'USER_REJECTED' ? 'Request rejected' : s.error?.code === 'EXPIRED' ? 'Login request expired' : 'Unable to complete request'}</h3><p className="gl-copy" role="alert">{s.error?.message}</p><span className="gl-code">{s.error?.code}</span>{s.error?.code === 'UNAVAILABLE' && view.wallet && <a className="gl-button gl-full" href={view.wallet.installUrl} target="_blank" rel="noopener noreferrer" style={{ marginTop: 12 }}>Get {view.wallet.name}</a>}<div className="gl-actions"><button type="button" className="gl-button" onClick={client.back}>All wallets</button><button type="button" className="gl-button gl-primary" disabled={s.busy} onClick={() => void retry()}>{s.session ? 'Back to session' : view.wallet?.kind === 'manual' && s.error?.code === 'INVALID_REQUEST' ? 'Edit address' : s.error?.code === 'NETWORK_MISMATCH' ? `Switch to ${s.network}` : 'Try again'}</button></div></section>;
  else if (s.step === 'getwallet') content = <section className="gl-body"><p className="gl-copy">A wallet holds your KAS and signs for you. Install a wallet, then return to sign in. Login itself requires no funds.</p><div className="gl-onboarding"><span className="gl-number">1</span><div><strong>Choose a Kaspa wallet</strong><p>{s.wallets.map(w => <a key={w.id} href={w.installUrl} target="_blank" rel="noopener noreferrer" style={{ marginRight: 12 }}>{w.name}</a>)}</p></div></div><div className="gl-onboarding"><span className="gl-number">2</span><div><strong>Back up your recovery phrase</strong><p>Keep it offline. Ghostlink will never ask for your recovery phrase or private key.</p></div></div><div className="gl-onboarding"><span className="gl-number">3</span><div><strong>Return and connect</strong><p>Approve the login message in your wallet to prove ownership of your account.</p></div></div><button type="button" className="gl-button gl-primary gl-full" style={{ marginTop: 7 }} onClick={client.back}>I have a wallet now</button></section>;
  return createPortal(<dialog ref={dialog} className="gl-theme gl-dialog" data-ghostlink-theme={theme} style={variables as CSSProperties} aria-labelledby={titleId} onKeyDown={e => trapDialogFocus(e.nativeEvent, e.currentTarget)} onCancel={e => { e.preventDefault(); client.close(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) client.close(); } }}>
    <header className="gl-header">{!['choose', 'connected'].includes(s.step) && <button type="button" className="gl-icon-button" aria-label="Back" disabled={s.busy} onClick={client.back}><ArrowLeft size={15} /></button>}<h2 id={titleId} className="gl-title">{s.request?.title ?? view.title}</h2><span className="gl-status" data-active={!!s.session}><span className="gl-dot" />{view.status}</span><button type="button" className="gl-icon-button" aria-label="Close" onClick={client.close}><X size={15} /></button></header>
    {children ? children({ snapshot: s, client }) : content}
    {s.revocationPending && <p role="status" className="gl-error" style={{ padding: '0 18px 12px' }}>Session revocation pending. Reconnecting to the authentication server…</p>}
  </dialog>, document.body);
}
