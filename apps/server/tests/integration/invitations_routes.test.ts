// apps/server/tests/integration/invitations_routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { invitations, auditLogs } from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';
import { outboxService } from '../../src/lib/outbox/outbox.service.js';
import {
  createVerifiedUser,
  createOrgWithAdmin,
  addMemberDirectly,
  getInvitationTokenFromOutbox,
  countOutboxEvents,
} from '../helpers/fixtures.js';
import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/shared/response.js';
import type { InvitationDTO } from '../../src/modules/invitation/invitation.types.js';

const runId = Math.random().toString(36).slice(2, 9);

describe('Invitations Routes — comprehensive integration', () => {
  let app: FastifyInstance;

  // Org A — main test tenant
  let adminAToken: string;
  let adminAUserId: string;
  let orgAId: string;
  let orgARoleMap: Map<string, string>;

  // Org B — second tenant (for cross-tenant tests)
  let adminBToken: string;
  let orgBId: string;
  let orgBRoleMap: Map<string, string>;

  // userC — the invitee (not in any org initially)
  let userCId: string;
  let userCEmail: string;
  let userCToken: string;

  // userD — already a member of orgA
  let userDEmail: string;

  // Role members in Org A for RBAC tests
  let pmToken: string;
  let financeToken: string;
  let procurementToken: string;
  let supervisorToken: string;
  let subcontractorToken: string;
  let clientToken: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Admin A creates Org A
    const adminAResult = await createVerifiedUser({
      email: `inv_admin_a_${runId}@test.dev`,
    });
    adminAToken = adminAResult.token;
    adminAUserId = adminAResult.user.id;
    const orgAResult = await createOrgWithAdmin(
      app,
      adminAToken,
      `Invitations OrgA ${runId}`,
    );
    orgAId = orgAResult.orgId;
    orgARoleMap = orgAResult.roleMap;

    // Admin B creates Org B
    const adminBResult = await createVerifiedUser({
      email: `inv_admin_b_${runId}@test.dev`,
    });
    adminBToken = adminBResult.token;
    const orgBResult = await createOrgWithAdmin(
      app,
      adminBToken,
      `Invitations OrgB ${runId}`,
    );
    orgBId = orgBResult.orgId;
    orgBRoleMap = orgBResult.roleMap;

    // userC — fresh user, not in any org
    userCEmail = `inv_userc_${runId}@test.dev`;
    const userCResult = await createVerifiedUser({ email: userCEmail });
    userCId = userCResult.user.id;
    userCToken = userCResult.token;

    // userD — already a member of orgA
    userDEmail = `inv_userd_${runId}@test.dev`;
    const userDResult = await createVerifiedUser({ email: userDEmail });
    await addMemberDirectly(orgAId, userDResult.user.id, orgARoleMap.get('Client')!);

    // Set up role members in Org A for RBAC tests
    const pmResult = await createVerifiedUser({ email: `inv_pm_${runId}@test.dev` });
    pmToken = pmResult.token;
    await addMemberDirectly(orgAId, pmResult.user.id, orgARoleMap.get('Project Manager')!);

    const finResult = await createVerifiedUser({ email: `inv_fin_${runId}@test.dev` });
    financeToken = finResult.token;
    await addMemberDirectly(orgAId, finResult.user.id, orgARoleMap.get('Finance')!);

    const procResult = await createVerifiedUser({ email: `inv_proc_${runId}@test.dev` });
    procurementToken = procResult.token;
    await addMemberDirectly(orgAId, procResult.user.id, orgARoleMap.get('Procurement')!);

    const supResult = await createVerifiedUser({ email: `inv_sup_${runId}@test.dev` });
    supervisorToken = supResult.token;
    await addMemberDirectly(orgAId, supResult.user.id, orgARoleMap.get('Site Supervisor')!);

    const subResult = await createVerifiedUser({ email: `inv_sub_${runId}@test.dev` });
    subcontractorToken = subResult.token;
    await addMemberDirectly(orgAId, subResult.user.id, orgARoleMap.get('Subcontractor')!);

    const cliResult = await createVerifiedUser({ email: `inv_cli_${runId}@test.dev` });
    clientToken = cliResult.token;
    await addMemberDirectly(orgAId, cliResult.user.id, orgARoleMap.get('Client')!);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/organizations/:id/invitations', () => {
    describe('Validation → 422', () => {
      it('missing email → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
          payload: { roleId: orgARoleMap.get('Project Manager')! },
        });
        expect(res.statusCode).toBe(422);
      });

      it('email "notanemail" → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
          payload: {
            email: 'notanemail',
            roleId: orgARoleMap.get('Project Manager')!,
          },
        });
        expect(res.statusCode).toBe(422);
      });

      it('missing roleId → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
          payload: { email: `missing_role_${runId}@test.dev` },
        });
        expect(res.statusCode).toBe(422);
      });

      it('roleId "not-a-uuid" → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
          payload: {
            email: `bad_role_${runId}@test.dev`,
            roleId: 'not-a-uuid',
          },
        });
        expect(res.statusCode).toBe(422);
      });

      it('orgBRoleId used in orgA request → 422 "Role does not belong to this organization"', async () => {
        const orgBRoleId = orgBRoleMap.get('Project Manager')!;
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
          payload: {
            email: `crosstenant_role_${runId}@test.dev`,
            roleId: orgBRoleId,
          },
        });
        expect(res.statusCode).toBe(422);
        expect(res.json<ApiErrorResponse>().error.message).toMatch(
          /role does not belong/i,
        );
      });
    });

    describe('Auth/permission', () => {
      it('no auth → 401', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          payload: {
            email: `noauth_${runId}@test.dev`,
            roleId: orgARoleMap.get('Client')!,
          },
        });
        expect(res.statusCode).toBe(401);
      });

      it('cross-tenant (adminB targeting orgA) → 403', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminBToken}` },
          payload: {
            email: `cross_b_${runId}@test.dev`,
            roleId: orgARoleMap.get('Client')!,
          },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Project Manager (no member:invite) → 403', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${pmToken}` },
          payload: {
            email: `pm_invite_${runId}@test.dev`,
            roleId: orgARoleMap.get('Client')!,
          },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Finance → 403', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${financeToken}` },
          payload: {
            email: `fin_invite_${runId}@test.dev`,
            roleId: orgARoleMap.get('Client')!,
          },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Procurement → 403', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${procurementToken}` },
          payload: {
            email: `proc_invite_${runId}@test.dev`,
            roleId: orgARoleMap.get('Client')!,
          },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Site Supervisor → 403', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${supervisorToken}` },
          payload: {
            email: `sup_invite_${runId}@test.dev`,
            roleId: orgARoleMap.get('Client')!,
          },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Subcontractor → 403', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${subcontractorToken}` },
          payload: {
            email: `sub_invite_${runId}@test.dev`,
            roleId: orgARoleMap.get('Client')!,
          },
        });
        expect(res.statusCode).toBe(403);
      });

      it('Client → 403', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${clientToken}` },
          payload: {
            email: `cli_invite_${runId}@test.dev`,
            roleId: orgARoleMap.get('Client')!,
          },
        });
        expect(res.statusCode).toBe(403);
      });
    });

    describe('Business logic', () => {
      it('invite new email → 201, status=PENDING, roleName in DTO', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
          payload: {
            email: userCEmail,
            roleId: orgARoleMap.get('Project Manager')!,
          },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json<ApiSuccessResponse<{ invitation: InvitationDTO }>>();
        expect(body.data.invitation.status).toBe('PENDING');
        expect(body.data.invitation.email).toBe(userCEmail);
        expect(body.data.invitation.roleName).toBe('Project Manager');
      });

      it('InvitationDTO has id/organizationId/email/roleId/roleName/status/expiresAt/acceptedAt/invitedBy/createdAt', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
        });
        const body = res.json<ApiSuccessResponse<{ invitations: InvitationDTO[] }>>();
        const inv = body.data.invitations.find((i) => i.email === userCEmail)!;
        expect(inv.id).toBeDefined();
        expect(inv.organizationId).toBe(orgAId);
        expect(inv.email).toBe(userCEmail);
        expect(inv.roleId).toBeDefined();
        expect(inv.roleName).toBeDefined();
        expect(inv.status).toBeDefined();
        expect(inv.expiresAt).toBeDefined();
        expect(inv.acceptedAt).toBeNull();
        expect(inv.invitedBy).toBeDefined();
        expect(inv.createdAt).toBeDefined();
      });

      it('InvitationDTO does NOT have tokenHash field', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
        });
        const body = res.json();
        expect(JSON.stringify(body)).not.toContain('tokenHash');
      });

      it('invite same email twice (duplicate pending) → 409 CONFLICT', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
          payload: {
            email: userCEmail,
            roleId: orgARoleMap.get('Project Manager')!,
          },
        });
        expect(res.statusCode).toBe(409);
        expect(res.json<ApiErrorResponse>().error.code).toBe('CONFLICT');
      });

      it('invite userD (already a member) → 409 "User is already a member"', async () => {
        const res = await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
          payload: {
            email: userDEmail,
            roleId: orgARoleMap.get('Client')!,
          },
        });
        expect(res.statusCode).toBe(409);
        expect(res.json<ApiErrorResponse>().error.code).toBe('CONFLICT');
      });

      it('exactly 1 outbox event org:send-invitation-email queued per invite', async () => {
        const freshEmail = `inv_outbox_fresh_${runId}@test.dev`;
        const before = await countOutboxEvents('org:send-invitation-email', {
          email: freshEmail,
        });

        await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
          payload: {
            email: freshEmail,
            roleId: orgARoleMap.get('Client')!,
          },
        });

        const after = await countOutboxEvents('org:send-invitation-email', {
          email: freshEmail,
        });
        expect(after - before).toBe(1);
      });

      it('token in outbox payload is defined and non-empty', async () => {
        const freshEmail = `inv_token_check_${runId}@test.dev`;
        await app.inject({
          method: 'POST',
          url: `/api/v1/organizations/${orgAId}/invitations`,
          headers: { authorization: `Bearer ${adminAToken}` },
          payload: {
            email: freshEmail,
            roleId: orgARoleMap.get('Client')!,
          },
        });

        const token = await getInvitationTokenFromOutbox(freshEmail);
        expect(token).toBeDefined();
        expect(token.length).toBeGreaterThan(0);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/organizations/:id/invitations', () => {
    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}/invitations`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('cross-tenant → 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminBToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Subcontractor (no member:read) → 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${subcontractorToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Client (no member:read) → 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Admin → 200, array of InvitationDTOs', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ invitations: InvitationDTO[] }>>();
      expect(Array.isArray(body.data.invitations)).toBe(true);
    });

    it('Project Manager (has member:read) → 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${pmToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('Finance → 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${financeToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('response NEVER contains tokenHash field', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });
      expect(JSON.stringify(res.json())).not.toContain('tokenHash');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('DELETE /api/v1/organizations/:id/invitations/:invitationId (cancel)', () => {
    let invitationToCancel: string;
    let cancelTestEmail: string;

    beforeAll(async () => {
      cancelTestEmail = `inv_cancel_target_${runId}@test.dev`;
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          email: cancelTestEmail,
          roleId: orgARoleMap.get('Client')!,
        },
      });
      invitationToCancel = res.json<ApiSuccessResponse<{ invitation: InvitationDTO }>>()
        .data.invitation.id;
    });

    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgAId}/invitations/${invitationToCancel}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('Project Manager (no invitation:cancel) → 403', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgAId}/invitations/${invitationToCancel}`,
        headers: { authorization: `Bearer ${pmToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('non-existent invitationId → 404', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgAId}/invitations/00000000-0000-0000-0000-000000000001`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('valid PENDING → 200, status=CANCELLED in DB', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgAId}/invitations/${invitationToCancel}`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });
      expect(res.statusCode).toBe(200);

      const db = getDb();
      const rows = await db
        .select()
        .from(invitations)
        .where(eq(invitations.id, invitationToCancel));
      expect(rows[0]!.status).toBe('CANCELLED');
    });

    it('already CANCELLED invitation → 422 (wrong state)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgAId}/invitations/${invitationToCancel}`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });
      expect(res.statusCode).toBe(422);
    });

    it('already ACCEPTED invitation → 422 (wrong state)', async () => {
      // Create and accept an invitation, then try to cancel
      const acceptEmail = `inv_accept_then_cancel_${runId}@test.dev`;
      const inviteRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          email: acceptEmail,
          roleId: orgARoleMap.get('Client')!,
        },
      });
      const acceptInvitationId = inviteRes.json<
        ApiSuccessResponse<{ invitation: InvitationDTO }>
      >().data.invitation.id;

      // Get the token from outbox
      const token = await getInvitationTokenFromOutbox(acceptEmail);

      // Create the user and accept
      const { user: acceptUser, token: acceptToken } = await createVerifiedUser({
        email: acceptEmail,
      });
      await app.inject({
        method: 'POST',
        url: `/api/v1/invitations/${token}/accept`,
        headers: { authorization: `Bearer ${acceptToken}` },
      });

      // Now try to cancel the accepted invitation
      const cancelRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgAId}/invitations/${acceptInvitationId}`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });
      expect(cancelRes.statusCode).toBe(422);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/invitations/:token/accept', () => {
    let acceptableInvitationToken: string;
    let acceptEmail: string;
    let acceptUserToken: string;
    let acceptUserId: string;

    beforeAll(async () => {
      acceptEmail = `inv_accept_main_${runId}@test.dev`;
      const inviteRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          email: acceptEmail,
          roleId: orgARoleMap.get('Finance')!,
        },
      });
      expect(inviteRes.statusCode).toBe(201);

      acceptableInvitationToken = await getInvitationTokenFromOutbox(acceptEmail);

      const { user: acceptUser, token } = await createVerifiedUser({
        email: acceptEmail,
      });
      acceptUserId = acceptUser.id;
      acceptUserToken = token;
    });

    it('no auth → 401 (auth checked before token lookup)', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/invitations/${acceptableInvitationToken}/accept`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('valid auth, garbage/fake token → 404 NOT_FOUND', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/invitations/deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef/accept',
        headers: { authorization: `Bearer ${acceptUserToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('valid auth + valid token but WRONG email → 422', async () => {
      // The token was issued to acceptEmail, but we use a different user's token
      const { token: wrongUserToken } = await createVerifiedUser({
        email: `inv_wrong_user_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/invitations/${acceptableInvitationToken}/accept`,
        headers: { authorization: `Bearer ${wrongUserToken}` },
      });
      expect(res.statusCode).toBe(422);
    });

    it('valid auth + valid token → 200, membership created with correct roleId', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/invitations/${acceptableInvitationToken}/accept`,
        headers: { authorization: `Bearer ${acceptUserToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('membership status = ACTIVE after accept', async () => {
      const membersRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgAId}/members`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });
      const members = membersRes.json<
        ApiSuccessResponse<{ members: any[] }>
      >().data.members;
      const newMember = members.find((m) => m.userId === acceptUserId);
      expect(newMember).toBeDefined();
      expect(newMember!.status).toBe('ACTIVE');
      expect(newMember!.roleName).toBe('Finance');
    });

    it('invitation status = ACCEPTED in DB', async () => {
      const db = getDb();
      const rows = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, orgAId),
            eq(invitations.email, acceptEmail),
          ),
        );
      expect(rows[0]!.status).toBe('ACCEPTED');
    });

    it('invitation.acceptedAt is set', async () => {
      const db = getDb();
      const rows = await db
        .select()
        .from(invitations)
        .where(
          and(
            eq(invitations.organizationId, orgAId),
            eq(invitations.email, acceptEmail),
          ),
        );
      expect(rows[0]!.acceptedAt).not.toBeNull();
    });

    it('audit: invitation.accepted in audit logs', async () => {
      const db = getDb();
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, orgAId));
      expect(logs.some((l) => l.action === 'invitation.accepted')).toBe(true);
    });

    it('audit: member.joined in audit logs', async () => {
      const db = getDb();
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, orgAId));
      expect(logs.some((l) => l.action === 'member.joined')).toBe(true);
    });

    it('calling accept again (already a member) → 409 CONFLICT', async () => {
      // The invitation was already accepted — try again with same token (which is now consumed)
      // Since the token is already used, the lookup will fail with 404 (invalid token)
      // But if user tries to accept another invite for the same org, they should get 409
      const dupEmail = `inv_dup_accept_${runId}@test.dev`;
      const dupInviteRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          email: dupEmail,
          roleId: orgARoleMap.get('Client')!,
        },
      });
      expect(dupInviteRes.statusCode).toBe(201);
      const dupToken = await getInvitationTokenFromOutbox(dupEmail);

      const { user: dupUser, token: dupUserToken } = await createVerifiedUser({
        email: dupEmail,
      });
      // First accept — success
      const firstAccept = await app.inject({
        method: 'POST',
        url: `/api/v1/invitations/${dupToken}/accept`,
        headers: { authorization: `Bearer ${dupUserToken}` },
      });
      expect(firstAccept.statusCode).toBe(200);

      // Create a new invitation for same user (they are now a member)
      // This should result in 409 when trying to invite because they're already a member
      const reInviteRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          email: dupEmail,
          roleId: orgARoleMap.get('Client')!,
        },
      });
      expect(reInviteRes.statusCode).toBe(409);
      expect(reInviteRes.json<ApiErrorResponse>().error.code).toBe('CONFLICT');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('Expired invitation test', () => {
    it('invitation with expiresAt in the past → 422 on accept', async () => {
      const expiredEmail = `inv_expired_${runId}@test.dev`;
      const invRes = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          email: expiredEmail,
          roleId: orgARoleMap.get('Client')!,
        },
      });
      expect(invRes.statusCode).toBe(201);
      const invitationId = invRes.json<ApiSuccessResponse<{ invitation: InvitationDTO }>>()
        .data.invitation.id;
      const expiredToken = await getInvitationTokenFromOutbox(expiredEmail);

      // Manually set expiresAt to the past in DB
      const db = getDb();
      await db
        .update(invitations)
        .set({ expiresAt: new Date(Date.now() - 60000) })
        .where(eq(invitations.id, invitationId));

      // Create user to accept
      const { token: expiredUserToken } = await createVerifiedUser({ email: expiredEmail });

      const acceptRes = await app.inject({
        method: 'POST',
        url: `/api/v1/invitations/${expiredToken}/accept`,
        headers: { authorization: `Bearer ${expiredUserToken}` },
      });
      expect(acceptRes.statusCode).toBe(422);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('Invitation flow — re-invite after cancel', () => {
    it('invite userC, cancel the invitation, invite userC again → 201 (allowed, no pending duplicate)', async () => {
      // Invite a fresh user for this scenario
      const reInviteEmail = `inv_reinvite_${runId}@test.dev`;

      // First invite
      const firstInvite = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          email: reInviteEmail,
          roleId: orgARoleMap.get('Client')!,
        },
      });
      expect(firstInvite.statusCode).toBe(201);
      const firstInvitationId = firstInvite.json<
        ApiSuccessResponse<{ invitation: InvitationDTO }>
      >().data.invitation.id;

      // Cancel it
      const cancelRes = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgAId}/invitations/${firstInvitationId}`,
        headers: { authorization: `Bearer ${adminAToken}` },
      });
      expect(cancelRes.statusCode).toBe(200);

      // Re-invite the same email — should succeed because no pending invite exists
      const secondInvite = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgAId}/invitations`,
        headers: { authorization: `Bearer ${adminAToken}` },
        payload: {
          email: reInviteEmail,
          roleId: orgARoleMap.get('Client')!,
        },
      });
      expect(secondInvite.statusCode).toBe(201);
      const secondBody = secondInvite.json<
        ApiSuccessResponse<{ invitation: InvitationDTO }>
      >();
      expect(secondBody.data.invitation.status).toBe('PENDING');
      expect(secondBody.data.invitation.email).toBe(reInviteEmail);
    });
  });
});
