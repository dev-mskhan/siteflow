// apps/server/tests/helpers/test-app.ts
import { buildApp } from '../../src/app/index.js';
import type { FastifyInstance } from 'fastify';

/**
 * Creates and initialises a test Fastify instance.
 * Automatically handles app.ready() call.
 */
export async function createTestApp(): Promise<FastifyInstance> {
  const app = await buildApp();
  await app.ready();
  return app;
}
