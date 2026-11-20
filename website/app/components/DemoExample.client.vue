<script setup lang="ts">
import { createGhostlink, isNetwork } from '@ghostdagger/ghostlink-core';
import { GhostlinkProvider } from '@ghostdagger/ghostlink-vue';
import Example from '../../../examples/vue/src/App.vue';
import '@ghostdagger/ghostlink-core/styles.css';
import '../../../examples/vue/src/style.css';
let network: 'mainnet' | 'testnet-10' | 'testnet-11' = 'testnet-11';
try { const saved = sessionStorage.getItem('ghostlink:example:network'); if (isNetwork(saved)) network = saved; } catch { /* Optional storage. */ }
const client = createGhostlink({ app: { name: 'Ghostlink Example', url: window.location.origin }, network });
const unsubscribe = client.subscribe(() => {
  try { sessionStorage.setItem('ghostlink:example:network', client.getSnapshot().network); } catch { /* Optional storage. */ }
});
// The provider releases browser activity; this component owns only its extra subscription.
onBeforeUnmount(unsubscribe);
</script>
<template><GhostlinkProvider :client="client"><Example /></GhostlinkProvider></template>
