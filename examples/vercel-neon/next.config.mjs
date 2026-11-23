import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const serverDirectory = resolve(dirname(fileURLToPath(import.meta.resolve('@ghostdagger/ghostlink-server/server'))), '..');
const vendor = relative(directory, resolve(serverDirectory, 'vendor')).replaceAll('\\', '/');

/** @type {import('next').NextConfig} */
export default {
  // Preserve createRequire(import.meta.url) and the vendored Node WASM layout.
  serverExternalPackages: ['@ghostdagger/ghostlink-server', '@neondatabase/serverless'],
  outputFileTracingRoot: resolve(directory, '../..'),
  outputFileTracingIncludes: {
    '/auth/ghostlink/*': [`${vendor}/**/*`],
    '/api/private': [`${vendor}/**/*`],
  },
};
