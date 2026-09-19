// apps/server/tests/integration/task1_organization_lifecycle.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { users, roles, organizationMemberships, auditLogs } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { createAccessToken } from '../../src/modules/auth/token.service.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { OrgDTO, OrgSettings } from '../../src/modules/organization/organization.types.js';

describe('Task 1: Organization Creation, Role Seeding & Settings Initialization', () => {
  let app: FastifyInstance;
  let authToken: string;
  let userId: string;
  let createdOrgId: string;
  const runId = Math.random().toString(36).substring(7);
  const testEmail = `owner_${runId}@example.com`;
  const testSlug = `apex-${runId}`;

  beforeAll(async () => {
    app = await createTestApp();
    const db = getDb();

    // Insert test user directly into DB
    const insertedUser = await db
      .insert(users)
      .values({
        email: testEmail,
        passwordHash: 'dummyhash',
        firstName: 'Owner',
        lastName: 'One',
        status: 'ACTIVE',
      })
      .returning();

    userId = insertedUser[0]!.id;
    authToken = createAccessToken({ sub: userId, email: testEmail, status: 'ACTIVE' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1.1 should create organization atomically and seed 7 system roles + admin membership', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Apex Construction',
        slug: testSlug,
        settings: {
          timezone: 'America/New_York',
          currency: 'USD',
        },
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
    expect(body.success).toBe(true);
    expect(body.data.organization.name).toBe('Apex Construction');
    expect(body.data.organization.slug).toBe(testSlug);
    expect(body.data.organization.settings.timezone).toBe('America/New_York');

    createdOrgId = body.data.organization.id;

    // Verify DB states directly
    const db = getDb();

    // Verify 7 system roles created for this org
    const orgRoles = await db.select().from(roles).where(eq(roles.organizationId, createdOrgId));
    expect(orgRoles.length).toBe(7);

    const roleNames = orgRoles.map((r) => r.name);
    expect(roleNames).toContain('Organization Admin');
    expect(roleNames).toContain('Project Manager');
    expect(roleNames).toContain('Finance');
    expect(roleNames).toContain('Procurement');
    expect(roleNames).toContain('Site Supervisor');
    expect(roleNames).toContain('Subcontractor');
    expect(roleNames).toContain('Client');

    // Verify creator membership created as Organization Admin
    const memberships = await db
      .select()
      .from(organizationMemberships)
      .where(eq(organizationMemberships.organizationId, createdOrgId));
    expect(memberships.length).toBe(1);
    expect(memberships[0]!.userId).toBe(userId);
    expect(memberships[0]!.status).toBe('ACTIVE');

    const adminRole = orgRoles.find((r) => r.name === 'Organization Admin')!;
    expect(memberships[0]!.roleId).toBe(adminRole.id);
  });

  it('1.2 should get organization details and update settings', async () => {
    // GET Org
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
    expect(getBody.data.organization.id).toBe(createdOrgId);

    // PATCH Settings
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrgId}/settings`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        currency: 'EUR',
        dateFormat: 'DD/MM/YYYY',
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = patchRes.json<ApiSuccessResponse<{ settings: OrgSettings }>>();
    expect(patchBody.data.settings.currency).toBe('EUR');
    expect(patchBody.data.settings.dateFormat).toBe('DD/MM/YYYY');
    expect(patchBody.data.settings.timezone).toBe('America/New_York');

    // Verify Audit Logs written for org creation & settings update
    const db = getDb();
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.organizationId, createdOrgId));
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('organization.created');
    expect(actions).toContain('settings.updated');
  });
});
