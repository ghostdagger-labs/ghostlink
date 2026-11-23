<script setup lang="ts">
import { ArrowRight, Check, CodeXml, Palette, TriangleAlert, RotateCw } from '@lucide/vue';
import { snippets } from 'virtual:ghostlink-code';
import kaswareLogo from '@ghostdagger/ghostlink-core/assets/kasware.png?url&no-inline';
import kastleLogo from '@ghostdagger/ghostlink-core/assets/kastle.png?url&no-inline';
import { npmUrl, releaseVersion, repositoryUrl } from '../data/release';
const { theme, ready } = useLandingTheme();
const lang = ref<'TypeScript' | 'Vue' | 'React' | 'Node'>('TypeScript');
const snippetNote = computed(() => ({
  TypeScript: 'A headless sign-in handler for your own UI. Configure the same-origin authentication backend first.',
  Vue: 'Render inside GhostlinkProvider or an app using GhostlinkPlugin. Import the core styles and configure your backend.',
  React: 'Render inside GhostlinkProvider. Import the core styles and configure your backend.',
  Node: 'A Node 24 backend with persistent SQLite. Match the frontend origin and network; see the guide for deployment.',
})[lang.value]);
const code = computed(() => snippets[lang.value].tokens);
const codeFile = computed(() => snippets[lang.value].file);
const codeTabs = computed(() => (Object.keys(snippets) as (keyof typeof snippets)[]).map(name => ({ name, bg: lang.value === name ? 'var(--chipOn)' : 'transparent', fg: lang.value === name ? 'var(--chipOnInk)' : 'var(--ink3)', pick: () => { lang.value = name; } })));
const heroStats = [{ v: '4', k: 'npm packages' }, { v: 'Vue + React', k: 'native components' }, { v: 'MIT', k: 'original code' }];
const payoffs = [
 { text: 'Connect and authenticate through one TypeScript controller.' },
 { text: 'Give KasWare and Kastle users the same familiar login flow.' },
 { text: 'Handle rejection, expiry, and network mismatches with typed errors.' },
 { text: 'Keep your own backend, session storage, and application permissions.' },
];
const compare = [
 { before: 'Connect to different browser wallet APIs', after: 'createGhostlink() and built-in adapters' },
 { before: 'Handle wallet discovery and availability', after: 'Browser wallet detection and install guidance' },
 { before: 'Create and verify login challenges', after: 'createGhostlinkServer() verifies signatures' },
 { before: 'Check and restore application sessions', after: 'restoreSession() checks your backend' },
 { before: 'Build each framework’s login interface', after: 'Native Vue and React components' },
];
const wallets = [
 { name: 'KasWare', kind: 'Browser extension · login', logo: kaswareLogo, status: 'Supported' },
 { name: 'Kastle', kind: 'Browser extension · login', logo: kastleLogo, status: 'Supported' },
].map(w => ({ ...w, fg: 'var(--okText)', chip: 'var(--okSoft)' }));
const marquee = Array.from({ length: 8 }, () => wallets).flat();
const preview = wallets.map(w => ({ ...w, badge: 'Extension', fg: 'var(--ink2)', chip: 'var(--chip)' }));
</script>
<template>
<div class="landing" :data-theme="theme" style="min-height:100vh;background:var(--bg)">

<a class="skip-link" href="#main">Skip to content</a>
<LandingHeader />
<main id="main">

