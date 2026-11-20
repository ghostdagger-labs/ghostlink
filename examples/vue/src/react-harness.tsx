import { createRoot } from 'react-dom/client';
import { StrictMode, useEffect, useState } from 'react';
import { createGhostlink } from '@ghostdagger/ghostlink-core';
import { GhostlinkProvider, GhostlinkConnectButton, GhostlinkModal } from '@ghostdagger/ghostlink-react';
import '@ghostdagger/ghostlink-core/styles.css';
import '@ghostdagger/ghostlink-core/fonts.css';
const client = createGhostlink({ app: { name: 'Ghostlink Example', url: location.origin }, network: 'testnet-10', closeOnAuthenticate: !new URLSearchParams(location.search).has('keep-open') });
function Harness() {
  const [completions, setCompletions] = useState(0);
  useEffect(() => client.onAuthenticated(() => { setCompletions(count => count + 1); }), []);
  return <main className="gl-theme" style={{ padding: 32 }}><h1>React development harness</h1><GhostlinkConnectButton /><GhostlinkModal /><p>Completed sign-ins: <output aria-label="Authentication completions">{completions}</output></p></main>;
}
const root = createRoot(document.getElementById('app')!);
root.render(<StrictMode><GhostlinkProvider client={client}><Harness /></GhostlinkProvider></StrictMode>);
if (import.meta.hot) import.meta.hot.dispose(() => { root.unmount(); client.destroy(); });
