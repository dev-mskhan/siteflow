// apps/server/tests/integration/members_routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { organizationMemberships, auditLogs } from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';
import { rbacCacheService } from '../../src/modules/rbac/rbac.cache.service.js';
import {
  createVerifiedUser,
  createOrgWithAdmin,
  addMemberDirectly,
} from '../helpers/fixtures.js';
import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/shared/response.js';
import type { MemberDTO } from '../../src/modules/membership/membership.types.js';

const runId = Math.random().toString(36).slice(2, 9);

describe('Members Routes — comprehensive integration', () => {
  let app: FastifyInstance;

  // Shared org with one admin and one member of each role
  let adminToken: string;
  let adminUserId: string;
  let orgId: string;
  let roleMap: Map<string, string>;
  let adminMembershipId: string;

  // Per-role tokens and membership IDs
  let pmToken: string;
  let pmUserId: string;
  let pmMembershipId: string;

  let financeToken: string;
  let financeUserId: string;
  let financeMembershipId: string;

  let procurementToken: string;
  let procurementUserId: string;
  let procurementMembershipId: string;

  let supervisorToken: string;
  let supervisorUserId: string;
  let supervisorMembershipId: string;

  let subcontractorToken: string;
  let subcontractorUserId: string;
  let subcontractorMembershipId: string;

  let clientToken: string;
  let clientUserId: string;
  let clientMembershipId: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Admin creates the org
    const { user: adminUser, token } = await createVerifiedUser({
      email: `members_admin_${runId}@test.dev`,
    });
    adminToken = token;
    adminUserId = adminUser.id;

    const result = await createOrgWithAdmin(app, adminToken, `Members Test Org ${runId}`);
    orgId = result.orgId;
    roleMap = result.roleMap;
    adminMembershipId = result.adminMembershipId;

    // Add one member for each non-admin role
    const pmResult = await createVerifiedUser({ email: `members_pm_${runId}@test.dev` });
    pmToken = pmResult.token;
    pmUserId = pmResult.user.id;
    const pmMembership = await addMemberDirectly(orgId, pmUserId, roleMap.get('Project Manager')!);
    pmMembershipId = pmMembership.id;

    const financeResult = await createVerifiedUser({ email: `members_fin_${runId}@test.dev` });
    financeToken = financeResult.token;
    financeUserId = financeResult.user.id;
    const financeMembership = await addMemberDirectly(orgId, financeUserId, roleMap.get('Finance')!);
    financeMembershipId = financeMembership.id;

    const procResult = await createVerifiedUser({ email: `members_proc_${runId}@test.dev` });
    procurementToken = procResult.token;
    procurementUserId = procResult.user.id;
    const procMembership = await addMemberDirectly(orgId, procurementUserId, roleMap.get('Procurement')!);
    procurementMembershipId = procMembership.id;

    const supResult = await createVerifiedUser({ email: `members_sup_${runId}@test.dev` });
    supervisorToken = supResult.token;
    supervisorUserId = supResult.user.id;
    const supMembership = await addMemberDirectly(orgId, supervisorUserId, roleMap.get('Site Supervisor')!);
    supervisorMembershipId = supMembership.id;

    const subResult = await createVerifiedUser({ email: `members_sub_${runId}@test.dev` });
    subcontractorToken = subResult.token;
    subcontractorUserId = subResult.user.id;
    const subMembership = await addMemberDirectly(orgId, subcontractorUserId, roleMap.get('Subcontractor')!);
    subcontractorMembershipId = subMembership.id;

    const clientResult = await createVerifiedUser({ email: `members_cli_${runId}@test.dev` });
    clientToken = clientResult.token;
    clientUserId = clientResult.user.id;
    const clientMembership = await addMemberDirectly(orgId, clientUserId, roleMap.get('Client')!);
    clientMembershipId = clientMembership.id;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/organizations/:id/members', () => {
    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/members`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('cross-tenant → 403', async () => {
      const { token: stranger } = await createVerifiedUser({
        email: `members_stranger_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/members`,
        headers: { authorization: `Bearer ${stranger}` },
      });
      expect(res.statusCode).toBe(403);
    });

    describe('RBAC matrix', () => {
      it('Organization Admin → 200', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members`,
          headers: { authorization: `Bearer ${adminToken}` },
        });
        expect(res.statusCode).toBe(200);
      });

      it('Project Manager → 200 (has member:read)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members`,
          headers: { authorization: `Bearer ${pmToken}` },
        });
        expect(res.statusCode).toBe(200);
      });

      it('Finance → 200 (has member:read)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members`,
          headers: { authorization: `Bearer ${financeToken}` },
        });
        expect(res.statusCode).toBe(200);
      });

      it('Procurement → 200 (has member:read)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members`,
          headers: { authorization: `Bearer ${procurementToken}` },
        });
        expect(res.statusCode).toBe(200);
      });

      it('Site Supervisor → 200 (has member:read)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members`,
          headers: { authorization: `Bearer ${supervisorToken}` },
        });
        expect(res.statusCode).toBe(200);
      });

      it('Subcontractor → 403 (no member:read)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members`,
          headers: { authorization: `Bearer ${subcontractorToken}` },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Client → 403 (no member:read)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members`,
          headers: { authorization: `Bearer ${clientToken}` },
        });
        expect(res.statusCode).toBe(403);
      });
    });

    describe('Response shape', () => {
      it('each member has id/userId/roleId/roleName/userEmail/userFirstName/status/joinedAt/createdAt', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members`,
          headers: { authorization: `Bearer ${adminToken}` },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<ApiSuccessResponse<{ members: MemberDTO[] }>>();
        const member = body.data.members[0]!;
        expect(member.id).toBeDefined();
        expect(member.userId).toBeDefined();
        expect(member.roleId).toBeDefined();
        expect(member.roleName).toBeDefined();
        expect(member.userEmail).toBeDefined();
        expect(member.userFirstName).toBeDefined();
        expect(member.status).toBeDefined();
        expect(member.createdAt).toBeDefined();
      });

      it('REMOVED members NOT returned (soft-delete filter)', async () => {
        // Create a user to remove
        const { user: toRemove, token: toRemoveToken } = await createVerifiedUser({
          email: `members_toremove_${runId}@test.dev`,
        });
        const removeMembership = await addMemberDirectly(
          orgId,
          toRemove.id,
          roleMap.get('Client')!,
        );

        // Remove the member via API
        await app.inject({
          method: 'DELETE',
          url: `/api/v1/organizations/${orgId}/members/${removeMembership.id}`,
          headers: { authorization: `Bearer ${adminToken}` },
        });

        // Removed member should not appear in list
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members`,
          headers: { authorization: `Bearer ${adminToken}` },
        });
        const body = res.json<ApiSuccessResponse<{ members: MemberDTO[] }>>();
        const foundRemoved = body.data.members.find(
          (m) => m.userId === toRemove.id,
        );
        expect(foundRemoved).toBeUndefined();
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/organizations/:id/members/:memberId', () => {
    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/members/${adminMembershipId}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('memberId doesn\'t exist in this org → 404', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/members/00000000-0000-0000-0000-000000000001`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('memberId from DIFFERENT org → 404 (scoped query prevents IDOR)', async () => {
      // Create another org with its own admin
      const { token: otherAdmin } = await createVerifiedUser({
        email: `members_other_admin_${runId}@test.dev`,
      });
      const { orgId: otherOrgId, adminMembershipId: otherMembershipId } =
        await createOrgWithAdmin(app, otherAdmin, `Other Org ${runId}`);

      // Try to access other org's member from our org scope
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/members/${otherMembershipId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('Admin → 200, full MemberDTO shape', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/members/${pmMembershipId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ member: MemberDTO }>>();
      const m = body.data.member;
      expect(m.id).toBe(pmMembershipId);
      expect(m.userId).toBe(pmUserId);
      expect(m.roleName).toBe('Project Manager');
      expect(m.status).toBe('ACTIVE');
    });

    describe('RBAC: same matrix as list (member:read)', () => {
      it('Project Manager → 200', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${pmToken}` },
        });
        expect(res.statusCode).toBe(200);
      });

      it('Subcontractor → 403 (no member:read)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${subcontractorToken}` },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Client → 403 (no member:read)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members/${pmMembershipId}`,
          headers: { authorization: `Bearer ${clientToken}` },
        });
        expect(res.statusCode).toBe(403);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('PATCH /api/v1/organizations/:id/members/:memberId', () => {
    describe('Validation → 422', () => {
      it('status "BANNED" → 422', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { status: 'BANNED' },
        });
        expect(res.statusCode).toBe(422);
      });

      it('roleId "not-a-uuid" → 422', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { roleId: 'not-a-uuid' },
        });
        expect(res.statusCode).toBe(422);
      });

      it('empty body {} → 200, nothing changes', async () => {
        const before = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${adminToken}` },
        });
        const beforeMember = before.json<ApiSuccessResponse<{ member: MemberDTO }>>().data.member;

        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {},
        });
        expect(res.statusCode).toBe(200);
        const after = res.json<ApiSuccessResponse<{ member: MemberDTO }>>().data.member;
        expect(after.status).toBe(beforeMember.status);
        expect(after.roleId).toBe(beforeMember.roleId);
      });
    });

    describe('Auth/permission → RBAC', () => {
      it('no auth → 401', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          payload: { status: 'SUSPENDED' },
        });
        expect(res.statusCode).toBe(401);
      });

      it('Project Manager → 403 (no member:update)', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${pmToken}` },
          payload: { status: 'SUSPENDED' },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Finance → 403', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${financeToken}` },
          payload: { status: 'SUSPENDED' },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Procurement → 403', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${procurementToken}` },
          payload: { status: 'SUSPENDED' },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Site Supervisor → 403', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${supervisorToken}` },
          payload: { status: 'SUSPENDED' },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Subcontractor → 403', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${subcontractorToken}` },
          payload: { status: 'SUSPENDED' },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Client → 403', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
          headers: { authorization: `Bearer ${clientToken}` },
          payload: { status: 'SUSPENDED' },
        });
        expect(res.statusCode).toBe(403);
      });
    });

    describe('Business logic', () => {
      it('suspend non-admin member → 200, status=SUSPENDED, audit member.suspended', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${financeMembershipId}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { status: 'SUSPENDED' },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<ApiSuccessResponse<{ member: MemberDTO }>>();
        expect(body.data.member.status).toBe('SUSPENDED');

        const db = getDb();
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.organizationId, orgId));
        expect(logs.some((l) => l.action === 'member.suspended')).toBe(true);
      });

      it('reactivate suspended member → 200, status=ACTIVE, audit member.reactivated', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${financeMembershipId}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { status: 'ACTIVE' },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<ApiSuccessResponse<{ member: MemberDTO }>>();
        expect(body.data.member.status).toBe('ACTIVE');

        const db = getDb();
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.organizationId, orgId));
        expect(logs.some((l) => l.action === 'member.reactivated')).toBe(true);
      });

      it('change role of non-admin member → 200, roleId updated, audit member.role_changed', async () => {
        const newRoleId = roleMap.get('Procurement')!;
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${supervisorMembershipId}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { roleId: newRoleId },
        });
        expect(res.statusCode).toBe(200);
        const body = res.json<ApiSuccessResponse<{ member: MemberDTO }>>();
        expect(body.data.member.roleId).toBe(newRoleId);

        const db = getDb();
        const logs = await db
          .select()
          .from(auditLogs)
          .where(eq(auditLogs.organizationId, orgId));
        expect(logs.some((l) => l.action === 'member.role_changed')).toBe(true);
      });

      it('after role change, Redis cache for that user/org is invalidated (getPermissions returns null)', async () => {
        // Change subcontractor role
        const newRoleId = roleMap.get('Finance')!;
        await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${subcontractorMembershipId}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { roleId: newRoleId },
        });

        // Check that cache is invalidated (null = cache miss, fresh lookup required)
        const cachedPerms = await rbacCacheService.getPermissions(orgId, subcontractorUserId);
        expect(cachedPerms).toBeNull();
      });
    });

    describe('Last-admin guard', () => {
      it('suspend the ONLY admin → 422 VALIDATION_ERROR', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${adminMembershipId}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { status: 'SUSPENDED' },
        });
        expect(res.statusCode).toBe(422);
        expect(res.json<ApiErrorResponse>().error.code).toBe('VALIDATION_ERROR');
      });

      it('change role of ONLY admin to non-admin role → 422 VALIDATION_ERROR', async () => {
        const res = await app.inject({
          method: 'PATCH',
          url: `/api/v1/organizations/${orgId}/members/${adminMembershipId}`,
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { roleId: roleMap.get('Project Manager')! },
        });
        expect(res.statusCode).toBe(422);
        expect(res.json<ApiErrorResponse>().error.code).toBe('VALIDATION_ERROR');
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('DELETE /api/v1/organizations/:id/members/:memberId', () => {
    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('Project Manager → 403 (no member:remove)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
        headers: { authorization: `Bearer ${pmToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Finance → 403', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/members/${clientMembershipId}`,
        headers: { authorization: `Bearer ${financeToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('non-existent memberId → 404', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/members/00000000-0000-0000-0000-000000000001`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('ONLY admin → 422 (last admin guard)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/members/${adminMembershipId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(422);
    });

    it('valid non-admin member → 200, status=REMOVED in DB (soft delete)', async () => {
      // Create a fresh user to remove, so we don't affect other tests
      const { user: toRemove } = await createVerifiedUser({
        email: `members_del_target_${runId}@test.dev`,
      });
      const targetMembership = await addMemberDirectly(
        orgId,
        toRemove.id,
        roleMap.get('Procurement')!,
      );

      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/members/${targetMembership.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);

      // Verify soft-delete (status = REMOVED) in DB
      const db = getDb();
      const rows = await db
        .select()
        .from(organizationMemberships)
        .where(eq(organizationMemberships.id, targetMembership.id));
      expect(rows.length).toBe(1);
      expect(rows[0]!.status).toBe('REMOVED');
    });

    it('after removal, that user can no longer access org (GET org → 403)', async () => {
      // Create a fresh user to remove
      const { user: toRemove, token: toRemoveToken } = await createVerifiedUser({
        email: `members_del_noaccess_${runId}@test.dev`,
      });
      const targetMembership = await addMemberDirectly(
        orgId,
        toRemove.id,
        roleMap.get('Client')!,
      );

      // Verify they CAN access before removal
      const beforeRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${toRemoveToken}` },
      });
      expect(beforeRes.statusCode).toBe(200);

      // Remove them
      await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/members/${targetMembership.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      // Verify they CANNOT access after removal
      const afterRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${toRemoveToken}` },
      });
      expect(afterRes.statusCode).toBe(403);
    });

    it('audit member.removed written', async () => {
      // Create a fresh member to remove for this audit test
      const { user: toRemove } = await createVerifiedUser({
        email: `members_del_audit_${runId}@test.dev`,
      });
      const targetMembership = await addMemberDirectly(
        orgId,
        toRemove.id,
        roleMap.get('Client')!,
      );

      await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/members/${targetMembership.id}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });

      const db = getDb();
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, orgId));
      expect(logs.some((l) => l.action === 'member.removed')).toBe(true);
    });
  });
});
