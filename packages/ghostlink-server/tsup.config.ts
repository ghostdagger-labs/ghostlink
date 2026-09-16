import { defineConfig } from 'tsup';
export default defineConfig({ removeNodeProtocol: false, platform: 'node', target: 'node24' });
