// apps/server/tests/integration/tenant-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { users, roles, organizations } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { createAccessToken } from '../../src/modules/auth/token.service.js';
import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/shared/response.js';
import type { OrgDTO } from '../../src/modules/organization/organization.types.js';

describe('Tenant Isolation & Cross-Tenant Security Audit (Integration)', () => {
  let app: FastifyInstance;
  let userAToken: string;
  let userBToken: string;
  let orgAId: string;
  let orgBId: string;
  let orgBRoleId: string;

  const runId = Math.random().toString(36).substring(7);
  const emailA = `usera_sec_${runId}@example.com`;
  const emailB = `userb_sec_${runId}@example.com`;

  beforeAll(async () => {
    app = await createTestApp();
    const db = getDb();

    // Setup User A (Org A Admin)
    const userA = await db
      .insert(users)
      .values({ email: emailA, passwordHash: 'dummy', firstName: 'UserA', status: 'ACTIVE' })
      .returning();
    userAToken = createAccessToken({ sub: userA[0]!.id, email: emailA, status: 'ACTIVE' });

    const orgARes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userAToken}` },
      payload: { name: 'Org A Security', slug: `org-a-sec-${runId}` },
    });
    orgAId = orgARes.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;

    // Setup User B (Org B Admin)
    const userB = await db
      .insert(users)
      .values({ email: emailB, passwordHash: 'dummy', firstName: 'UserB', status: 'ACTIVE' })
      .returning();
    userBToken = createAccessToken({ sub: userB[0]!.id, email: emailB, status: 'ACTIVE' });

    const orgBRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userBToken}` },
      payload: { name: 'Org B Security', slug: `org-b-sec-${runId}` },
    });
    orgBId = orgBRes.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;

    // Get a role from Org B
    const orgBRoles = await db.select().from(roles).where(eq(roles.organizationId, orgBId));
    orgBRoleId = orgBRoles[0]!.id;
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  describe('Authentication Requirements', () => {
    it('should return 401 Unauthorized when requesting organization without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/00000000-0000-0000-0000-000000000000',
      });
      expect(response.statusCode).toBe(401);
    });

    it('should return 401 Unauthorized when accessing audit logs without authentication', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/00000000-0000-0000-0000-000000000000/audit-logs',
      });
      expect(response.statusCode).toBe(401);
    });
  });

  describe('Cross-Tenant Data Isolation (Negative Tests)', () => {
    it('should deny User A (Org A) from reading Org B organization details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgBId}`,
        headers: { authorization: `Bearer ${userAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should deny User A (Org A) from reading Org B members list', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgBId}/members`,
        headers: { authorization: `Bearer ${userAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should deny User A (Org A) from reading Org B audit logs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgBId}/audit-logs`,
        headers: { authorization: `Bearer ${userAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('should deny User A (Org A) from reading Org B invitations', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgBId}/invitations`,
        headers: { authorization: `Bearer ${userAToken}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  describe('Organization Switching Context Isolation', () => {
    it('should preserve strict tenant boundaries when User A acts in Org A vs Org B context', async () => {
      // User A creates Org A (Admin in Org A). User A is NOT a member of Org B.
      const orgARes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}`,
        headers: { authorization: `Bearer ${userAToken}` },
      });
      expect(orgARes.statusCode).toBe(200);

      const orgBRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgBId}`,
        headers: { authorization: `Bearer ${userAToken}` },
      });
      expect(orgBRes.statusCode).toBe(403);
    });
  });

  describe('Organization Status Guard (Suspended/Archived Org Context)', () => {
    it('should deny requests with 403 Forbidden when organization status is set to SUSPENDED', async () => {
      const db = getDb();
      // Suspend Org A
      await db.update(organizations).set({ status: 'SUSPENDED' }).where(eq(organizations.id, orgAId));

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}`,
        headers: { authorization: `Bearer ${userAToken}` },
      });

      expect(res.statusCode).toBe(403);
      expect(res.json<{ error: { message: string } }>().error?.message).toMatch(/suspended|archived/i);

      // Restore Org A status to ACTIVE
      await db.update(organizations).set({ status: 'ACTIVE' }).where(eq(organizations.id, orgAId));
    });
  });

  describe('Role Tenant Validation (Cross-Tenant Role ID Audit)', () => {
    it('should return validation error (422/400) when User A in Org A supplies an Org B roleId for an invitation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${userAToken}` },
        payload: {
          email: `target_${runId}@example.com`,
          roleId: orgBRoleId, // Org B's role ID supplied in Org A invitation!
        },
      });

      expect([400, 422]).toContain(res.statusCode);
      expect(res.json<{ error: { message: string } }>().error?.message).toContain('Role does not belong to this organization');
    });
  });
});
