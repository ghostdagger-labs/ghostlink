<script setup lang="ts">
import {
  GhostlinkConnectButton, GhostlinkModal,
  useGhostlink,
} from 'ghostlink-vue';

// Inside your configured GhostlinkProvider.
const { snapshot } = useGhostlink();
</script>

<template>
  <GhostlinkConnectButton />
  <GhostlinkModal />
  <p v-if="snapshot.initialization === 'ready' && snapshot.session">Signed in</p>
</template>