<section style="position:relative;overflow:hidden;border-bottom:1px solid var(--line)">
  <span style="position:absolute;inset:0;background-image:linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px);background-size:48px 48px;pointer-events:none"></span>
  <span style="position:absolute;inset:0;background:radial-gradient(60% 90% at 78% -10%,var(--accSoft),transparent 62%);pointer-events:none"></span>
  <div style="position:relative;max-width:1200px;margin:0 auto;padding:74px 24px 78px;display:grid;grid-template-columns:repeat(auto-fit,minmax(340px,1fr));gap:44px;align-items:center">
    <div style="display:flex;flex-direction:column;gap:22px;animation:fadeUp .5s ease both">
      <span style="display:inline-flex;align-items:center;gap:8px;align-self:flex-start;padding:5px 12px;border-radius:999px;background:var(--accSoft);border:1px solid var(--accLine)">
        <span style="width:6px;height:6px;border-radius:50%;background:var(--acc);animation:drift 2s infinite"></span>
        <span style="font:600 11.5px 'JetBrains Mono',monospace;color:var(--acc)">Public beta · {{ releaseVersion }} on npm</span>
      </span>
      <h1 style="margin:0;max-width:20ch;font-family:Sora,sans-serif;font-size:60px;line-height:1.02;letter-spacing:-3px;font-weight:600;color:var(--ink);text-wrap:balance">Kaspa wallet login for your dApp.</h1>
      <p style="margin:0;max-width:50ch;font-size:19px;line-height:1.5;color:var(--ink2);text-wrap:pretty">Give Kaspa users a familiar way in. Add wallet login with TypeScript, Vue, or React, and verify sessions on your own Node backend. Users keep their keys. You keep building.</p>
      <div style="display:flex;gap:11px;flex-wrap:wrap;align-items:center">
        <NuxtLink to="/docs" style="height:50px;padding:0 22px;border-radius:13px;background:var(--acc);color:var(--accInk);font-size:15px;font-weight:700;display:flex;align-items:center;gap:9px" data-hover="lp-hover-6">
          Get started
          <ArrowRight :size="16" aria-hidden="true" />
        </NuxtLink>
        <NuxtLink to="/demo" style="height:50px;padding:0 20px;border-radius:13px;border:1px solid var(--line2);background:var(--surf);color:var(--ink);font-size:15px;font-weight:700;display:flex;align-items:center" data-hover="lp-hover-7">Try the demo</NuxtLink>
        <a href="#packages" class="text-link">Explore the packages <ArrowRight :size="14" aria-hidden="true" /></a>
      </div>
      <div style="display:flex;gap:22px;flex-wrap:wrap;padding-top:6px">
        <template v-for="(h, index) in heroStats" :key="index">
          <span style="display:flex;flex-direction:column;gap:2px">
            <span style="font-family:Sora,sans-serif;font-weight:600;font-size:22px;letter-spacing:-.8px;color:var(--ink)">{{ h.v }}</span>
            <span style="font-size:12.5px;color:var(--ink3)">{{ h.k }}</span>
          </span>
        </template>
      </div>
    </div>

    <div style="animation:fadeUp .6s ease .1s both;min-width:0">
      <div style="border:1px solid var(--line);border-radius:18px;background:var(--surf);box-shadow:var(--shadow);overflow:hidden">
        <div role="group" aria-label="Code examples" style="display:flex;align-items:center;gap:2px;padding:7px 8px;border-bottom:1px solid var(--line);background:var(--surf2);overflow-x:auto">
          <template v-for="(c, index) in codeTabs" :key="index">
            <button :disabled="!ready" :aria-pressed="lang === c.name" @click="c.pick" :style="`flex:none;height:28px;padding:0 12px;border-radius:8px;font:600 12px 'JetBrains Mono',monospace;background:${c.bg};color:${c.fg}`">{{ c.name }}</button>
          </template>
          <span style="margin-left:auto;flex:none;padding-left:10px;font:500 11px 'JetBrains Mono',monospace;color:var(--ink3)">{{ codeFile }}</span>
        </div>
        <pre tabindex="0" aria-label="Integration code" style="margin:0;padding:20px;background:var(--code);font:500 12.5px/1.8 'JetBrains Mono',monospace;color:var(--codeInk);overflow-x:auto;min-height:246px"><HighlightedCode :tokens="code" /></pre>
      </div>
      <div class="snippet-note" style="margin-top:12px;display:flex;align-items:center;gap:11px;padding:13px 15px;border:1px solid var(--line);border-radius:14px;background:var(--surf)">
        <span style="width:8px;height:8px;border-radius:50%;background:var(--ok);flex:none"></span>
        <span style="flex:1;min-width:0;font-size:12.5px;color:var(--ink2);line-height:1.4">{{ snippetNote }} <NuxtLink to="/docs">See the setup guides →</NuxtLink></span>
      </div>
    </div>
  </div>
</section>

<section style="border-bottom:1px solid var(--line);background:var(--surf);overflow:hidden">
  <div style="max-width:1200px;margin:0 auto;padding:18px 24px;display:flex;align-items:center;gap:20px">
    <span style="flex:none;font:600 10.5px Figtree;letter-spacing:.09em;text-transform:uppercase;color:var(--ink3)">Browser wallet adapters</span>
    <div style="flex:1;min-width:0;overflow:hidden">
      <div style="display:flex;gap:34px;width:max-content;animation:slide 38s linear infinite">
        <template v-for="(m, index) in marquee" :key="index">
          <span :aria-hidden="index >= 2 ? true : undefined" style="display:flex;align-items:center;gap:9px;font-family:Sora,sans-serif;font-weight:500;font-size:16px;color:var(--ink3);white-space:nowrap"><img :src="m.logo" alt="" width="24" height="24" class="wallet-brand-logo" />{{ m.name }}</span>
        </template>
      </div>
    </div>
  </div>
