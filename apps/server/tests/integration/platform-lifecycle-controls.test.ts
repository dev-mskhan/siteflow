// apps/server/tests/integration/platform-lifecycle-controls.test.ts
// Phase 11-03: member session revocation on org suspension, reactivation billing gate.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { eq, and } from 'drizzle-orm';
import { createTestApp } from '../helpers/test-app.js';
import {
  createVerifiedUser,
  createOrgWithAdmin,
  addMemberDirectly,
} from '../helpers/fixtures.js';
import { getDb } from '../../src/lib/db/index.js';
import { organizations, sessions, saasSubscriptions } from '@siteflow/database/schema';
import { PlatformLifecycleService } from '../../src/modules/platform/platform-lifecycle.service.js';

const PASSWORD = 'password123';
const reason = {
  reasonCode: 'SECURITY_INCIDENT' as const,
  reasonNote: 'Lifecycle controls integration test',
};

describe('platform lifecycle controls (Phase 11-03 additions)', () => {
  let app: FastifyInstance;
  const svc = new PlatformLifecycleService();

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  async function suspendOrgViaApproval(orgId: string, requester: string, approver: string) {
    const { approvalId } = await svc.requestOrganizationSuspension(orgId, {
      actorUserId: requester,
      password: PASSWORD,
      ...reason,
    });
    await svc.approveOrganizationSuspension(approvalId, {
      actorUserId: approver,
      password: PASSWORD,
      ...reason,
    });
  }

  async function setCurrentSubscriptionStatus(
    orgId: string,
    status: 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'UNPAID' | 'RESTRICTED' | 'CANCELED',
    graceStartsAt: Date | null = null,
  ) {
    const db = getDb();
    const existing = await db
      .select({ id: saasSubscriptions.id })
      .from(saasSubscriptions)
      .where(and(eq(saasSubscriptions.organizationId, orgId), eq(saasSubscriptions.isCurrent, true)));
    if (existing.length) {
      await db
        .update(saasSubscriptions)
        .set({ status, graceStartsAt })
        .where(eq(saasSubscriptions.id, existing[0]!.id));
      return;
    }
    const now = new Date();
    await db.insert(saasSubscriptions).values({
      id: randomUUID(),
      organizationId: orgId,
      planId: 'starter',
      priceVersionId: 'starter_month_v1',
      interval: 'month',
      status,
      isCurrent: true,
      currentPeriodStart: now,
      currentPeriodEnd: new Date(now.getTime() + 30 * 86400e3),
      graceStartsAt,
    });
  }

  it('revokes active member sessions when an organization suspension is approved', async () => {
    const { user: admin, token: adminToken } = await createVerifiedUser();
    const { orgId, roleMap } = await createOrgWithAdmin(app, adminToken);
    const { user: member } = await createVerifiedUser();
    await addMemberDirectly(orgId, member.id, roleMap.get('Subcontractor')!);

    const db = getDb();
    const sessionId = randomUUID();
    await db.insert(sessions).values({
      id: sessionId,
      userId: member.id,
      refreshTokenHash: `hash-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 86400e3),
    });

    const { user: opA } = await createVerifiedUser();
    const { user: opB } = await createVerifiedUser();
    await suspendOrgViaApproval(orgId, opA.id, opB.id);

    const [row] = await db.select({ revokedAt: sessions.revokedAt }).from(sessions).where(eq(sessions.id, sessionId));
    expect(row!.revokedAt).not.toBeNull();
    expect(admin.id).toBeTruthy();
  });

  it('rejects reactivation for subscriptions that block account access', async () => {
    const { user: opA } = await createVerifiedUser();
    const { user: opB } = await createVerifiedUser();
    for (const status of ['UNPAID', 'RESTRICTED', 'CANCELED'] as const) {
      const { token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await suspendOrgViaApproval(orgId, opA.id, opB.id);
      await setCurrentSubscriptionStatus(orgId, status);
      await expect(
        svc.reactivateOrganization(orgId, { actorUserId: opA.id, password: PASSWORD, ...reason }),
      ).rejects.toThrow(`subscription is ${status}`);
    }
  });

  it('allows reactivation for active, trialing, and in-grace past-due subscriptions', async () => {
    const { user: opA } = await createVerifiedUser();
    const { user: opB } = await createVerifiedUser();
    for (const status of ['ACTIVE', 'TRIALING', 'PAST_DUE'] as const) {
      const { token } = await createVerifiedUser();
      const { orgId } = await createOrgWithAdmin(app, token);
      await suspendOrgViaApproval(orgId, opA.id, opB.id);
      const graceStartsAt = status === 'PAST_DUE' ? new Date(Date.now() - 3 * 86400e3) : null;
      await setCurrentSubscriptionStatus(orgId, status, graceStartsAt);
      await expect(
        svc.reactivateOrganization(orgId, { actorUserId: opA.id, password: PASSWORD, ...reason }),
      ).resolves.toBeUndefined();
    }
  });

  it('rejects past-due subscriptions after the grace window expires', async () => {
    const { user: opA } = await createVerifiedUser();
    const { user: opB } = await createVerifiedUser();
    const { token } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, token);
    await suspendOrgViaApproval(orgId, opA.id, opB.id);
    await setCurrentSubscriptionStatus(orgId, 'PAST_DUE', new Date(Date.now() - 8 * 86400e3));

    await expect(
      svc.reactivateOrganization(orgId, { actorUserId: opA.id, password: PASSWORD, ...reason }),
    ).rejects.toThrow('subscription is PAST_DUE');
  });

  it('rejects reactivation unless the organization is suspended', async () => {
    const { user: operator, token } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, token);
    await expect(
      svc.reactivateOrganization(orgId, { actorUserId: operator.id, password: PASSWORD, ...reason }),
    ).rejects.toThrow('Organization is not suspended');
  });

  it('allows only one of two concurrent organization reactivations', async () => {
    const { token } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, token);
    const { user: opA } = await createVerifiedUser();
    const { user: opB } = await createVerifiedUser();
    await suspendOrgViaApproval(orgId, opA.id, opB.id);

    const results = await Promise.allSettled([
      svc.reactivateOrganization(orgId, { actorUserId: opA.id, password: PASSWORD, ...reason }),
      svc.reactivateOrganization(orgId, { actorUserId: opA.id, password: PASSWORD, ...reason }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    const [organization] = await getDb()
      .select({ status: organizations.status })
      .from(organizations)
      .where(eq(organizations.id, orgId));
    expect(organization!.status).toBe('ACTIVE');
  });
});
