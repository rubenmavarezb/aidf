// packages/cli/src/__tests__/e2e/setup.ts

import { tmpdir } from 'os';
import { join } from 'path';
import { afterAll } from 'vitest';
import { cleanupAllTempDirs } from './helpers/index.js';

const TEMP_PREFIX = 'aidf-e2e-';

// Set env var for E2E tests
process.env.TEST_TMPDIR = join(tmpdir(), TEMP_PREFIX);

// Git env vars to avoid depending on global config
process.env.GIT_AUTHOR_NAME = 'AIDF E2E Test';
process.env.GIT_AUTHOR_EMAIL = 'e2e-test@aidf.dev';
process.env.GIT_COMMITTER_NAME = 'AIDF E2E Test';
process.env.GIT_COMMITTER_EMAIL = 'e2e-test@aidf.dev';

/**
 * Cleanup tracked dirs from this process only.
 * We do NOT sweep all aidf-e2e-* from tmpdir because other
 * forks may still be running their tests.
 */
afterAll(async () => {
  await cleanupAllTempDirs();
});
