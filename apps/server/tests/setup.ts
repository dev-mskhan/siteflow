// apps/server/tests/setup.ts
// Global Vitest setup file for server tests
import { shutdownTelemetry } from '@siteflow/observability/server';
import '@siteflow/observability/server/register';
import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Global setup logic (e.g. database connections, mocks, test env init)
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  await shutdownTelemetry();
});
