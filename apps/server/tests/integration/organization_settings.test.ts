// apps/server/tests/integration/organization_settings.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { users, auditLogs } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { createAccessToken } from '../../src/modules/auth/token.service.js';
import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/shared/response.js';
import type { OrgSettingsDTO } from '../../src/modules/organization/settings/settings.types.js';
import type { OrgDTO } from '../../src/modules/organization/organization.types.js';

describe('Organization Settings API (Integration)', () => {
  let app: FastifyInstance;
  let authToken: string;
  let userId: string;
  let createdOrgId: string;
  const runId = Math.random().toString(36).substring(7);
  const testEmail = `settings_owner_${runId}@example.com`;

  beforeAll(async () => {
    app = await createTestApp();
    const db = getDb();

    // Insert test user with verified email
    const insertedUser = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: testEmail,
        passwordHash: 'dummyhash',
        firstName: 'Test',
        lastName: 'User',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      })
      .returning();

    userId = insertedUser[0]!.id;
    authToken = createAccessToken({ sub: userId, email: testEmail, status: 'ACTIVE' });

    // Create an org via the API (also creates profile, settings, sequences atomically)
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: `Settings Test Org ${runId}` },
    });

    expect(orgRes.statusCode).toBe(201);
    createdOrgId = orgRes.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET returns defaults for new org (timezone UTC, currency USD, weekStartsOn 1)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/settings`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>();
    expect(body.success).toBe(true);
    expect(body.data.settings.organizationId).toBe(createdOrgId);
    expect(body.data.settings.timezone).toBe('UTC');
    expect(body.data.settings.currency).toBe('USD');
    expect(body.data.settings.weekStartsOn).toBe(1);
  });

  it('PATCH with valid currency and timezone returns 200 with updated values', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrgId}/settings`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        currency: 'EUR',
        timezone: 'America/New_York',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>();
    expect(body.success).toBe(true);
    expect(body.data.settings.currency).toBe('EUR');
    expect(body.data.settings.timezone).toBe('America/New_York');
  });

  it('PATCH with invalid IANA timezone returns 422', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrgId}/settings`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { timezone: 'Not/ATimezone' },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json<ApiErrorResponse>();
    expect(body.success).toBe(false);
  });

  it('PATCH with invalid currency (not 3 uppercase letters) returns 422', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrgId}/settings`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { currency: 'eu' },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json<ApiErrorResponse>();
    expect(body.success).toBe(false);
  });

  it('PATCH with weekStartsOn: 7 returns 422', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrgId}/settings`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { weekStartsOn: 7 },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json<ApiErrorResponse>();
    expect(body.success).toBe(false);
  });

  it('PATCH with weekStartsOn: 0 (Sunday) returns 200', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrgId}/settings`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { weekStartsOn: 0 },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>();
    expect(body.data.settings.weekStartsOn).toBe(0);
  });

  it('organization.settings_updated audit log entry written after successful PATCH', async () => {
    const db = getDb();
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, createdOrgId));

    const actions = logs.map((l) => l.action);
    expect(actions).toContain('organization.settings_updated');

    const settingsLog = logs.find((l) => l.action === 'organization.settings_updated')!;
    expect(settingsLog.actorUserId).toBe(userId);
  });

  it('non-member user returns 403', async () => {
    const db = getDb();
    const nonMemberEmail = `nonmember_settings_${runId}@example.com`;

    const nonMember = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: nonMemberEmail,
        passwordHash: 'dummyhash',
        firstName: 'Non',
        lastName: 'Member',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      })
      .returning();

    const nonMemberToken = createAccessToken({
      sub: nonMember[0]!.id,
      email: nonMemberEmail,
      status: 'ACTIVE',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/settings`,
      headers: { authorization: `Bearer ${nonMemberToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
