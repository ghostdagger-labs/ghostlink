import { createApp } from 'vue';
import { createGhostlink, defaultAdapters, kaspiumAdapter } from '@ghostdagger/ghostlink-core';
import { GhostlinkPlugin } from '@ghostdagger/ghostlink-vue';
import '@ghostdagger/ghostlink-core/styles.css';
import '@ghostdagger/ghostlink-core/fonts.css';
import './standalone.css';
import './style.css';
import App from './App.vue';

// Development-only entry point; not included in the production Vite build.
const client = createGhostlink({
  app: { name: 'Ghostlink Example', url: window.location.origin },
  network: 'testnet-11',
  closeOnAuthenticate: !new URLSearchParams(location.search).has('keep-open'),
  adapters: [...defaultAdapters(), kaspiumAdapter()],
});
const app = createApp(App).use(GhostlinkPlugin, client);
app.mount('#app');
if (import.meta.hot) import.meta.hot.dispose(() => { app.unmount(); client.destroy(); });
