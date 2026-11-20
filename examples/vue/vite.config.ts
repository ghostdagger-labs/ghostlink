import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react';
export default defineConfig({
  plugins: [vue(), react(), {
    name: 'ghostlink-canonical-development-origin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const alias = ['localhost:5173', '[::1]:5173'].includes(req.headers.host ?? '');
        if (alias && ['GET', 'HEAD'].includes(req.method ?? '') && req.headers.accept?.includes('text/html')) {
          const path = new URL(req.url ?? '/', 'http://127.0.0.1:5173');
          res.writeHead(307, { Location: `http://127.0.0.1:5173${path.pathname}${path.search}`, 'Cache-Control': 'no-store' });
          res.end(); return;
        }
        next();
      });
    },
  }],
  resolve: { alias: [
    { find: /^@ghostdagger\/ghostlink-core$/, replacement: new URL('../../packages/ghostlink-core/src/index.ts', import.meta.url).pathname },
    { find: /^@ghostdagger\/ghostlink-vue$/, replacement: new URL('../../packages/ghostlink-vue/src/index.ts', import.meta.url).pathname },
    { find: /^@ghostdagger\/ghostlink-react$/, replacement: new URL('../../packages/ghostlink-react/src/index.tsx', import.meta.url).pathname },
  ] },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/auth': { target: 'http://127.0.0.1:5174', changeOrigin: false }, '/api': { target: 'http://127.0.0.1:5174', changeOrigin: false } } },
});
