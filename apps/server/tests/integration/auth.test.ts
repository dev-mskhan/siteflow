// apps/server/tests/integration/auth.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import type { ApiErrorResponse, ApiSuccessResponse } from '../../src/shared/response.js';

describe('Auth API Routes (Integration)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /api/v1/auth/register', () => {
    it('should return 400/422 validation error for missing required fields', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: 'invalid-email',
          password: 'short',
        },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      const body = response.json<ApiErrorResponse>();
      expect(body.success).toBe(false);
      expect(body.error).toBeDefined();
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('should return validation error for missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBeGreaterThanOrEqual(400);
      const body = response.json<ApiErrorResponse>();
      expect(body.success).toBe(false);
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('should return 401 Unauthorized when no cookie or Bearer token is provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ApiErrorResponse>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
      expect(body.error.message).toContain('Authentication token missing');
    });
  });

  describe('GET /api/v1/auth/sessions', () => {
    it('should return 401 Unauthorized when unauthenticated', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
      });

      expect(response.statusCode).toBe(401);
      const body = response.json<ApiErrorResponse>();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });
});
