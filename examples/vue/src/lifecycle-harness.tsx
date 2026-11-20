// Development-only integration harness. Deliberately uses no connect button or modal.
import { StrictMode } from 'react';
import { createRoot, hydrateRoot } from 'react-dom/client';
import { createApp, createSSRApp, defineComponent, h } from 'vue';
import { createGhostlink, type AuthSession, type AuthTransport, type GhostlinkSnapshot, type WalletAdapter } from 'ghostlink-core';
import { GhostlinkProvider as ReactProvider, useGhostlink as useReactGhostlink } from 'ghostlink-react';
import { GhostlinkPlugin, GhostlinkProvider as VueProvider, useGhostlink as useVueGhostlink } from 'ghostlink-vue';

type Mode = 'react' | 'vue' | 'vue-plugin';
const container = document.getElementById('app')!;
const counts = { sessions: 0, logouts: 0, prompts: 0, subscriptions: 0, observed: 0, destroyed: 0 };
const hydrationErrors: string[] = [];
let session: AuthSession | null = null;
let pending: { resolve: (value: AuthSession | null) => void; reject: (error: Error) => void }[] = [];
const auth: AuthTransport = {
  session: () => { counts.sessions++; return new Promise((resolve, reject) => { pending.push({ resolve, reject }); }); },
  logout: async () => { counts.logouts++; session = null; },
  challenge: async () => { throw new Error('No challenge expected'); },
  verify: async () => { throw new Error('No verification expected'); },
};
const adapter: WalletAdapter = {
  id: 'lifecycle', name: 'Lifecycle', kind: 'injected', mark: 'L', installUrl: 'https://example.com',
  capabilities: { messageSigning: true, transfer: false, transactionFormats: [], domainBinding: 'unknown', authentication: 'compatibility' },
  isAvailable: () => true,
  getAccount: async () => session ? { address: session.address, network: session.network } : null,
  connect: async () => { counts.prompts++; throw new Error('No wallet prompt expected'); },
  signMessage: async () => { counts.prompts++; throw new Error('No wallet prompt expected'); },
  subscribe: () => { counts.subscriptions++; return () => { counts.subscriptions--; }; },
};
const client = createGhostlink({ app: { name: 'Lifecycle harness', url: location.origin }, adapters: [adapter], auth });
const destroy = client.destroy.bind(client);
client.destroy = () => { counts.destroyed++; destroy(); };
const unsubscribe = client.subscribe(() => { counts.observed++; });
localStorage.setItem('ghostlink:last-wallet', 'lifecycle');

const text = (s: GhostlinkSnapshot) => `${s.initialization}|${s.authentication}`;
function ReactState() {
  const { snapshot } = useReactGhostlink();
  return <p data-testid="state">{text(snapshot)}</p>;
}
const VueState = defineComponent({ setup() {
  const { snapshot } = useVueGhostlink();
  return () => h('p', { 'data-testid': 'state' }, text(snapshot.value));
} });
let unmount: (() => void) | undefined;
function mount(mode: Mode, hydrate = false) {
  if (unmount) throw new Error('Unmount the previous owner first');
  // Mirrors the passive output asserted by the SSR tests, with no client discovery.
  container.innerHTML = hydrate
    ? (mode === 'vue' ? '<!--[--><p data-testid="state">idle|unauthenticated</p><!--]-->' : '<p data-testid="state">idle|unauthenticated</p>')
    : '';
  if (mode === 'react') {
    const tree = <StrictMode><ReactProvider client={client}><ReactState /></ReactProvider></StrictMode>;
    const root = hydrate ? hydrateRoot(container, tree, { onRecoverableError: error => { hydrationErrors.push(String(error)); } }) : createRoot(container);
    if (!hydrate) root.render(tree);
    unmount = () => root.unmount();
  } else {
    const component = mode === 'vue-plugin' ? VueState : defineComponent({ setup: () => () => h(VueProvider, { client }, { default: () => h(VueState) }) });
    const app = hydrate ? createSSRApp(component) : createApp(component);
    app.config.warnHandler = message => { hydrationErrors.push(message); };
    if (mode === 'vue-plugin') app.use(GhostlinkPlugin, client);
    app.mount(container);
    unmount = () => app.unmount();
  }
}
const harness = {
  mount,
  unmount() { unmount?.(); unmount = undefined; },
  resolve(value: AuthSession | null = session) { session = value; const requests = pending; pending = []; requests.forEach(p => p.resolve(value)); },
  reject() { const requests = pending; pending = []; requests.forEach(p => p.reject(new TypeError('offline'))); },
  retry() { void client.restoreSession().catch(() => {}); },
  stats: () => ({ ...counts, pending: pending.length, hydrationErrors: [...hydrationErrors], snapshot: client.getSnapshot() }),
};
(window as unknown as { lifecycle: typeof harness }).lifecycle = harness;
if (import.meta.hot) import.meta.hot.dispose(() => { harness.unmount(); unsubscribe(); client.destroy(); });
