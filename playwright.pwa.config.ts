import { defineConfig, devices } from '@playwright/test';

/**
 * NFT-10 (FR-34): the production build is installable and opens offline. Builds in a dedicated mode
 * (`pwatest`), so it uses the emulator defaults, never the real project config in .env.production.local.
 */
export default defineConfig({
  testDir: 'tests/pwa',
  workers: 1,
  reporter: [['list'], ['json', { outputFile: 'test-results/pwa.json' }]],
  use: { ...devices['Pixel 7'], baseURL: 'http://127.0.0.1:4173' },
  webServer: {
    command: 'npx vite build --mode pwatest && npx vite preview --host 127.0.0.1 --port 4173 --strictPort',
    cwd: 'apps/web',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
