// apps/server/tests/setup.ts
// Global Vitest setup file for server tests
import { beforeAll, afterAll } from 'vitest';

beforeAll(async () => {
  // Global setup logic (e.g. database connections, mocks, test env init)
  process.env.NODE_ENV = 'test';
});

afterAll(async () => {
  // Global cleanup logic
});
