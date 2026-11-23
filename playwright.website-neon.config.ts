import { defineConfig, devices } from '@playwright/test';

const origin = process.env.WEBSITE_TEST_ORIGIN;
if (!origin && !process.env.GHOSTLINK_TEST_DATABASE_URL) throw new Error('Set GHOSTLINK_TEST_DATABASE_URL to an isolated Postgres test database.');
export default defineConfig({
  testDir: './tests/website',
  testMatch: origin ? 'neon.spec.ts' : ['demo.spec.ts', 'restoration.spec.ts', 'neon.spec.ts'],
  workers: 1, timeout: 45000, expect: { timeout: 10000 },
  outputDir: './test-results/website-neon',
  use: { ...devices['Desktop Chrome'], baseURL: origin ?? 'http://127.0.0.1:3311', reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: origin ? undefined : { command: 'node --import tsx tests/website/start-neon.ts', url: 'http://127.0.0.1:3311', reuseExistingServer: false, timeout: 30000 },
});
