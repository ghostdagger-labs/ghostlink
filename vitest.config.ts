import { defineConfig } from 'vitest/config';
export default defineConfig({ resolve: { alias: { 'ghostlink-core': new URL('./packages/ghostlink-core/src/index.ts', import.meta.url).pathname } }, test: { include: ['packages/**/*.test.ts'], environment: 'node' } });
