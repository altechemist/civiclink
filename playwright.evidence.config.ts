import { defineConfig, devices } from '@playwright/test';

/** Screenshot capture for the report (tests/evidence). Requires a running `npm run dev`. */
export default defineConfig({
  testDir: 'tests/evidence',
  workers: 1,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173' },
});
