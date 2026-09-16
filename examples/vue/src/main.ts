import { createApp } from 'vue';
import { createGhostlink, isNetwork } from 'ghostlink-core';
import { GhostlinkPlugin } from 'ghostlink-vue';
import 'ghostlink-core/styles.css';
import 'ghostlink-core/fonts.css';
import './style.css';
import App from './App.vue';
let network: 'mainnet' | 'testnet-10' | 'testnet-11' = 'testnet-11';
try { const saved = sessionStorage.getItem('ghostlink:example:network'); if (isNetwork(saved)) network = saved; } catch { /* Browser storage is optional. */ }
const client = createGhostlink({ app: { name: 'Ghostlink Example', url: window.location.origin }, network });
const unsubscribe = client.subscribe(() => { try { sessionStorage.setItem('ghostlink:example:network', client.getSnapshot().network); } catch { /* Browser storage is optional. */ } });
const app = createApp(App).use(GhostlinkPlugin, client);
app.mount('#app');
if (import.meta.hot) import.meta.hot.dispose(() => { unsubscribe(); app.unmount(); client.destroy(); });
