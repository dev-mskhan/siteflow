import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { registerErrorHandlers } from '../../src/middleware/error-handler.js';

describe('API error responses', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = Fastify();
    registerErrorHandlers(app);
    app.get('/test/unexpected-error', async () => {
      throw new Error('insert violates secret_constraint');
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('does not expose unexpected exception details to clients', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/test/unexpected-error',
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).not.toContain('secret_constraint');
    expect(response.body).not.toContain('Error:');
    expect(response.json().error.message).toBe('Internal server error');
    expect(response.json().error.details).toBeUndefined();
  });
});