</section>

<PackageCatalog />

<section id="how" style="border-bottom:1px solid var(--line)">
  <div style="max-width:1200px;margin:0 auto;padding:72px 24px">
    <div style="max-width:52ch;margin-bottom:38px">
      <span style="font:600 10.5px Figtree;letter-spacing:.09em;text-transform:uppercase;color:var(--acc)">How it works</span>
      <h2 style="margin:12px 0 0;font-family:Sora,sans-serif;font-size:38px;line-height:1.1;letter-spacing:-1.6px;font-weight:600;color:var(--ink);text-wrap:balance">From wallet to welcome back.</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:18px">
      <div style="border:1px solid var(--line);border-radius:18px;background:var(--surf);padding:24px;display:flex;flex-direction:column;gap:16px">
        <div style="height:120px;border-radius:13px;background:var(--surf2);display:grid;place-items:center">
          <svg aria-hidden="true" focusable="false" width="88" height="88" viewBox="0 0 88 88" fill="none">
            <rect x="18" y="18" width="52" height="52" rx="10" stroke="var(--line2)" stroke-width="2"></rect>
            <path d="M18 32h52" stroke="var(--line2)" stroke-width="2" />
            <circle cx="26" cy="25" r="2" fill="var(--acc)" />
            <rect x="29" y="41" width="30" height="19" rx="4" stroke="var(--acc)" stroke-width="2" />
            <path d="M50 47h9v7h-9a3.5 3.5 0 0 1 0-7Z" fill="var(--acc)" />
          </svg>
        </div>
        <span style="font:600 11px 'JetBrains Mono',monospace;color:var(--ink3)">01 · choose</span>
        <div style="font-size:17px;font-weight:700;color:var(--ink)">Choose your wallet</div>
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:var(--ink2);text-wrap:pretty">Let users connect KasWare or Kastle from the same chooser. Ghostlink detects the browser extension and guides the connection.</p>
      </div>
      <div style="border:1px solid var(--line);border-radius:18px;background:var(--surf);padding:24px;display:flex;flex-direction:column;gap:16px">
        <div style="height:120px;border-radius:13px;background:var(--surf2);display:grid;place-items:center;padding:0 18px">
          <div style="width:100%;max-width:190px;display:flex;flex-direction:column;gap:7px">
            <div style="display:flex;align-items:center;gap:7px">
              <span style="width:9px;height:9px;border-radius:3px;background:var(--acc)"></span>
              <span style="flex:1;height:7px;border-radius:99px;background:var(--line2)"></span>
            </div>
            <div style="display:flex;align-items:center;gap:7px">
              <span style="width:9px;height:9px;border-radius:3px;background:var(--acc)"></span>
              <span style="flex:1;height:7px;border-radius:99px;background:var(--line2);max-width:78%"></span>
            </div>
            <div style="display:flex;align-items:center;gap:7px">
              <span style="width:9px;height:9px;border-radius:3px;background:var(--acc)"></span>
              <span style="flex:1;height:7px;border-radius:99px;background:var(--line2);max-width:56%"></span>
            </div>
            <div style="margin-top:6px;display:flex;gap:6px">
              <span style="flex:1;height:22px;border-radius:7px;border:1px solid var(--line2)"></span>
              <span style="flex:2;height:22px;border-radius:7px;background:var(--acc)"></span>
            </div>
          </div>
        </div>
        <span style="font:600 11px 'JetBrains Mono',monospace;color:var(--ink3)">02 · sign</span>
        <div style="font-size:17px;font-weight:700;color:var(--ink)">Review before you sign</div>
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:var(--ink2);text-wrap:pretty">Users review the app, account, and network, then approve a login message in their wallet. Signing in requires no funds or transfer.</p>
      </div>
      <div style="border:1px solid var(--line);border-radius:18px;background:var(--surf);padding:24px;display:flex;flex-direction:column;gap:16px">
        <div style="height:120px;border-radius:13px;background:var(--surf2);display:grid;place-items:center">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="width:34px;height:34px;border-radius:11px;background:var(--acc)"></span>
            <span style="width:42px;height:2px;background:var(--accLine)"></span>
            <span style="width:34px;height:34px;border-radius:11px;border:2px solid var(--acc)"></span>
          </div>
        </div>
        <span style="font:600 11px 'JetBrains Mono',monospace;color:var(--ink3)">03 · verify</span>
        <div style="font-size:17px;font-weight:700;color:var(--ink)">A server-verified session</div>
        <p style="margin:0;font-size:13.5px;line-height:1.6;color:var(--ink2);text-wrap:pretty">Your backend verifies the signature and issues a session. Returning users can pick up where they left off while that session is still valid.</p>
      </div>
    </div>
  </div>
