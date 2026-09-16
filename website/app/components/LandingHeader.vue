<script setup lang="ts">
import { Sun, Moon } from '@lucide/vue';
const { theme, toggleTheme, ready } = useLandingTheme();
const isDark = computed(() => theme.value === 'dark');
const isLight = computed(() => !isDark.value);
</script>
<template>
<header style="position:sticky;top:0;z-index:40;border-bottom:1px solid var(--line);background:color-mix(in srgb,var(--bg) 84%,transparent);backdrop-filter:blur(14px)">
  <div style="max-width:1200px;margin:0 auto;padding:10px 24px;min-height:62px;display:flex;align-items:center;gap:20px;flex-wrap:wrap">
    <span style="display:flex;align-items:center;gap:9px">
      <svg aria-hidden="true" focusable="false" width="30" height="18" viewBox="0 0 34 20" fill="none" style="flex:none">
        <circle cx="11" cy="10" r="6.4" fill="var(--acc)"></circle>
        <circle cx="23" cy="10" r="6.4" fill="none" stroke="var(--acc)" stroke-width="2.1"></circle>
      </svg>
      <span style="font-family:Sora,sans-serif;font-weight:600;font-size:17px;letter-spacing:-.5px;color:var(--ink)">Ghostlink</span>
    </span>
    <nav style="display:flex;gap:16px;flex-wrap:wrap">
      <a href="/#how" style="font-size:13.5px;font-weight:600;color:var(--ink2)" data-hover="lp-hover-0">How it works</a>
      <a href="/#wallets" style="font-size:13.5px;font-weight:600;color:var(--ink2)" data-hover="lp-hover-1">Wallets</a>
      <NuxtLink to="/docs" style="font-size:13.5px;font-weight:600;color:var(--ink2)" data-hover="lp-hover-2">Docs</NuxtLink>
      <NuxtLink to="/demo" style="font-size:13.5px;font-weight:600;color:var(--ink2)" data-hover="lp-hover-3">Demo</NuxtLink>
    </nav>
    <div style="margin-left:auto;display:flex;align-items:center;gap:10px">
      <button :disabled="!ready" @click="toggleTheme" :aria-label="theme === 'dark' ? 'Use light theme' : 'Use dark theme'" style="width:34px;height:34px;border-radius:10px;border:1px solid var(--line);background:var(--surf);display:grid;place-items:center;color:var(--ink2)" data-hover="lp-hover-4">
        <template v-if="isDark">
          <Sun :size="15" aria-hidden="true" />
        </template>
        <template v-if="isLight">
          <Moon :size="15" aria-hidden="true" />
        </template>
      </button>
      <NuxtLink to="/docs" style="height:36px;padding:0 15px;border-radius:10px;background:var(--acc);color:var(--accInk);font-size:13.5px;font-weight:700;display:flex;align-items:center" data-hover="lp-hover-5">Read the docs</NuxtLink>
    </div>
  </div>
</header>
</template>
