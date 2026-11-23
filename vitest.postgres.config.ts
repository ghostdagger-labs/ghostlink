import { defineConfig } from 'vitest/config';
import base from './vitest.config';

if (!process.env.GHOSTLINK_TEST_DATABASE_URL) {
  throw new Error('Set GHOSTLINK_TEST_DATABASE_URL to an isolated writable Postgres test database. Tests create and drop their own schemas.');
}
export default defineConfig({
  ...base,
  test: { include: ['tests/postgres/**/*.test.ts'], testTimeout: 20000, hookTimeout: 20000 },
});
