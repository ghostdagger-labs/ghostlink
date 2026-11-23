<script setup lang="ts">
import { npmUrl, packages, releaseVersion } from '../data/release';
withDefaults(defineProps<{ showInstall?: boolean }>(), { showInstall: true });
</script>

<template>
  <section id="packages" class="package-section" aria-labelledby="packages-heading">
    <div class="section-inner">
      <span class="eyebrow">Available on npm · {{ releaseVersion }}</span>
      <h2 id="packages-heading">Pick your framework. Keep your stack.</h2>
      <p class="section-intro">Start with core, add the UI for your framework, and run verification on your backend. Four packages, one wallet login flow.</p>
      <div class="package-grid">
        <article v-for="pkg in packages" :key="pkg.id" class="package-card">
          <a class="package-name" :href="npmUrl(pkg.id)">@ghostdagger/ghostlink-{{ pkg.id }}</a>
          <h3>{{ pkg.title }}</h3>
          <p>{{ pkg.description }}</p>
          <code>{{ pkg.api }}</code>
          <div class="package-links">
            <a :href="npmUrl(pkg.id)" :aria-label="`View on npm: ghostlink-${pkg.id}`">View on npm <span aria-hidden="true">↗</span></a>
            <a :href="pkg.guide" :aria-label="`Integration guide: ghostlink-${pkg.id}`">Integration guide <span aria-hidden="true">→</span></a>
          </div>
        </article>
      </div>
      <div v-if="showInstall" class="install-layout">
        <div>
          <h3>Your next commit starts here.</h3>
          <p>Install the packages, connect the backend, and give users a familiar wallet login. The guides walk through setup, protected requests, session restoration, and sign-out.</p>
          <p>Ghostlink’s original code is MIT licensed. The current release is a public beta.</p>
        </div>
        <PackageInstall />
      </div>
    </div>
  </section>
</template>
