import { createRoot } from 'react-dom/client';
import { createGhostlink } from 'ghostlink-core';
import { GhostlinkProvider, GhostlinkConnectButton, GhostlinkModal } from 'ghostlink-react';
import 'ghostlink-core/styles.css';
import 'ghostlink-core/fonts.css';
const client = createGhostlink({ app: { name: 'Ghostlink Example', url: location.origin }, network: 'testnet-10' });
const root = createRoot(document.getElementById('app')!);
root.render(<GhostlinkProvider client={client}><main className="gl-theme" style={{ padding: 32 }}><h1>React development harness</h1><GhostlinkConnectButton /><GhostlinkModal /></main></GhostlinkProvider>);
if (import.meta.hot) import.meta.hot.dispose(() => { root.unmount(); client.destroy(); });
