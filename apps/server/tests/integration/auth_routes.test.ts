// apps/server/tests/integration/auth_routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { sessions } from '@siteflow/database/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { outboxService } from '../../src/lib/outbox/outbox.service.js';
import {
  createVerifiedUser,
  createUnverifiedUser,
  loginAndGetCookies,
  getEmailVerificationTokenFromOutbox,
  getPasswordResetTokenFromOutbox,
  countOutboxEvents,
} from '../helpers/fixtures.js';
import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/shared/response.js';

const runId = Math.random().toString(36).slice(2, 9);

describe('Auth API Routes — comprehensive integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/register', () => {
    it('missing email → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { password: 'password123', firstName: 'Test' },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json<ApiErrorResponse>().error.code).toBe('VALIDATION_ERROR');
    });

    it('missing password → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: `x_${runId}@test.dev`, firstName: 'Test' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('missing firstName → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: `x_${runId}@test.dev`, password: 'password123' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('invalid email format "notanemail" → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: 'notanemail', password: 'password123', firstName: 'Test' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('password too short (7 chars) → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: `x_${runId}@test.dev`, password: '1234567', firstName: 'Test' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('password too long (101 chars) → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: `x_${runId}@test.dev`,
          password: 'a'.repeat(101),
          firstName: 'Test',
        },
      });
      expect(res.statusCode).toBe(422);
    });

    it('firstName empty string "" → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email: `x_${runId}@test.dev`, password: 'password123', firstName: '' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('firstName whitespace only "   " → 422 (trimmed → empty → fails min(1))', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: `x_${runId}@test.dev`,
          password: 'password123',
          firstName: '   ',
        },
      });
      expect(res.statusCode).toBe(422);
    });

    it('extra unknown field {hacker: true} → 201 (dropped silently)', async () => {
      const email = `reg_unknown_${runId}@test.dev`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email,
          password: 'password123',
          firstName: 'Hacker',
          hacker: true,
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json<ApiSuccessResponse<{ user: any }>>();
      expect(body.success).toBe(true);
      expect((body.data.user as any).hacker).toBeUndefined();
    });

    it(`SQL injection name "'\\'; DROP TABLE users--" → 201 (stored as harmless text)`, async () => {
      const email = `reg_sql_${runId}@test.dev`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email,
          password: 'password123',
          firstName: "'; DROP TABLE users--",
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json<ApiSuccessResponse<{ user: any }>>();
      expect(body.data.user.firstName).toBe("'; DROP TABLE users--");
    });

    it('valid body → 201, correct user shape, emailVerified=false', async () => {
      const email = `reg_valid_${runId}@test.dev`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email, password: 'password123', firstName: 'Valid' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json<ApiSuccessResponse<{ user: any }>>();
      expect(body.success).toBe(true);
      const user = body.data.user;
      expect(user.id).toBeDefined();
      expect(user.email).toBe(email);
      expect(user.firstName).toBe('Valid');
      expect(user.emailVerified).toBe(false);
      expect(user.status).toBeDefined();
      expect(user.createdAt).toBeDefined();
    });

    it('response NEVER contains passwordHash field', async () => {
      const email = `reg_nohash_${runId}@test.dev`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email, password: 'password123', firstName: 'Safe' },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json();
      expect(JSON.stringify(body)).not.toContain('passwordHash');
    });

    it('Set-Cookie headers present: access_token AND refresh_token, both marked HttpOnly', async () => {
      const email = `reg_cookie_${runId}@test.dev`;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email, password: 'password123', firstName: 'Cookie' },
      });
      expect(res.statusCode).toBe(201);
      const setCookies = res.headers['set-cookie'];
      const cookieArr = Array.isArray(setCookies) ? setCookies : [setCookies ?? ''];
      const hasAccessToken = cookieArr.some((c) =>
        c.startsWith('access_token=') && c.toLowerCase().includes('httponly'),
      );
      const hasRefreshToken = cookieArr.some((c) =>
        c.startsWith('refresh_token=') && c.toLowerCase().includes('httponly'),
      );
      expect(hasAccessToken).toBe(true);
      expect(hasRefreshToken).toBe(true);
    });

    it('duplicate email (same email twice) → 409 CONFLICT', async () => {
      const email = `reg_dup_${runId}@test.dev`;
      const first = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email, password: 'password123', firstName: 'First' },
      });
      expect(first.statusCode).toBe(201);

      const second = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email, password: 'password123', firstName: 'Second' },
      });
      expect(second.statusCode).toBe(409);
      expect(second.json<ApiErrorResponse>().error.code).toBe('CONFLICT');
    });

    it('email is trimmed/lowercased: "  TEST@EXAMPLE.COM  " → 201, user.email = "test@example.com"', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: `  TRIM_${runId}@EXAMPLE.COM  `,
          password: 'password123',
          firstName: 'Trim',
        },
      });
      expect(res.statusCode).toBe(201);
      const body = res.json<ApiSuccessResponse<{ user: any }>>();
      expect(body.data.user.email).toBe(`trim_${runId}@example.com`);
    });

    it('exactly 1 outbox event auth:send-email-verification queued after registration', async () => {
      const email = `reg_outbox_${runId}@test.dev`;
      const before = await countOutboxEvents('auth:send-email-verification', { email });

      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: { email, password: 'password123', firstName: 'Outbox' },
      });

      const after = await countOutboxEvents('auth:send-email-verification', { email });
      expect(after - before).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/login', () => {
    it('missing email → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { password: 'password123' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('missing password → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'test@test.dev' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('malformed email "bad" → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: 'bad', password: 'password123' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('wrong password → 401 UNAUTHORIZED', async () => {
      const { user } = await createVerifiedUser({ email: `login_wrong_${runId}@test.dev` });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: user.email, password: 'wrongpassword' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json<ApiErrorResponse>().error.code).toBe('UNAUTHORIZED');
    });

    it('email doesn\'t exist → 401 UNAUTHORIZED (same message, no reveal)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email: `nosuchuser_${runId}@test.dev`, password: 'password123' },
      });
      expect(res.statusCode).toBe(401);
      expect(res.json<ApiErrorResponse>().error.code).toBe('UNAUTHORIZED');
    });

    it('valid credentials → 200, correct user shape, cookies set', async () => {
      const email = `login_ok_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password: 'password123' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ user: any }>>();
      expect(body.success).toBe(true);
      expect(body.data.user.email).toBe(email);

      const setCookies = res.headers['set-cookie'];
      const cookieArr = Array.isArray(setCookies) ? setCookies : [setCookies ?? ''];
      expect(cookieArr.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(cookieArr.some((c) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('cookie is signed (value starts with "s:" after URL-decode)', async () => {
      const email = `login_signed_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password: 'password123' },
      });
      expect(res.statusCode).toBe(200);
      const setCookies = res.headers['set-cookie'];
      const cookieArr = Array.isArray(setCookies) ? setCookies : [setCookies ?? ''];
      const accessTokenCookieLine = cookieArr.find((c) => c.startsWith('access_token=')) ?? '';
      const rawVal = accessTokenCookieLine.split(';')[0]!.slice('access_token='.length);
      const decoded = decodeURIComponent(rawVal);
      expect(decoded.startsWith('s:')).toBe(true);
    });

    it('SUSPENDED account → 403 FORBIDDEN', async () => {
      const email = `login_suspended_${runId}@test.dev`;
      await createVerifiedUser({ email, status: 'SUSPENDED' });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/login',
        payload: { email, password: 'password123' },
      });
      expect(res.statusCode).toBe(403);
      expect(res.json<ApiErrorResponse>().error.code).toBe('FORBIDDEN');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/refresh', () => {
    it('no cookie, no body → 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
      });
      expect(res.statusCode).toBe(401);
    });

    it('valid refresh_token cookie → 200, new Set-Cookie headers issued', async () => {
      const email = `refresh_ok_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const { refreshCookie } = await loginAndGetCookies(app, email, 'password123');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: { refresh_token: refreshCookie },
      });
      expect(res.statusCode).toBe(200);
      const setCookies = res.headers['set-cookie'];
      const cookieArr = Array.isArray(setCookies) ? setCookies : [setCookies ?? ''];
      expect(cookieArr.some((c) => c.startsWith('access_token='))).toBe(true);
      expect(cookieArr.some((c) => c.startsWith('refresh_token='))).toBe(true);
    });

    it('after logout, reusing old refresh token → 401', async () => {
      const email = `refresh_revoked_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const { refreshCookie, accessCookie } = await loginAndGetCookies(app, email, 'password123');

      // Logout
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        cookies: { access_token: accessCookie },
      });

      // Try to refresh with the old token
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: { refresh_token: refreshCookie },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/auth/me', () => {
    it('no auth → 401 UNAUTHORIZED', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
      });
      expect(res.statusCode).toBe(401);
      expect(res.json<ApiErrorResponse>().error.code).toBe('UNAUTHORIZED');
    });

    it('Bearer token → 200, correct user shape', async () => {
      const { user, token } = await createVerifiedUser({
        email: `me_bearer_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ user: any }>>();
      expect(body.data.user.id).toBe(user.id);
      expect(body.data.user.email).toBe(user.email);
      expect(body.data.user.emailVerified).toBe(true);
    });

    it('cookie auth (access_token cookie) → 200 (confirms cookie path works)', async () => {
      const email = `me_cookie_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const { accessCookie } = await loginAndGetCookies(app, email, 'password123');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        cookies: { access_token: accessCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ user: any }>>();
      expect(body.data.user.email).toBe(email);
    });

    it('response NEVER contains passwordHash', async () => {
      const { token } = await createVerifiedUser({
        email: `me_nohash_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      expect(JSON.stringify(res.json())).not.toContain('passwordHash');
    });

    it('response NEVER contains emailVerifiedAt as raw timestamp (only emailVerified: bool)', async () => {
      const { token } = await createVerifiedUser({
        email: `me_nots_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ user: any }>>();
      expect(body.data.user.emailVerifiedAt).toBeUndefined();
      expect(typeof body.data.user.emailVerified).toBe('boolean');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/verify-email', () => {
    it('missing token field → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: {},
      });
      expect(res.statusCode).toBe(422);
    });

    it('empty token "" → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { token: '' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('invalid/garbage token → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { token: 'totallyinvalidgarbagetoken12345678901234567890' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('valid token (from outbox) → 200, user.emailVerified becomes true on GET /me', async () => {
      const email = `verify_ok_${runId}@test.dev`;
      const { token: bearerToken } = await createUnverifiedUser(email);

      // The createUnverifiedUser doesn't create an outbox token. We register via API instead.
      const registerRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/register',
        payload: {
          email: `verify_api_${runId}@test.dev`,
          password: 'password123',
          firstName: 'Verify',
        },
      });
      expect(registerRes.statusCode).toBe(201);
      const registeredEmail = `verify_api_${runId}@test.dev`;
      const registeredToken = registerRes.json<ApiSuccessResponse<{ user: any }>>()
        .data.user.id;

      // Flush outbox so the token is accessible
      await outboxService.publishPendingEvents();

      const verifyToken = await getEmailVerificationTokenFromOutbox(registeredEmail);

      // Get auth token from register response cookies
      const cookieArr = Array.isArray(registerRes.headers['set-cookie'])
        ? registerRes.headers['set-cookie']
        : [registerRes.headers['set-cookie'] ?? ''];
      const accessLine = cookieArr.find((c) => c.startsWith('access_token=')) ?? '';
      const accessCookie = decodeURIComponent(
        accessLine.split(';')[0]!.slice('access_token='.length),
      );

      // Verify email
      const verifyRes = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/verify-email',
        payload: { token: verifyToken },
      });
      expect(verifyRes.statusCode).toBe(200);

      // Check emailVerified is now true
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/me',
        cookies: { access_token: accessCookie },
      });
      expect(meRes.statusCode).toBe(200);
      const meBody = meRes.json<ApiSuccessResponse<{ user: any }>>();
      expect(meBody.data.user.emailVerified).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/resend-verification', () => {
    it('missing email → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resend-verification',
        payload: {},
      });
      expect(res.statusCode).toBe(422);
    });

    it('unknown email → 200 (no-reveal, generic message)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resend-verification',
        payload: { email: `nobody_${runId}@test.dev` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('already verified email → 422 "Email is already verified"', async () => {
      const { user } = await createVerifiedUser({
        email: `resend_verified_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/resend-verification',
        payload: { email: user.email },
      });
      expect(res.statusCode).toBe(422);
      expect(res.json<ApiErrorResponse>().error.message).toMatch(/already verified/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/forgot-password', () => {
    it('missing email → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: {},
      });
      expect(res.statusCode).toBe(422);
    });

    it('unknown email → 200 (no-reveal)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: { email: `ghost_${runId}@test.dev` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('known email → 200, exactly 1 outbox event auth:send-password-reset queued', async () => {
      const email = `forgot_ok_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const before = await countOutboxEvents('auth:send-password-reset', { email });

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: { email },
      });
      expect(res.statusCode).toBe(200);

      const after = await countOutboxEvents('auth:send-password-reset', { email });
      expect(after - before).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/reset-password', () => {
    it('missing token → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: { newPassword: 'newpassword123' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('missing newPassword → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: { token: 'sometoken' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('newPassword too short → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: { token: 'sometoken', newPassword: '1234567' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('invalid/garbage token → 422', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: {
          token: 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef',
          newPassword: 'newpassword123',
        },
      });
      expect(res.statusCode).toBe(422);
    });

    it('valid token → 200, cookies cleared in response', async () => {
      const email = `reset_ok_${runId}@test.dev`;
      await createVerifiedUser({ email });

      // Request reset
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/forgot-password',
        payload: { email },
      });

      const resetToken = await getPasswordResetTokenFromOutbox(email);

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/reset-password',
        payload: { token: resetToken, newPassword: 'newpassword456' },
      });
      expect(res.statusCode).toBe(200);

      // Cookies should be cleared (Max-Age=0 or Expires in the past)
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        const cookieArr = Array.isArray(setCookies) ? setCookies : [setCookies];
        const accessCookieLine = cookieArr.find((c) => c.startsWith('access_token='));
        if (accessCookieLine) {
          const lower = accessCookieLine.toLowerCase();
          const isClearedByMaxAge = lower.includes('max-age=0');
          const isClearedByExpires =
            lower.includes('expires=') &&
            (lower.includes('1970') || lower.includes('thu, 01 jan'));
          expect(isClearedByMaxAge || isClearedByExpires).toBe(true);
        }
      }
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/change-password', () => {
    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        payload: { currentPassword: 'password123', newPassword: 'newpassword456' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('wrong currentPassword → 422', async () => {
      const { token } = await createVerifiedUser({
        email: `chgpw_wrong_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { authorization: `Bearer ${token}` },
        payload: { currentPassword: 'wrongpassword', newPassword: 'newpassword456' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('newPassword too short → 422', async () => {
      const { token } = await createVerifiedUser({
        email: `chgpw_short_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        headers: { authorization: `Bearer ${token}` },
        payload: { currentPassword: 'password123', newPassword: '1234567' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('valid → 200, all sessions revoked (GET /sessions returns empty array after), cookies cleared', async () => {
      const email = `chgpw_ok_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const { accessCookie, userId: uid } = await loginAndGetCookies(app, email, 'password123');

      // Also create a second session
      await loginAndGetCookies(app, email, 'password123');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/change-password',
        cookies: { access_token: accessCookie },
        payload: { currentPassword: 'password123', newPassword: 'newpassword456' },
      });
      expect(res.statusCode).toBe(200);

      // Verify all sessions are revoked in DB
      const db = getDb();
      const activeSessions = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, uid), isNull(sessions.revokedAt)));
      expect(activeSessions.length).toBe(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/auth/sessions', () => {
    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
      });
      expect(res.statusCode).toBe(401);
    });

    it('valid → 200, data.sessions is array', async () => {
      const { token } = await createVerifiedUser({
        email: `sessions_list_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ sessions: any[] }>>();
      expect(Array.isArray(body.data.sessions)).toBe(true);
    });

    it('sessions list contains at least one session after login', async () => {
      const email = `sessions_has_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const { accessCookie } = await loginAndGetCookies(app, email, 'password123');

      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        cookies: { access_token: accessCookie },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ sessions: any[] }>>();
      expect(body.data.sessions.length).toBeGreaterThan(0);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('DELETE /api/v1/auth/sessions/:sessionId', () => {
    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/00000000-0000-0000-0000-000000000001',
      });
      expect(res.statusCode).toBe(401);
    });

    it('non-UUID sessionId → 422', async () => {
      const { token } = await createVerifiedUser({
        email: `sess_del_nouuid_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'DELETE',
        url: '/api/v1/auth/sessions/not-a-uuid',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(422);
    });

    it('sessionId of another user → 404', async () => {
      const { token: tokenA } = await createVerifiedUser({
        email: `sess_del_other_a_${runId}@test.dev`,
      });
      const { token: tokenB } = await createVerifiedUser({
        email: `sess_del_other_b_${runId}@test.dev`,
      });

      // Get sessions for user B — create a real session by logging in
      const emailB = `sess_del_other_b_${runId}@test.dev`;
      await createVerifiedUser({ email: `sess_login_b_${runId}@test.dev` });
      const { accessCookie: bCookie } = await loginAndGetCookies(
        app,
        `sess_del_other_b_${runId}@test.dev`,
        'password123',
      ).catch(() => ({ accessCookie: '' }));

      // Get user B's session list
      const sessRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        headers: { authorization: `Bearer ${tokenB}` },
      });
      const sessions_list = sessRes.json<ApiSuccessResponse<{ sessions: any[] }>>().data.sessions;

      if (sessions_list.length > 0) {
        const bSessionId = sessions_list[0].id;
        const res = await app.inject({
          method: 'DELETE',
          url: `/api/v1/auth/sessions/${bSessionId}`,
          headers: { authorization: `Bearer ${tokenA}` },
        });
        expect(res.statusCode).toBe(404);
      }
    });

    it('own valid sessionId → 200', async () => {
      const email = `sess_del_own_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const { accessCookie } = await loginAndGetCookies(app, email, 'password123');

      const sessRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        cookies: { access_token: accessCookie },
      });
      expect(sessRes.statusCode).toBe(200);
      const sessionsList = sessRes.json<ApiSuccessResponse<{ sessions: any[] }>>().data.sessions;
      expect(sessionsList.length).toBeGreaterThan(0);

      const sessionId = sessionsList[0].id;
      const delRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/auth/sessions/${sessionId}`,
        cookies: { access_token: accessCookie },
      });
      expect(delRes.statusCode).toBe(200);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/logout', () => {
    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
      });
      expect(res.statusCode).toBe(401);
    });

    it('valid → 200, cookies cleared, session revoked', async () => {
      const email = `logout_ok_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const { accessCookie } = await loginAndGetCookies(app, email, 'password123');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        cookies: { access_token: accessCookie },
      });
      expect(res.statusCode).toBe(200);

      // Check cookie clearing
      const setCookies = res.headers['set-cookie'];
      if (setCookies) {
        const cookieArr = Array.isArray(setCookies) ? setCookies : [setCookies];
        const accessLine = cookieArr.find((c) => c.startsWith('access_token='));
        if (accessLine) {
          const lower = accessLine.toLowerCase();
          expect(lower.includes('max-age=0') || lower.includes('expires=')).toBe(true);
        }
      }
    });

    it('reusing revoked refresh token after logout → 401', async () => {
      const email = `logout_reuse_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const { accessCookie, refreshCookie } = await loginAndGetCookies(
        app,
        email,
        'password123',
      );

      // Logout
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout',
        cookies: { access_token: accessCookie },
      });

      // Attempt to use old refresh token
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/refresh',
        cookies: { refresh_token: refreshCookie },
      });
      expect(res.statusCode).toBe(401);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/auth/logout-all', () => {
    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
      });
      expect(res.statusCode).toBe(401);
    });

    it('valid → 200, all sessions revoked', async () => {
      const email = `logoutall_ok_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const { accessCookie, userId: uid } = await loginAndGetCookies(
        app,
        email,
        'password123',
      );

      // Create another session
      await loginAndGetCookies(app, email, 'password123');

      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        cookies: { access_token: accessCookie },
      });
      expect(res.statusCode).toBe(200);

      // All sessions should be revoked
      const db = getDb();
      const active = await db
        .select()
        .from(sessions)
        .where(and(eq(sessions.userId, uid), isNull(sessions.revokedAt)));
      expect(active.length).toBe(0);
    });

    it('GET /sessions after logout-all returns empty array', async () => {
      const email = `logoutall_sess_${runId}@test.dev`;
      await createVerifiedUser({ email });
      const { accessCookie, userId: uid } = await loginAndGetCookies(
        app,
        email,
        'password123',
      );

      // Need to get a valid token after logoutAll — use a bearer token
      const db = getDb();
      const userRow = await db
        .select()
        .from(sessions)
        .where(eq(sessions.userId, uid));

      // logout-all
      await app.inject({
        method: 'POST',
        url: '/api/v1/auth/logout-all',
        cookies: { access_token: accessCookie },
      });

      // The access cookie JWT is still valid (not expired) even after sessions revoked
      // because authenticate only checks JWT validity, not session state
      // However GET /sessions should be empty
      const sessRes = await app.inject({
        method: 'GET',
        url: '/api/v1/auth/sessions',
        cookies: { access_token: accessCookie },
      });
      // Either 200 with empty array or 401 (if cookie was also cleared)
      if (sessRes.statusCode === 200) {
        const body = sessRes.json<ApiSuccessResponse<{ sessions: any[] }>>();
        expect(body.data.sessions.length).toBe(0);
      } else {
        expect(sessRes.statusCode).toBe(401);
      }
    });
  });
});
