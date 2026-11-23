<script setup lang="ts">
import { guideUrl, releaseVersion } from '../data/release';
import { installCommands } from 'virtual:ghostlink-code';
const { ready } = useLandingTheme();
const selected = ref<'Vue' | 'React' | 'TypeScript'>('Vue');
const choices = {
  Vue: { guide: guideUrl('vue'), label: 'Follow the Vue guide', requirement: 'For Vue 3.5+ apps.' },
  React: { guide: guideUrl('react'), label: 'Follow the React guide', requirement: 'For React 18.3 or 19 apps.' },
  TypeScript: { guide: guideUrl('core-api'), label: 'Explore the controller API', requirement: 'For your own UI or a headless integration.' },
};
const choice = computed(() => choices[selected.value]);
</script>

<template>
  <div class="package-install">
    <div class="install-tabs" role="group" aria-label="Choose your framework">
      <button v-for="(_, name) in choices" :key="name" type="button" :disabled="!ready" :aria-pressed="selected === name" @click="selected = name">{{ name }}</button>
    </div>
    <div class="install-body">
      <p class="install-label">In your frontend</p>
      <pre tabindex="0" aria-label="Frontend install command"><HighlightedCode :tokens="installCommands[selected]" /></pre>
      <p class="install-label">In your Node 24 backend</p>
      <pre tabindex="0" aria-label="Backend install command"><HighlightedCode :tokens="installCommands.server" /></pre>
      <p class="install-note">{{ choice.requirement }} These commands pin matching versions to {{ releaseVersion }}. Configure the authentication backend before signing in.</p>
      <a class="text-link" :href="choice.guide">{{ choice.label }} <span aria-hidden="true">→</span></a>
    </div>
  </div>
</template>
