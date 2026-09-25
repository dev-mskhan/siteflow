// apps/server/tests/integration/organization_profile.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { users, auditLogs } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { createAccessToken } from '../../src/modules/auth/token.service.js';
import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/shared/response.js';
import type { OrgProfileDTO } from '../../src/modules/organization/profile/profile.types.js';
import type { OrgDTO } from '../../src/modules/organization/organization.types.js';

describe('Organization Profile API (Integration)', () => {
  let app: FastifyInstance;
  let authToken: string;
  let userId: string;
  let createdOrgId: string;
  const runId = Math.random().toString(36).substring(7);
  const testEmail = `profile_owner_${runId}@example.com`;

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
      payload: { name: `Profile Test Org ${runId}` },
    });

    expect(orgRes.statusCode).toBe(201);
    createdOrgId = orgRes.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET returns empty profile for new org (all nullable fields are null)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/profile`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<{ profile: OrgProfileDTO }>>();
    expect(body.success).toBe(true);
    expect(body.data.profile.organizationId).toBe(createdOrgId);
    expect(body.data.profile.businessName).toBeNull();
    expect(body.data.profile.legalName).toBeNull();
    expect(body.data.profile.primaryEmail).toBeNull();
    expect(body.data.profile.primaryPhone).toBeNull();
    expect(body.data.profile.website).toBeNull();
    expect(body.data.profile.country).toBeNull();
  });

  it('PATCH profile with businessName and primaryEmail returns 200 with updated fields', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrgId}/profile`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        businessName: 'Acme',
        primaryEmail: 'info@acme.com',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<{ profile: OrgProfileDTO }>>();
    expect(body.success).toBe(true);
    expect(body.data.profile.businessName).toBe('Acme');
    expect(body.data.profile.primaryEmail).toBe('info@acme.com');
  });

  it('GET after PATCH returns the updated values', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/profile`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<{ profile: OrgProfileDTO }>>();
    expect(body.data.profile.businessName).toBe('Acme');
    expect(body.data.profile.primaryEmail).toBe('info@acme.com');
  });

  it('PATCH profile produces organization.profile_updated audit log entry', async () => {
    const db = getDb();
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, createdOrgId));

    const actions = logs.map((l) => l.action);
    expect(actions).toContain('organization.profile_updated');

    const profileLog = logs.find((l) => l.action === 'organization.profile_updated')!;
    expect(profileLog.actorUserId).toBe(userId);
    expect(profileLog.resourceType).toBe('OrganizationProfile');
  });

  it('unauthenticated GET returns 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/profile`,
    });

    expect(res.statusCode).toBe(401);
    const body = res.json<ApiErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('UNAUTHORIZED');
  });

  it('non-member user returns 403', async () => {
    const db = getDb();
    const nonMemberEmail = `nonmember_${runId}@example.com`;

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
      url: `/api/v1/organizations/${createdOrgId}/profile`,
      headers: { authorization: `Bearer ${nonMemberToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
