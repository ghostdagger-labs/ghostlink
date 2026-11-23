<script setup lang="ts">
import type { DocsHeading } from '../types/docs';
defineProps<{ headings: DocsHeading[]; active: string }>();
defineEmits<{ select: [id: string] }>();
</script>

<template>
  <nav aria-label="On this page" class="docs-contents">
    <a v-for="heading in headings" :key="heading.id" :href="`#${heading.id}`" :class="{ 'docs-contents-nested': heading.depth === 3 }" :aria-current="active === heading.id ? 'location' : undefined" @click.prevent="$emit('select', heading.id)">{{ heading.text }}</a>
  </nav>
</template>
