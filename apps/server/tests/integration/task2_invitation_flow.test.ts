// apps/server/tests/integration/task2_invitation_flow.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { users, roles, outboxEvents, invitations, auditLogs } from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';
import { outboxService } from '../../src/lib/outbox/outbox.service.js';
import { createAccessToken } from '../../src/modules/auth/token.service.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { OrgDTO } from '../../src/modules/organization/organization.types.js';
import type { InvitationDTO } from '../../src/modules/invitation/invitation.types.js';
import type { MemberDTO } from '../../src/modules/membership/membership.types.js';

describe('Task 2: Member Invitation, Outbox Queue & Acceptance Flow', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let inviteeToken: string;
  let inviteeUserId: string;
  let orgId: string;
  let projectManagerRoleId: string;
  let rawInvitationToken: string;

  const runId = Math.random().toString(36).substring(7);
  const adminEmail = `admin_${runId}@example.com`;
  const inviteeEmail = `invitee_${runId}@example.com`;
  const orgSlug = `buildcorp-${runId}`;

  beforeAll(async () => {
    app = await createTestApp();
    const db = getDb();

    // 1. Insert admin user directly
    const adminUser = await db
      .insert(users)
      .values({
        email: adminEmail,
        passwordHash: 'dummyhash',
        firstName: 'Admin',
        status: 'ACTIVE',
      })
      .returning();
    adminToken = createAccessToken({ sub: adminUser[0]!.id, email: adminEmail, status: 'ACTIVE' });

    // 2. Admin creates org
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        name: 'BuildCorp',
        slug: orgSlug,
      },
    });
    orgId = orgRes.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;

    // 3. Find Project Manager role ID
    const orgRoles = await db.select().from(roles).where(eq(roles.organizationId, orgId));
    projectManagerRoleId = orgRoles.find((r) => r.name === 'Project Manager')!.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('2.1 should create pending invitation and write outbox event atomically', async () => {
    const inviteRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/invitations`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {
        email: inviteeEmail,
        roleId: projectManagerRoleId,
      },
    });

    expect(inviteRes.statusCode).toBe(201);
    const body = inviteRes.json<ApiSuccessResponse<{ invitation: InvitationDTO }>>();
    expect(body.data.invitation.email).toBe(inviteeEmail);
    expect(body.data.invitation.status).toBe('PENDING');

    // Verify DB state for outbox event
    const db = getDb();
    const pendingEvents = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.eventType, 'org:send-invitation-email'));

    expect(pendingEvents.length).toBeGreaterThan(0);
    const targetEvent = pendingEvents.find((e) => (e.payload as any).email === inviteeEmail)!;
    expect(targetEvent).toBeDefined();

    const eventPayload = targetEvent.payload as { token: string; email: string };
    expect(eventPayload.email).toBe(inviteeEmail);
    rawInvitationToken = eventPayload.token;
    expect(rawInvitationToken).toBeDefined();

    // Trigger Outbox Service processing
    const processedCount = await outboxService.publishPendingEvents();
    expect(processedCount).toBeGreaterThan(0);
  });

  it('2.2 should accept invitation and create active membership for authenticated user', async () => {
    const db = getDb();

    // Insert invitee user directly
    const inviteeUser = await db
      .insert(users)
      .values({
        email: inviteeEmail,
        passwordHash: 'dummyhash',
        firstName: 'Bob',
        lastName: 'Builder',
        status: 'ACTIVE',
      })
      .returning();

    inviteeUserId = inviteeUser[0]!.id;
    inviteeToken = createAccessToken({ sub: inviteeUserId, email: inviteeEmail, status: 'ACTIVE' });

    // Accept invitation
    const acceptRes = await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${rawInvitationToken}/accept`,
      headers: { authorization: `Bearer ${inviteeToken}` },
    });

    expect(acceptRes.statusCode).toBe(200);

    // Verify invitation status in DB is ACCEPTED
    const inviteRow = await db
      .select()
      .from(invitations)
      .where(and(eq(invitations.organizationId, orgId), eq(invitations.email, inviteeEmail)));
    expect(inviteRow[0]!.status).toBe('ACCEPTED');
    expect(inviteRow[0]!.acceptedAt).not.toBeNull();

    // Verify active membership created
    const membersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/members`,
      headers: { authorization: `Bearer ${adminToken}` },
    });

    expect(membersRes.statusCode).toBe(200);
    const membersBody = membersRes.json<ApiSuccessResponse<{ members: MemberDTO[] }>>();
    expect(membersBody.data.members.length).toBe(2);

    const bobMember = membersBody.data.members.find((m) => m.userId === inviteeUserId);
    expect(bobMember).toBeDefined();
    expect(bobMember!.roleName).toBe('Project Manager');
    expect(bobMember!.status).toBe('ACTIVE');

    // Verify Audit Trail for invitation flow
    const logs = await db.select().from(auditLogs).where(eq(auditLogs.organizationId, orgId));
    const actions = logs.map((l) => l.action);
    expect(actions).toContain('member.invited');
    expect(actions).toContain('member.joined');
  });
});
