<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { Wallet } from '@lucide/vue';
import { getPresentation } from 'ghostlink-core';
import { useGhostlink } from './context';
defineProps<{ theme?: 'dark' | 'light'; variables?: Record<string, string>; label?: string }>();
const { client, snapshot } = useGhostlink();
const view = computed(() => getPresentation(snapshot.value, client.app));
onMounted(() => { void client.restoreSession().catch(() => {}); });
</script>
<template>
  <button type="button" class="gl-theme gl-connect" :data-ghostlink-theme="theme ?? 'dark'" :style="variables" :data-authenticated="!!snapshot.session" @click="client.open" :aria-label="snapshot.session ? `Account ${snapshot.session.address}` : (label ?? 'Connect wallet')">
    <slot :snapshot="snapshot" :open="client.open">
      <template v-if="snapshot.session"><span class="gl-wallet-mark" :data-wallet="view.wallet?.id"><img v-if="view.wallet?.icon" :src="view.wallet.icon" alt="" /><template v-else>{{ view.wallet?.mark ?? 'K' }}</template></span>{{ view.address }}</template>
      <template v-else><Wallet :size="14" aria-hidden="true" />{{ label ?? 'Connect wallet' }}</template>
    </slot>
  </button>
</template>
