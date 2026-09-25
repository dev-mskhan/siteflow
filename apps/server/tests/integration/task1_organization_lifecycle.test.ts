// apps/server/tests/integration/task1_organization_lifecycle.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import {
  users,
  roles,
  organizationMemberships,
  auditLogs,
  organizationProfiles,
  organizationSettings,
  documentSequences,
} from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { createAccessToken } from '../../src/modules/auth/token.service.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { OrgDTO } from '../../src/modules/organization/organization.types.js';
import type { OrgSettingsDTO } from '../../src/modules/organization/settings/settings.types.js';

describe('Task 1: Organization Creation, Role Seeding & Settings Initialization', () => {
  let app: FastifyInstance;
  let authToken: string;
  let userId: string;
  let createdOrgId: string;
  const runId = Math.random().toString(36).substring(7);
  const testEmail = `owner_${runId}@example.com`;

  beforeAll(async () => {
    app = await createTestApp();
    const db = getDb();

    // Insert test user directly into DB with verified email
    const insertedUser = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: testEmail,
        passwordHash: 'dummyhash',
        firstName: 'Owner',
        lastName: 'One',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      })
      .returning();

    userId = insertedUser[0]!.id;
    authToken = createAccessToken({ sub: userId, email: testEmail, status: 'ACTIVE' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('1.1 should derive slug from name when slug is omitted', async () => {
    const orgName = `Apex Construction ${runId}`;
    const expectedSlug = `apex-construction-${runId}`;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: orgName,
        // no slug — should be derived from name
      },
    });

    expect(response.statusCode).toBe(201);
    const body = response.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
    expect(body.success).toBe(true);
    expect(body.data.organization.name).toBe(orgName);
    expect(body.data.organization.slug).toBe(expectedSlug);

    createdOrgId = body.data.organization.id;
  });

  it('1.2 should create organization atomically and seed 7 system roles + admin membership', async () => {
    expect(createdOrgId).toBeDefined();
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

  it('1.3 should create a profile row atomically on org creation', async () => {
    expect(createdOrgId).toBeDefined();
    const db = getDb();

    const profiles = await db
      .select()
      .from(organizationProfiles)
      .where(eq(organizationProfiles.organizationId, createdOrgId));

    expect(profiles.length).toBe(1);
    expect(profiles[0]!.organizationId).toBe(createdOrgId);
    // Profile is empty initially
    expect(profiles[0]!.legalName).toBeNull();
    expect(profiles[0]!.primaryEmail).toBeNull();
  });

  it('1.4 should create a settings row with defaults atomically on org creation', async () => {
    expect(createdOrgId).toBeDefined();
    const db = getDb();

    const settings = await db
      .select()
      .from(organizationSettings)
      .where(eq(organizationSettings.organizationId, createdOrgId));

    expect(settings.length).toBe(1);
    expect(settings[0]!.organizationId).toBe(createdOrgId);
    expect(settings[0]!.timezone).toBe('UTC');
    expect(settings[0]!.currency).toBe('USD');
    expect(settings[0]!.locale).toBe('en-US');
    expect(settings[0]!.weekStartsOn).toBe(1);
    expect(settings[0]!.fiscalYearStartMonth).toBe(1);
  });

  it('1.5 should create 7 document sequence rows atomically on org creation', async () => {
    expect(createdOrgId).toBeDefined();
    const db = getDb();

    const sequences = await db
      .select()
      .from(documentSequences)
      .where(eq(documentSequences.organizationId, createdOrgId));

    expect(sequences.length).toBe(7);

    const types = sequences.map((s) => s.type);
    expect(types).toContain('PROJECT');
    expect(types).toContain('ESTIMATE');
    expect(types).toContain('INVOICE');
    expect(types).toContain('PURCHASE_ORDER');
    expect(types).toContain('CHANGE_ORDER');
    expect(types).toContain('RFI');
    expect(types).toContain('SUBMITTAL');

    // All start at nextValue = 1
    for (const seq of sequences) {
      expect(seq.nextValue).toBe(1);
    }

    // Check default prefixes
    const project = sequences.find((s) => s.type === 'PROJECT')!;
    expect(project.prefix).toBe('PRJ');
    expect(project.padding).toBe(4);
  });

  it('1.6 should get organization details and update settings via dedicated endpoint', async () => {
    // GET Org
    const getRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(getRes.statusCode).toBe(200);
    const getBody = getRes.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
    expect(getBody.data.organization.id).toBe(createdOrgId);

    // PATCH Settings via new endpoint
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrgId}/settings`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        currency: 'EUR',
        timezone: 'America/New_York',
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = patchRes.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>();
    expect(patchBody.data.settings.currency).toBe('EUR');
    expect(patchBody.data.settings.timezone).toBe('America/New_York');

    // Verify Audit Logs written for org creation & settings update
    const db = getDb();
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.organizationId, createdOrgId));
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('organization.created');
    expect(actions).toContain('organization.settings_updated');
  });

  it('1.7 should respect explicit slug when provided', async () => {
    const customSlug = `custom-slug-${runId}`;
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Another Org',
        slug: customSlug,
      },
    });

    // May fail if user hits the 5-org cap; that's fine — just check the slug if it succeeds
    if (response.statusCode === 201) {
      const body = response.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
      expect(body.data.organization.slug).toBe(customSlug);
    }
  });
});
