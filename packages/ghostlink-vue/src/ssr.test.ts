import { expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent, h } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createGhostlink, kaswareAdapter, type Network } from '@ghostdagger/ghostlink-core';
import { GhostlinkPlugin, useGhostlink } from './context';
import GhostlinkProvider from './GhostlinkProvider.vue';

it.each(['provider', 'plugin'])('renders request-local idle state without activating the Vue %s', async mode => {
  const fetch = vi.fn(() => { throw new Error('SSR must not fetch a browser session'); });
  const adapter = kaswareAdapter(); const discovery = vi.spyOn(adapter, 'isAvailable');
  const create = (network: Network) => createGhostlink({ app: { name: 'SSR', url: 'https://app.example' }, network, adapters: [adapter], auth: { fetch } });
  const first = create('mainnet'); const second = create('testnet-11');
  const State = defineComponent({ setup() {
    const { snapshot } = useGhostlink();
    return () => h('p', `${snapshot.value.initialization}|${snapshot.value.network}|${snapshot.value.session === null}`);
  } });
  function render(client: typeof first) {
    const app = mode === 'plugin' ? createSSRApp(State).use(GhostlinkPlugin, client)
      : createSSRApp({ render: () => h(GhostlinkProvider, { client }, { default: () => h(State) }) });
    return renderToString(app);
  }
  const [one, two] = await Promise.all([render(first), render(second)]);
  expect(one).toContain('<p>idle|mainnet|true</p>');
  expect(two).toContain('<p>idle|testnet-11|true</p>');
  expect(first.getSnapshot()).not.toBe(second.getSnapshot());
  expect(fetch).not.toHaveBeenCalled(); expect(discovery).not.toHaveBeenCalled();
  first.destroy(); second.destroy();
});
