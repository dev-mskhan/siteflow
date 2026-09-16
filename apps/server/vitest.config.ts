import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    // Include both co-located tests in src/ and tests in tests/
    include: ['src/**/*.{test,spec}.ts', 'tests/**/*.{test,spec}.ts'],
    exclude: ['src/**/*.e2e.ts', 'tests/**/*.e2e.ts', 'node_modules', 'dist'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.{test,spec}.ts', 'src/index.ts', 'src/worker.ts'],
    },
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true },
    },
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgres://siteflow:siteflow@localhost:5433/siteflow',
      REDIS_URL: 'redis://localhost:6379',
      MINIO_ENDPOINT: 'localhost',
      MINIO_PORT: '9000',
      MINIO_ACCESS_KEY: 'minioadmin',
      MINIO_SECRET_KEY: 'minioadmin',
      OTEL_EXPORTER_OTLP_ENDPOINT: 'http://localhost:4318',
    },
  },
});
