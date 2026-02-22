import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/__tests__/e2e/**/*.e2e.test.ts'],
    setupFiles: ['src/__tests__/e2e/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 15000,
    pool: 'forks',
  },
});
