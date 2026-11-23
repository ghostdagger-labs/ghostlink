import { build } from 'esbuild';
import { cp, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
export default defineNuxtConfig({
  compatibilityDate: '2026-09-16',
  devtools: { enabled: false },
  css: ['~/assets/fonts.css', '~/assets/landing.css'],
  app: { head: { title: 'Ghostlink — Kaspa wallet login', htmlAttrs: { lang: 'en' }, meta: [{ name: 'description', content: 'Kaspa wallet login for TypeScript dApps. Vue and React components, wallet-approved messages, and server-verified sessions.' }, { name: 'theme-color', content: '#0C0D11' }], link: [{ rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }] } },
  nitro: {
    // Auto-detect Vercel; local and Docker builds default to node-server.
    // Preserve the verifier's relative vendor require and WASM alongside its package.
    rollupConfig: { external: ['@ghostdagger/ghostlink-server'] },
    esbuild: { options: { target: 'node24' } },
  },
  hooks: {
    'nitro:init'(nitro) {
      // Append to the preset's hooks so Vercel still emits its routing/function manifests.
      nitro.hooks.hook('compiled', async nitro => {
        if (nitro.options.dev) return;
        const runtime = join(nitro.options.output.serverDir, 'node_modules/@ghostdagger/ghostlink-server');
        await mkdir(join(runtime, 'dist'), { recursive: true });
        // A separate Node bundle preserves import.meta.url for the relative WASM loader.
        await build({
          entryPoints: [fileURLToPath(new URL('../packages/ghostlink-server/dist/index.js', import.meta.url))],
          outfile: join(runtime, 'dist/index.js'), bundle: true, platform: 'node', target: 'node24', format: 'esm',
          external: ['../vendor/kaspa/kaspa.js'],
          banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require = __createRequire(import.meta.url);' },
        });
        await cp(fileURLToPath(new URL('../packages/ghostlink-server/vendor', import.meta.url)), join(runtime, 'vendor'), { recursive: true });
        await writeFile(join(runtime, 'package.json'), JSON.stringify({ name: '@ghostdagger/ghostlink-server', type: 'module', main: './dist/index.js' }));
      });
    },
  },
  vite: { server: { fs: { allow: ['..'] } } },
});
