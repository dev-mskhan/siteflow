import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'tests/unit/ai/cost-financial-chatopenai.contract.test.ts',
      'tests/unit/ai/model-factory.spec.ts',
    ],
    globalSetup: [],
    setupFiles: [],
    testTimeout: 60_000,
    hookTimeout: 30_000,
    pool: 'forks',
    poolOptions: { forks: { singleFork: true } },
  },
});
