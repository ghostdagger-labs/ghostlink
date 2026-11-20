import { expect, it, vi } from 'vitest';
import { createElement, StrictMode } from 'react';
import { renderToString } from 'react-dom/server';
import { createGhostlink, kaswareAdapter, type Network } from '@ghostdagger/ghostlink-core';
import { GhostlinkProvider, useGhostlink } from './index';

it('renders request-local idle state without activating a React provider', () => {
  const fetch = vi.fn(() => { throw new Error('SSR must not fetch a browser session'); });
  const adapter = kaswareAdapter(); const discovery = vi.spyOn(adapter, 'isAvailable');
  const create = (network: Network) => createGhostlink({ app: { name: 'SSR', url: 'https://app.example' }, network, adapters: [adapter], auth: { fetch } });
  const first = create('mainnet'); const second = create('testnet-11');
  function State() {
    const { snapshot } = useGhostlink();
    return createElement('p', null, `${snapshot.initialization}|${snapshot.network}|${snapshot.session === null}`);
  }
  const render = (client: typeof first) => renderToString(createElement(StrictMode, null,
    createElement(GhostlinkProvider, { client, children: createElement(State) })));
  expect(render(first)).toBe('<p>idle|mainnet|true</p>');
  expect(render(second)).toBe('<p>idle|testnet-11|true</p>');
  expect(first.getSnapshot()).not.toBe(second.getSnapshot());
  expect(fetch).not.toHaveBeenCalled(); expect(discovery).not.toHaveBeenCalled();
  first.destroy(); second.destroy();
});