</section>

<section style="border-bottom:1px solid var(--line);background:var(--surf)">
  <div style="max-width:1200px;margin:0 auto;padding:72px 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:40px;align-items:start">
    <div>
      <span style="font:600 10.5px Figtree;letter-spacing:.09em;text-transform:uppercase;color:var(--acc)">More time for your app</span>
      <h2 style="margin:12px 0 16px;max-width:26ch;font-family:Sora,sans-serif;font-size:38px;line-height:1.1;letter-spacing:-1.6px;font-weight:600;color:var(--ink);text-wrap:balance">Wallet login, with less to wire up.</h2>
      <p style="margin:0 0 22px;max-width:48ch;font-size:15.5px;line-height:1.6;color:var(--ink2);text-wrap:pretty">Your app needs a verified identity, a clear login screen, and a way back in after a reload. Ghostlink connects those pieces, from the wallet prompt to your backend session.</p>
      <div style="display:flex;flex-direction:column;gap:11px">
        <template v-for="(p, index) in payoffs" :key="index">
          <div style="display:flex;gap:11px;align-items:flex-start">
            <span style="flex:none;width:19px;height:19px;border-radius:6px;background:var(--okSoft);display:grid;place-items:center;margin-top:1px">
              <Check :size="11" aria-hidden="true" />
            </span>
            <span style="flex:1;min-width:0;font-size:14px;line-height:1.5;color:var(--ink2)">{{ p.text }}</span>
          </div>
        </template>
      </div>
    </div>
    <div style="border:1px solid var(--line);border-radius:18px;overflow:hidden;background:var(--bg)">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line)">
        <div style="padding:16px 18px;background:var(--surf2);font:700 10.5px Figtree;letter-spacing:.07em;text-transform:uppercase;color:var(--ink3)">Rolling your own</div>
        <div style="padding:16px 18px;background:var(--surf2);font:700 10.5px Figtree;letter-spacing:.07em;text-transform:uppercase;color:var(--acc)">With Ghostlink</div>
      </div>
      <template v-for="(c, index) in compare" :key="index">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--line);border-top:1px solid var(--line)">
          <div style="padding:15px 18px;background:var(--surf);font-size:13px;line-height:1.5;color:var(--ink3)">{{ c.before }}</div>
          <div style="padding:15px 18px;background:var(--surf);font-size:13px;line-height:1.5;color:var(--ink);font-weight:600">{{ c.after }}</div>
        </div>
      </template>
    </div>
  </div>
</section>

<section id="wallets" style="border-bottom:1px solid var(--line)">
  <div style="max-width:1200px;margin:0 auto;padding:72px 24px">
    <div style="display:flex;align-items:flex-end;justify-content:space-between;gap:24px;flex-wrap:wrap;margin-bottom:32px">
      <div style="max-width:46ch">
        <span style="font:600 10.5px Figtree;letter-spacing:.09em;text-transform:uppercase;color:var(--acc)">Wallet support</span>
        <h2 style="margin:12px 0 0;font-family:Sora,sans-serif;font-size:38px;line-height:1.1;letter-spacing:-1.6px;font-weight:600;color:var(--ink);text-wrap:balance">Two wallets. One integration.</h2>
      </div>
      <p style="margin:0;max-width:40ch;font-size:14px;line-height:1.6;color:var(--ink2);text-wrap:pretty">Connect with the KasWare or Kastle browser extension. Both use wallet-approved login messages and server-verified sessions.</p>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:14px">
      <template v-for="(w, index) in wallets" :key="index">
        <div style="border:1px solid var(--line);border-radius:16px;background:var(--surf);padding:18px;display:flex;align-items:center;gap:13px">
          <img :src="w.logo" alt="" width="38" height="38" class="wallet-brand-logo" />
          <span style="flex:1;min-width:0">
            <span style="display:block;font-size:14px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ w.name }}</span>
            <span style="display:block;font-size:11.5px;color:var(--ink3)">{{ w.kind }}</span>
          </span>
          <span :style="`flex:none;font:600 10.5px Figtree;color:${w.fg};background:${w.chip};padding:3px 8px;border-radius:999px;white-space:nowrap`">{{ w.status }}</span>
        </div>
      </template>
    </div>
    <p class="support-note">Login has been tested with KasWare and Kastle browser extensions. Operation and network support vary by wallet; real testnet transaction validation is still pending. <a :href="`${repositoryUrl}/blob/main/docs/testing/compatibility-v1.json`">See the compatibility record →</a></p>
  </div>
