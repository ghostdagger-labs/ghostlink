import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/website', workers: 1, timeout: 45_000,
  expect: { timeout: 10_000 },
  use: { baseURL: process.env.WEBSITE_TEST_ORIGIN ?? 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure', reducedMotion: 'reduce' },
  projects: [{ name: 'website-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1000 } } }],
  webServer: process.env.WEBSITE_TEST_ORIGIN ? undefined : { command: 'pnpm dev:website', url: 'http://127.0.0.1:3000', reuseExistingServer: !process.env.CI, timeout: 120_000, env: { GHOSTLINK_ORIGIN: 'http://127.0.0.1:3000', GHOSTLINK_DATABASE: '.data/website-tests.sqlite' } },
});
