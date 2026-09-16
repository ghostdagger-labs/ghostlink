<script setup lang="ts">
const { theme } = useLandingTheme();
useHead({ title: 'Documentation coming soon — Ghostlink' });
</script>
<template>
  <div class="landing" :data-theme="theme" style="min-height:100vh">
    <LandingHeader />
    <main style="max-width:1200px;margin:0 auto;padding:100px 24px;min-height:65vh">
      <span style="font:600 10.5px Figtree;letter-spacing:.09em;text-transform:uppercase;color:var(--acc)">Ghostlink / Docs</span>
      <h1 style="font:600 48px/1.1 Sora,sans-serif;letter-spacing:-2px;max-width:20ch">Documentation coming soon.</h1>
      <p style="font:400 19px/1.5 Figtree,sans-serif;color:var(--ink2);max-width:48ch">Try wallet login in the working Vue example while we prepare the documentation.</p>
      <div style="display:flex;gap:11px;flex-wrap:wrap;margin-top:28px">
        <NuxtLink to="/demo" style="padding:15px 22px;border-radius:13px;background:var(--acc);color:var(--accInk);font-weight:700">Try the demo</NuxtLink>
        <NuxtLink to="/" style="padding:15px 22px;border-radius:13px;border:1px solid var(--line2);color:var(--ink);font-weight:700">Back home</NuxtLink>
      </div>
    </main>
    <LandingFooter />
  </div>
</template>
