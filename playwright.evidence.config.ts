import { defineConfig, devices } from '@playwright/test';

/** Screenshot capture for the report (tests/evidence). Reuses a running `npm run dev`, or starts Vite itself under emulators:exec. */
export default defineConfig({
  testDir: 'tests/evidence',
  workers: 1,
  reporter: 'list',
  use: { ...devices['Desktop Chrome'], baseURL: 'http://127.0.0.1:5173' },
  webServer: { command: 'npm run dev -w apps/web -- --host 127.0.0.1', url: 'http://127.0.0.1:5173', reuseExistingServer: true, timeout: 120_000 },
});