</section>

<section style="border-bottom:1px solid var(--line);background:var(--surf)">
  <div style="max-width:1200px;margin:0 auto;padding:72px 24px">
    <div style="max-width:50ch;margin-bottom:34px">
      <span style="font:600 10.5px Figtree;letter-spacing:.09em;text-transform:uppercase;color:var(--acc)">In the box</span>
      <h2 style="margin:12px 0 0;font-family:Sora,sans-serif;font-size:38px;line-height:1.1;letter-spacing:-1.6px;font-weight:600;color:var(--ink);text-wrap:balance">Built for the details of login.</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:16px">
      <div style="border:1px solid var(--line);border-radius:16px;background:var(--bg);padding:20px">
        <div style="width:34px;height:34px;border-radius:11px;background:var(--accSoft);display:grid;place-items:center;margin-bottom:13px;color:var(--acc)">
          <CodeXml :size="17" aria-hidden="true" />
        </div>
        <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px">Typed end to end</div>
        <p style="margin:0;font-size:13.5px;line-height:1.55;color:var(--ink2);text-wrap:pretty">Use createGhostlink() for wallet operations and GhostlinkError for typed failures. Runtime capability checks reflect what the connected wallet supports.</p>
      </div>
      <div style="border:1px solid var(--line);border-radius:16px;background:var(--bg);padding:20px">
        <div style="width:34px;height:34px;border-radius:11px;background:var(--accSoft);display:grid;place-items:center;margin-bottom:13px;color:var(--acc)">
          <Palette :size="17" aria-hidden="true" />
        </div>
        <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px">Headless, then themed</div>
        <p style="margin:0;font-size:13.5px;line-height:1.55;color:var(--ink2);text-wrap:pretty">Start with GhostlinkConnectButton and GhostlinkModal, or build your own UI with useGhostlink(). Scoped CSS variables let the components fit your brand.</p>
      </div>
      <div style="border:1px solid var(--line);border-radius:16px;background:var(--bg);padding:20px">
        <div style="width:34px;height:34px;border-radius:11px;background:var(--accSoft);display:grid;place-items:center;margin-bottom:13px;color:var(--acc)">
          <TriangleAlert :size="17" aria-hidden="true" />
        </div>
        <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px">Errors you can handle</div>
        <p style="margin:0;font-size:13.5px;line-height:1.55;color:var(--ink2);text-wrap:pretty">Rejected signatures, expired messages, network mismatches and verification failures have typed errors and clear feedback in the login flow.</p>
      </div>
      <div style="border:1px solid var(--line);border-radius:16px;background:var(--bg);padding:20px">
        <div style="width:34px;height:34px;border-radius:11px;background:var(--accSoft);display:grid;place-items:center;margin-bottom:13px;color:var(--acc)">
          <RotateCw :size="17" aria-hidden="true" />
        </div>
        <div style="font-size:15px;font-weight:700;color:var(--ink);margin-bottom:6px">Sessions restore on reload</div>
        <p style="margin:0;font-size:13.5px;line-height:1.55;color:var(--ink2);text-wrap:pretty">Framework providers restore sessions on mount. In your own UI, use restoreSession() and check initialization before showing an identity. Server expiry and revocation still apply.</p>
      </div>
    </div>
  </div>
</section>

