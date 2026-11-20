<script setup lang="ts">
import { computed } from 'vue';
import { getPresentation } from 'ghostlink-core';
import { useGhostlink } from './context';
defineProps<{ theme?: 'dark' | 'light'; variables?: Record<string, string>; label?: string }>();
const { client, snapshot } = useGhostlink();
const view = computed(() => getPresentation(snapshot.value, client.app));
</script>
<template>
  <button type="button" class="gl-theme gl-connect" :data-ghostlink-theme="theme ?? 'dark'" :style="variables" :data-authenticated="!!snapshot.session" :disabled="snapshot.initialization === 'idle' || snapshot.initialization === 'restoring'" @click="client.open" :aria-label="snapshot.session ? `Account ${snapshot.session.address}` : (label ?? 'Connect wallet')">
    <slot :snapshot="snapshot" :open="client.open">
      <template v-if="snapshot.session"><span class="gl-wallet-mark" :data-wallet="view.wallet?.id"><img v-if="view.wallet?.icon" :src="view.wallet.icon" alt="" /><template v-else>{{ view.wallet?.mark ?? 'K' }}</template></span>{{ view.address }}</template>
      <template v-else><svg width="14" height="14" viewBox="0 0 34 20" fill="none" aria-hidden="true" focusable="false"><circle cx="11" cy="10" r="6.4" fill="currentColor" /><circle cx="23" cy="10" r="6.4" stroke="currentColor" stroke-width="2.1" /></svg>{{ label ?? 'Connect wallet' }}</template>
    </slot>
  </button>
</template>
