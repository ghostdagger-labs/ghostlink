<script setup lang="ts">
import { guideUrl, releaseVersion, repositoryUrl } from '../data/release';
const { theme } = useLandingTheme();
useSeoMeta({
  title: 'Get started with Ghostlink — Packages and integration guides',
  description: 'Install Ghostlink’s public beta from npm. Follow Vue, React, and Node guides for Kaspa wallet login, SQLite or Postgres sessions, and protected requests.',
});
const guides = [
  { title: 'Build with Vue', description: 'Install GhostlinkPlugin, render the button and modal, and read session state with useGhostlink(). Includes a Node backend and protected requests.', href: guideUrl('vue') },
  { title: 'Build with React', description: 'Keep a stable client in GhostlinkProvider and add login to your components. Includes setup, restoration, logout, and a Node backend.', href: guideUrl('react') },
  { title: 'Use Postgres or Neon', description: 'Run migratePostgresStorage() before serving traffic, then pass createPostgresStorage() to your server. Install your chosen database driver separately.', href: guideUrl('postgres') },
  { title: 'Deploy on Vercel + Neon', description: 'Follow the Next.js example for shared session storage, database migrations, and Node runtime packaging.', href: `${repositoryUrl}/tree/main/examples/vercel-neon` },
  { title: 'Understand session lifecycle', description: 'Know when identity is ready, how providers attach and clean up, and how to use a separate client per SSR request.', href: guideUrl('lifecycle') },
  { title: 'Make it feel like your app', description: 'Style the included components with scoped CSS variables, customize their content, or build your own interface on the controller.', href: guideUrl('theming') },
];
const operations = [
  { method: 'connect(walletId)', result: 'Connect a specific wallet, such as kasware or kastle. Connection alone does not sign a user in.' },
  { method: 'authenticate()', result: 'Request a login signature and return the session after backend verification.' },
  { method: 'restoreSession()', result: 'Recheck the backend session without another login signature. Wait for initialization to be ready before using identity.' },
  { method: 'onAuthenticated(listener)', result: 'Continue your app’s flow after a fresh verified login. Session restoration does not trigger this callback.' },
  { method: 'disconnect()', result: 'Clear local state and request server revocation. Check revocationPending if the server cannot be reached.' },
  { method: 'auth.getSession(request)', result: 'Read the verified identity in a protected server handler. Your app supplies its own permissions and CSRF checks for mutations.' },
];
</script>
<template>
  <div class="landing" :data-theme="theme" style="min-height:100vh">
    <a class="skip-link" href="#main">Skip to content</a>
    <LandingHeader />
    <main id="main">
      <section class="docs-intro">
        <div class="section-inner">
          <span class="eyebrow">Get started · {{ releaseVersion }}</span>
          <h1>From npm install to wallet login.</h1>
          <p class="section-intro">Choose your frontend, add a Node 24 verification backend, and build a login flow that belongs in your app. Start with a complete guide or bring Ghostlink into your existing stack.</p>
          <PackageInstall />
          <p class="support-note">Both sides must use the same public origin and network. Import the core stylesheet in your frontend and keep server imports on the backend. The guides include these setup steps.</p>
        </div>
      </section>
      <section class="docs-section" aria-labelledby="guides-heading">
        <div class="section-inner">
          <span class="eyebrow">Integration guides</span>
          <h2 id="guides-heading">A clear path for your stack.</h2>
          <div class="guide-grid">
            <a v-for="guide in guides" :key="guide.title" :href="guide.href" class="guide-card">
              <h3>{{ guide.title }} <span aria-hidden="true">↗</span></h3>
              <p>{{ guide.description }}</p>
            </a>
          </div>
        </div>
      </section>
      <section class="docs-section" aria-labelledby="api-heading">
        <div class="section-inner">
          <span class="eyebrow">The APIs you’ll use</span>
          <h2 id="api-heading">Connect. Verify. Welcome back.</h2>
          <p class="section-intro">Vue and React use the same core controller. Start with the components, then reach for these methods when your app needs a custom flow.</p>
          <dl class="api-list">
            <div v-for="operation in operations" :key="operation.method">
              <dt><code>{{ operation.method }}</code></dt>
              <dd>{{ operation.result }}</dd>
            </div>
          </dl>
          <p class="support-note">Beyond login, <code>signMessage()</code>, <code>signTransaction()</code>, and <code>sendTransaction()</code> use wallet capability checks and user approval. Transaction signing does not broadcast; transfers are separate and use bigint sompi amounts. Real testnet transaction validation remains pending. <a :href="`${repositoryUrl}/blob/main/docs/testing/compatibility-v1.json`">Review wallet compatibility →</a></p>
          <p class="support-note">Read the <a :href="`${repositoryUrl}/blob/main/docs/security/model.md`">security model</a> for challenge verification, cookie sessions, and trust boundaries. Generic message signing does not provide wallet-side phishing resistance; no independent security audit is claimed.</p>
        </div>
      </section>
      <PackageCatalog :show-install="false" />
    </main>
    <LandingFooter />
  </div>
</template>