<section style="border-bottom:1px solid var(--line)">
  <div style="max-width:1200px;margin:0 auto;padding:72px 24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:34px;align-items:center">
    <div>
      <span style="font:600 10.5px Figtree;letter-spacing:.09em;text-transform:uppercase;color:var(--acc)">Live demo</span>
      <h2 style="margin:12px 0 14px;max-width:24ch;font-family:Sora,sans-serif;font-size:36px;line-height:1.1;letter-spacing:-1.5px;font-weight:600;color:var(--ink);text-wrap:balance">Try the real login flow.</h2>
      <p style="margin:0 0 22px;max-width:46ch;font-size:15px;line-height:1.6;color:var(--ink2);text-wrap:pretty">Walk through wallet selection, message review, and session verification in the Vue example. Then try a protected request against the demo backend.</p>
      <div style="display:flex;gap:11px;flex-wrap:wrap">
        <NuxtLink to="/demo" style="height:46px;padding:0 20px;border-radius:12px;background:var(--acc);color:var(--accInk);font-size:14.5px;font-weight:700;display:flex;align-items:center" data-hover="lp-hover-9">Open the demo</NuxtLink>
        <NuxtLink to="/docs" style="height:46px;padding:0 18px;border-radius:12px;border:1px solid var(--line2);color:var(--ink2);font-size:14.5px;font-weight:700;display:flex;align-items:center" data-hover="lp-hover-10">Read the docs</NuxtLink>
      </div>
    </div>
    <div style="border:1px solid var(--line);border-radius:18px;background:var(--surf);padding:20px;box-shadow:var(--shadow);min-width:0">
      <div style="display:flex;align-items:center;gap:10px;padding-bottom:14px;border-bottom:1px solid var(--line);margin-bottom:14px">
        <svg aria-hidden="true" focusable="false" width="24" height="14" viewBox="0 0 34 20" fill="none" style="flex:none">
          <circle cx="11" cy="10" r="6.4" fill="var(--acc)"></circle>
          <circle cx="23" cy="10" r="6.4" fill="none" stroke="var(--acc)" stroke-width="2.1"></circle>
        </svg>
        <span style="font-size:13.5px;font-weight:700;color:var(--ink)">Wallet login preview</span>
        <span style="margin-left:auto;display:flex;align-items:center;gap:6px;padding:3px 9px;border-radius:999px;background:var(--okSoft)">
          <span style="width:5px;height:5px;border-radius:50%;background:var(--ok)"></span>
          <span style="font:600 10px 'JetBrains Mono',monospace;color:var(--okText)">preview</span>
        </span>
      </div>
      <div style="display:flex;flex-direction:column;gap:7px">
        <template v-for="(p, index) in preview" :key="index">
          <div style="display:flex;align-items:center;gap:11px;padding:10px 11px;border:1px solid var(--line);border-radius:12px;background:var(--surf2)">
            <img :src="p.logo" alt="" width="30" height="30" class="wallet-brand-logo" />
            <span style="flex:1;min-width:0;font-size:13px;font-weight:700;color:var(--ink);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ p.name }}</span>
            <span :style="`flex:none;font:600 10px Figtree;color:${p.fg};background:${p.chip};padding:3px 8px;border-radius:999px`">{{ p.badge }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</section>

<section style="border-bottom:1px solid var(--line);background:var(--surf)">
  <div style="max-width:1200px;margin:0 auto;padding:64px 24px;display:flex;align-items:center;justify-content:space-between;gap:28px;flex-wrap:wrap">
    <div style="min-width:260px">
      <h2 style="margin:0 0 8px;max-width:22ch;font-family:Sora,sans-serif;font-size:32px;line-height:1.12;letter-spacing:-1.3px;font-weight:600;color:var(--ink);text-wrap:balance">Make wallet login your next commit.</h2>
      <p style="margin:0;max-width:44ch;font-size:14.5px;line-height:1.55;color:var(--ink2)">The packages are on npm. The guides cover the full flow. Pick your framework and start building.</p>
    </div>
    <div style="display:flex;gap:11px;flex-wrap:wrap">
      <NuxtLink to="/docs" style="height:48px;padding:0 20px;border-radius:13px;background:var(--acc);color:var(--accInk);font:700 14.5px Figtree;display:flex;align-items:center;gap:11px" data-hover="lp-hover-11">Start building <ArrowRight :size="16" aria-hidden="true" /></NuxtLink>
      <a :href="npmUrl('core')" style="height:48px;padding:0 20px;border-radius:13px;border:1px solid var(--line2);color:var(--ink);font-size:14.5px;font-weight:700;display:flex;align-items:center" data-hover="lp-hover-12">View core on npm</a>
    </div>
  </div>
</section>

</main>
<LandingFooter />

</div>
</template>
