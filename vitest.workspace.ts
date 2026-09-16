import { defineWorkspace } from 'vitest/config';

/**
 * Root vitest workspace — aggregates all packages that have unit tests.
 * Run from the repo root: pnpm vitest
 */
export default defineWorkspace([
  'apps/server/vitest.config.ts',
  // Add more when packages have tests:
  // 'packages/shared/vitest.config.ts',
  // 'packages/database/vitest.config.ts',
]);
