// apps/server/tests/integration/tenant-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import type { ApiErrorResponse } from '../../src/shared/response.js';

describe('Tenant Isolation (Integration)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/v1/organizations/:organizationId', () => {
    it('should return 401 Unauthorized when requesting organization without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/00000000-0000-0000-0000-000000000000',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ApiErrorResponse>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v1/organizations/:organizationId/members', () => {
    it('should return 401 Unauthorized when accessing org members without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/00000000-0000-0000-0000-000000000000/members',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ApiErrorResponse>();
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/v1/organizations/:organizationId/audit-logs', () => {
    it('should return 401 Unauthorized when accessing audit logs without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/00000000-0000-0000-0000-000000000000/audit-logs',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ApiErrorResponse>();
      expect(body.success).toBe(false);
    });
  });
});
