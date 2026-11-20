<script setup lang="ts">
import { onMounted, onUnmounted, provide, watch } from 'vue';
import { GhostlinkError, type Ghostlink } from '@ghostdagger/ghostlink-core';
import { GhostlinkKey } from './context';
const props = defineProps<{
  /** Stable client for this provider lifetime. Use a new provider key to deliberately replace it. */
  client: Ghostlink;
}>();
const client = props.client;
provide(GhostlinkKey, client);
watch(() => props.client, next => {
  if (next !== client) throw new GhostlinkError('INVALID_REQUEST', 'GhostlinkProvider requires a stable client. Remount the provider with a new key to replace it.');
}, { flush: 'sync' });
let release: (() => void) | undefined;
onMounted(() => { release = client.attach(); });
onUnmounted(() => { release?.(); });
</script>
<template><slot /></template>
