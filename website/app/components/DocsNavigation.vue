<script setup lang="ts">
import type { DocsMeta } from '../types/docs';
const props = defineProps<{ pages: DocsMeta[]; active: string; query: string }>();
defineEmits<{ navigate: [] }>();
const groups = computed(() => [...new Set(props.pages.map(page => page.group))].map(name => ({ name, pages: props.pages.filter(page => page.group === name) })));
</script>

<template>
  <nav aria-label="Documentation" class="docs-navigation">
    <div v-for="group in groups" :key="group.name" class="docs-nav-group">
      <h2>{{ group.name }}</h2>
      <NuxtLink v-for="page in group.pages" :key="page.slug" :to="page.path" :prefetch="false" :aria-current="page.slug === active ? 'page' : undefined" @click="$emit('navigate')">{{ page.label }}</NuxtLink>
    </div>
    <p v-if="!pages.length" class="docs-empty">Nothing matches “{{ query }}”. Try “session”, “sign” or “error”.</p>
  </nav>
</template>
