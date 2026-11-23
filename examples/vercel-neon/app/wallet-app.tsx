'use client';

import { useState } from 'react';
import { createGhostlink, type Network } from '@ghostdagger/ghostlink-core';
import { GhostlinkProvider, GhostlinkConnectButton, GhostlinkModal, useGhostlink } from '@ghostdagger/ghostlink-react';

function Account() {
  const { client, snapshot } = useGhostlink();
  const [result, setResult] = useState('');
  const [pending, setPending] = useState(false);
  const [changingNetwork, setChangingNetwork] = useState(false);
  const ready = snapshot.initialization === 'ready';
  async function changeNetwork(network: Network) {
    setResult('');
    setChangingNetwork(true);
    try {
      await client.setNetwork(network);
      // Remember only the selected public network. Authentication still comes
      // from the server; keeping this choice prevents a mismatch after reload.
      const url = new URL(window.location.href);
      url.searchParams.set('network', network);
      window.history.replaceState(null, '', url);
    } catch { setResult('Could not change network.'); }
    finally { setChangingNetwork(false); }
  }
  async function protectedRequest() {
    setPending(true);
    try {
      const response = await fetch('/api/private', { credentials: 'same-origin', cache: 'no-store' });
      const data = await response.json();
      setResult(response.ok ? `${data.message} ${data.accountId}` : data.error);
    } catch { setResult('The request could not reach the server.'); }
    finally { setPending(false); }
  }
  return <main className="gl-theme">
    <p className="eyebrow">Ghostlink / Vercel + Neon</p>
    <h1>Your wallet. Your session.</h1>
    <p>Sign in with KasWare or Kastle. Reload to restore your session, then try a protected request. Login requires no funds.</p>
    <fieldset disabled={!ready || changingNetwork} aria-label="Wallet actions">
      <label>Network <select aria-label="Network" value={snapshot.network} disabled={snapshot.busy || snapshot.open} onChange={event => void changeNetwork(event.target.value as Network)}>
        <option value="testnet-11">Testnet 11 · KasWare</option><option value="testnet-10">Testnet 10 · Kastle</option>
      </select></label>
      <div className="actions"><GhostlinkConnectButton />
        <button disabled={!ready || !snapshot.session || pending} onClick={() => void protectedRequest()}>Test protected request</button>
        {ready && snapshot.session && <button onClick={() => { setResult(''); void client.disconnect().catch(() => setResult('Sign-out could not complete.')); }}>Sign out</button>}
      </div>
    </fieldset>
    <p role="status">{!ready ? (snapshot.initialization === 'error' ? 'Session restoration failed.' : 'Checking your session…') : snapshot.session ? `Signed in: ${snapshot.session.address}` : 'Signed out.'}</p>
    {snapshot.initialization === 'error' && <button onClick={() => void client.restoreSession().catch(() => setResult('Session restoration failed.'))}>Retry session check</button>}
    {snapshot.revocationPending && <p role="alert">Sign-out is waiting for the server. Reconnect to finish revoking the session.</p>}
    <p role="status" className="result">{result}</p>
    <GhostlinkModal />
  </main>;
}

export default function WalletApp({ origin, network }: { origin: string; network: Network }) {
  // Passive construction is safe during SSR; the provider restores after mount.
  const [client] = useState(() => createGhostlink({ app: { name: 'Ghostlink Vercel Example', url: origin }, network, auth: { baseUrl: '/auth/ghostlink' } }));
  return <GhostlinkProvider client={client}><Account /></GhostlinkProvider>;
}
