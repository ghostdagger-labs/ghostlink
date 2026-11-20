import { createRoot } from 'react-dom/client';
import { useEffect, useState } from 'react';
import { createGhostlink } from 'ghostlink-core';
import { GhostlinkProvider, GhostlinkConnectButton, GhostlinkModal } from 'ghostlink-react';
import 'ghostlink-core/styles.css';
import 'ghostlink-core/fonts.css';
const client = createGhostlink({ app: { name: 'Ghostlink Example', url: location.origin }, network: 'testnet-10', closeOnAuthenticate: !new URLSearchParams(location.search).has('keep-open') });
function Harness() {
  const [completions, setCompletions] = useState(0);
  useEffect(() => client.onAuthenticated(() => { setCompletions(count => count + 1); }), []);
  return <main className="gl-theme" style={{ padding: 32 }}><h1>React development harness</h1><GhostlinkConnectButton /><GhostlinkModal /><p>Completed sign-ins: <output aria-label="Authentication completions">{completions}</output></p></main>;
}
const root = createRoot(document.getElementById('app')!);
root.render(<GhostlinkProvider client={client}><Harness /></GhostlinkProvider>);
if (import.meta.hot) import.meta.hot.dispose(() => { root.unmount(); client.destroy(); });
