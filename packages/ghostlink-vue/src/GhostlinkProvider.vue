<script setup lang="ts">
import { provide } from 'vue';
import type { Ghostlink } from 'ghostlink-core';
import { GhostlinkKey } from './context';
const props = defineProps<{ client: Ghostlink }>();
provide(GhostlinkKey, props.client);
</script>
<template><slot /></template>
