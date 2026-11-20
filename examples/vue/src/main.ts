import { createApp } from 'vue';
import { createGhostlink, isNetwork } from '@ghostdagger/ghostlink-core';
import { GhostlinkPlugin } from '@ghostdagger/ghostlink-vue';
import '@ghostdagger/ghostlink-core/styles.css';
import '@ghostdagger/ghostlink-core/fonts.css';
import './standalone.css';
import './style.css';
import App from './App.vue';
let network: 'mainnet' | 'testnet-10' | 'testnet-11' = 'testnet-11';
try { const saved = sessionStorage.getItem('ghostlink:example:network'); if (isNetwork(saved)) network = saved; } catch { /* Browser storage is optional. */ }
const client = createGhostlink({ app: { name: 'Ghostlink Example', url: window.location.origin }, network });
const unsubscribe = client.subscribe(() => { try { sessionStorage.setItem('ghostlink:example:network', client.getSnapshot().network); } catch { /* Browser storage is optional. */ } });
const app = createApp(App).use(GhostlinkPlugin, client);
app.onUnmount(unsubscribe);
app.mount('#app');
if (import.meta.hot) import.meta.hot.dispose(() => { app.unmount(); client.destroy(); });
