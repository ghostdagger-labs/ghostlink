import { defineNuxtModule, addVitePlugin, addTemplate } from '@nuxt/kit';
import { resolve } from 'node:path';
import { compileDocs, repositoryRoot } from './docs-compiler';
import { docsManifest, docsPath } from './docs-manifest';

export default defineNuxtModule({
  meta: { name: 'ghostlink-docs' },
  async setup(_options, nuxt) {
    const output = resolve(nuxt.options.buildDir, 'docs-public');
    await compileDocs(output);
    // Internal SSR fetches do not pass through Nuxt's dev static-file middleware.
    // Nitro's raw loader protects snippet text (for example import.meta.hot)
    // from code substitutions while keeping each artifact a lazy server chunk.
    const dataModule = addTemplate({ filename: 'docs-data.mjs', write: true, getContents: () => `/** @type {Record<string, () => Promise<unknown>>} */\nexport const documents = {\n${['catalog', 'search', ...docsManifest.map(page => page.slug)].map(slug => `${JSON.stringify(`${slug}.json`)}: () => import(${JSON.stringify(`raw:./docs-public/__docs/${slug}.json`)}).then(module => JSON.parse(module.default)),`).join('\n')}\n};\n` });
    nuxt.options.alias['#docs-generated'] = dataModule.dst;
    addTemplate({ filename: 'docs-data.d.ts', write: true, getContents: () => 'export declare const documents: Record<string, () => Promise<unknown>>;\n' });
    // Nuxt cleans its production build directory after module setup.
    nuxt.hook('app:templates', async () => { await compileDocs(output); });
    nuxt.hook('nitro:config', config => {
      config.publicAssets ??= [];
      config.publicAssets.push({ dir: resolve(output, '__docs'), baseURL: '/__docs', maxAge: 0, fallthrough: true });
      if (nuxt.options.dev) {
        // Dev static middleware redirects its mount root (/docs) to /docs/.
        // Exact source handlers keep the canonical article route untouched.
        config.handlers ??= [];
        config.handlers.push(...docsManifest.map(page => ({ route: `/docs/${page.slug}.md`, handler: resolve(repositoryRoot, 'website/server/docs/source.ts') })));
      } else {
        config.publicAssets.push({ dir: resolve(output, 'docs'), baseURL: '/docs', maxAge: 0, fallthrough: true });
      }
      config.prerender ??= {};
      config.prerender.routes ??= [];
      config.prerender.routes.push(...docsManifest.map(page => docsPath(page.slug)));
      config.prerender.failOnError = true;
      // Docs link to a live demo. Its authentication runtime must never be prerendered.
      config.prerender.crawlLinks = false;
    });
    addVitePlugin({
        name: 'ghostlink-docs-watch',
        configureServer(server) {
          const paths = docsManifest.map(page => resolve(repositoryRoot, page.source));
          server.watcher.add(paths);
          let pending = Promise.resolve();
          server.watcher.on('change', path => {
            if (!paths.includes(path)) return;
            pending = pending.then(async () => { await compileDocs(output); server.ws.send({ type: 'full-reload' }); }).catch(error => {
              server.ws.send({ type: 'error', err: { message: String(error), stack: '', plugin: 'ghostlink-docs' } });
            });
          });
        },
    });
  },
});
