// apps/server/tests/integration/task3_rbac_tenant_isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { users, roles, outboxEvents, auditLogs } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { outboxService } from '../../src/lib/outbox/outbox.service.js';
import { rbacCacheService } from '../../src/modules/rbac/rbac.cache.service.js';
import { createAccessToken } from '../../src/modules/auth/token.service.js';
import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/shared/response.js';
import type { OrgDTO } from '../../src/modules/organization/organization.types.js';
import type { MemberDTO } from '../../src/modules/membership/membership.types.js';

describe('Task 3: RBAC Authorization, Redis Caching & Tenant Isolation', () => {
  let app: FastifyInstance;
  let userAToken: string;
  let userBToken: string;
  let userCToken: string;
  let userCId: string;
  let userCMemberId: string;
  let orgAId: string;
  let orgBId: string;
  let clientRoleId: string;
  let adminRoleId: string;

  const runId = Math.random().toString(36).substring(7);
  const emailA = `usera_${runId}@example.com`;
  const emailB = `userb_${runId}@example.com`;
  const emailC = `userc_${runId}@example.com`;
  const slugA = `org-alpha-${runId}`;
  const slugB = `org-beta-${runId}`;

  beforeAll(async () => {
    app = await createTestApp();
    const db = getDb();

    // 1. User A (Org A Admin)
    const userA = await db
      .insert(users)
      .values({ id: crypto.randomUUID(), email: emailA, passwordHash: 'dummy', firstName: 'UserA', status: 'ACTIVE', emailVerifiedAt: new Date() })
      .returning();
    userAToken = createAccessToken({ sub: userA[0]!.id, email: emailA, status: 'ACTIVE' });

    const orgARes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userAToken}` },
      payload: { name: 'Org Alpha', slug: slugA },
    });
    orgAId = orgARes.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;

    // 2. User B (Org B Admin)
    const userB = await db
      .insert(users)
      .values({ id: crypto.randomUUID(), email: emailB, passwordHash: 'dummy', firstName: 'UserB', status: 'ACTIVE', emailVerifiedAt: new Date() })
      .returning();
    userBToken = createAccessToken({ sub: userB[0]!.id, email: emailB, status: 'ACTIVE' });

    const orgBRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${userBToken}` },
      payload: { name: 'Org Beta', slug: slugB },
    });
    orgBId = orgBRes.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;

    // Find Client and Admin roles in Org A
    const orgARoles = await db.select().from(roles).where(eq(roles.organizationId, orgAId));
    clientRoleId = orgARoles.find((r) => r.name === 'Client')!.id;
    adminRoleId = orgARoles.find((r) => r.name === 'Organization Admin')!.id;

    // 3. User A invites User C as 'Client' role
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgAId}/invitations`,
      headers: { authorization: `Bearer ${userAToken}` },
      payload: { email: emailC, roleId: clientRoleId },
    });

    const pendingEvents = await db
      .select()
      .from(outboxEvents)
      .where(eq(outboxEvents.eventType, 'org:send-invitation-email'));
    const targetEvent = pendingEvents.find((e) => (e.payload as any).email === emailC)!;
    const token = (targetEvent.payload as { token: string }).token;
    await outboxService.publishPendingEvents();

    // User C registers and accepts
    const userC = await db
      .insert(users)
      .values({ id: crypto.randomUUID(), email: emailC, passwordHash: 'dummy', firstName: 'UserC', status: 'ACTIVE', emailVerifiedAt: new Date() })
      .returning();
    userCId = userC[0]!.id;
    userCToken = createAccessToken({ sub: userCId, email: emailC, status: 'ACTIVE' });

    await app.inject({
      method: 'POST',
      url: `/api/v1/invitations/${token}/accept`,
      headers: { authorization: `Bearer ${userCToken}` },
    });

    // Find User C's member ID in Org A
    const membersRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgAId}/members`,
      headers: { authorization: `Bearer ${userAToken}` },
    });
    const members = membersRes.json<ApiSuccessResponse<{ members: MemberDTO[] }>>().data.members;
    userCMemberId = members.find((m) => m.userId === userCId)!.id;
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
  });

  it('3.1 should deny permission for Client role attempting settings:update and log permission.denied audit', async () => {
    // User C (Client) attempts PATCH settings
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgAId}/settings`,
      headers: { authorization: `Bearer ${userCToken}` },
      payload: { currency: 'CAD' },
    });

    expect(patchRes.statusCode).toBe(403);
    const body = patchRes.json<ApiErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');

    // Verify audit log has permission.denied
    const db = getDb();
    const deniedLogs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, orgAId));
    const deniedEntry = deniedLogs.find((l) => l.action === 'permission.denied');
    expect(deniedEntry).toBeDefined();
    expect(deniedEntry!.resourceId).toBe('settings:update');
  });

  it('3.2 should enforce strict tenant boundary (User C in Org A cannot access Org B)', async () => {
    const crossTenantRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgBId}`,
      headers: { authorization: `Bearer ${userCToken}` },
    });

    expect(crossTenantRes.statusCode).toBe(403);
    const body = crossTenantRes.json<ApiErrorResponse>();
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('FORBIDDEN');
  });

  it('3.3 should dynamically grant permission after role update and invalidate Redis cache synchronously', async () => {
    // User A promotes User C to Organization Admin
    const promoteRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgAId}/members/${userCMemberId}`,
      headers: { authorization: `Bearer ${userAToken}` },
      payload: { roleId: adminRoleId },
    });

    expect(promoteRes.statusCode).toBe(200);

    // Check Redis cache for User C in Org A is invalidated
    const cachedPerms = await rbacCacheService.getPermissions(orgAId, userCId);
    expect(cachedPerms).toBeNull();

    // User C (now Admin) attempts PATCH settings again
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgAId}/settings`,
      headers: { authorization: `Bearer ${userCToken}` },
      payload: { currency: 'CAD' },
    });

    expect(patchRes.statusCode).toBe(200);
    const body = patchRes.json<ApiSuccessResponse<{ settings: { currency: string } }>>();
    expect(body.data.settings.currency).toBe('CAD');
  });
});
