import { defineConfig, devices } from '@playwright/test';

/**
 * E2E against the emulator + seeded data. Run with `npm run test:e2e`, which starts the emulators,
 * seeds and then runs Playwright (which starts Vite).
 * NFR-07: a 360×640 mobile project; NFR-09: Firefox when installed (E2E_FIREFOX=1).
 */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 90_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }], ['json', { outputFile: 'test-results/e2e.json' }]],
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    permissions: ['geolocation'],
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: /mobile\.spec\.ts/ },
    { name: 'mobile-360', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 640 }, isMobile: true, hasTouch: true }, testMatch: /mobile\.spec\.ts/ },
    ...(process.env.E2E_FIREFOX ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'], permissions: [] as string[] }, testIgnore: /mobile\.spec\.ts/ }] : []),
  ],
  webServer: {
    command: 'npm run dev -w apps/web -- --host 127.0.0.1',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
