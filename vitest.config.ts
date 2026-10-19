import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      { test: { name: 'shared', include: ['packages/shared/test/**/*.test.ts'] } },
      {
        test: {
          name: 'rules',
          include: ['tests/rules/**/*.test.ts'],
          testTimeout: 20_000,
          fileParallelism: false,
        },
      },
      {
        test: {
          name: 'functions',
          include: ['functions/test/**/*.test.ts'],
          testTimeout: 30_000,
          hookTimeout: 60_000,
          fileParallelism: false,
        },
      },
    ],
    coverage: { provider: 'v8', include: ['packages/shared/src/**'], reporter: ['text', 'json-summary', 'html'], thresholds: { lines: 80, branches: 75 } },
  },
});
