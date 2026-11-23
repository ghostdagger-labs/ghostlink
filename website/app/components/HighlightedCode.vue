<script setup lang="ts">
import type { CodeToken } from 'virtual:ghostlink-code';
defineProps<{ tokens: CodeToken[] }>();
</script>

<template><code class="highlighted-code"><span v-for="(token, index) in tokens" :key="index" :style="token.color ? { color: token.color } : undefined">{{ token.content }}</span></code></template>
