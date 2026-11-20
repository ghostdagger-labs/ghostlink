import { defineConfig, devices } from '@playwright/test';
import type { PlaywrightTestConfig } from '@playwright/test';
import { join } from 'node:path';

const directory = process.env.GHOSTLINK_GUIDES_DIR;
if (!directory) throw new Error('Run pnpm check:guides to extract and build the guide apps first.');
const basePort = Number(process.env.GHOSTLINK_GUIDES_PORT ?? 43810);
const webServer: NonNullable<PlaywrightTestConfig['webServer']> = [];
const projects: NonNullable<PlaywrightTestConfig['projects']> = [];
for (const [index, framework] of ['vue', 'react'].entries()) {
  const frontendPort = basePort + index * 3;
  const backendPort = frontendPort + 1;
  const productionPort = frontendPort + 2;
  const origin = (port: number) => `http://127.0.0.1:${port}`;
  const cwd = join(directory, framework);
  webServer.push({
    command: 'node server/index.ts', cwd, port: backendPort, reuseExistingServer: false,
    env: { PORT: String(backendPort), GHOSTLINK_ORIGIN: origin(frontendPort), GHOSTLINK_DATABASE: '.data/development.sqlite' },
  }, {
    command: `pnpm dev --port ${frontendPort}`, cwd, url: origin(frontendPort), reuseExistingServer: false,
    env: { GHOSTLINK_API_ORIGIN: origin(backendPort) },
  }, {
    command: 'pnpm start', cwd, url: origin(productionPort), reuseExistingServer: false,
    env: { PORT: String(productionPort), GHOSTLINK_ORIGIN: origin(productionPort), GHOSTLINK_DATABASE: '.data/production.sqlite' },
  });
  for (const [mode, port] of [['development', frontendPort], ['production', productionPort]] as const) {
    projects.push({ name: `${framework}-${mode}`, use: { ...devices['Desktop Chrome'], baseURL: origin(port) } });
  }
}

export default defineConfig({
  testDir: './tests/integration-guides', outputDir: './test-results/integration-guides',
  timeout: 30_000, expect: { timeout: 7000 }, workers: 1,
  use: { trace: 'retain-on-failure', screenshot: 'only-on-failure', reducedMotion: 'reduce' },
  projects, webServer,
});
