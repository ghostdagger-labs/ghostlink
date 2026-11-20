import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { createRequire } from 'node:module';

const vueRequire = createRequire(new URL('./packages/ghostlink-vue/package.json', import.meta.url));
export default defineConfig({
  plugins: [vue()],
  resolve: { alias: [
    { find: /^ghostlink-core$/, replacement: new URL('./packages/ghostlink-core/src/index.ts', import.meta.url).pathname },
    // plugin-vue deduplicates Vue at the workspace root; use the package's actual peer.
    { find: /^vue$/, replacement: vueRequire.resolve('vue') },
    { find: /^vue\/server-renderer$/, replacement: vueRequire.resolve('vue/server-renderer') },
  ] },
  test: { include: ['packages/**/*.test.ts'], environment: 'node' },
});
