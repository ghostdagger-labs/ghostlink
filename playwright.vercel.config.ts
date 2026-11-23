import { defineConfig, devices } from '@playwright/test';

if (!process.env.GHOSTLINK_TEST_DATABASE_URL) throw new Error('Set GHOSTLINK_TEST_DATABASE_URL to an isolated Postgres test database.');
export default defineConfig({
  testDir: './tests/vercel', testMatch: '**/*.spec.ts', workers: 1,
  timeout: 30000, expect: { timeout: 7000 },
  outputDir: './test-results/vercel',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://localhost:3200', reducedMotion: 'reduce', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: { command: 'node --import tsx tests/vercel/start.ts', url: 'http://localhost:3200', reuseExistingServer: false, timeout: 30000 },
});
