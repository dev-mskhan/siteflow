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
import { sessions, saasSubscriptions } from '@siteflow/database/schema';
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

  async function setCurrentSubscriptionStatus(orgId: string, status: 'ACTIVE' | 'UNPAID' | 'RESTRICTED' | 'CANCELED') {
    const db = getDb();
    const existing = await db
      .select({ id: saasSubscriptions.id })
      .from(saasSubscriptions)
      .where(and(eq(saasSubscriptions.organizationId, orgId), eq(saasSubscriptions.isCurrent, true)));
    if (existing.length) {
      await db.update(saasSubscriptions).set({ status }).where(eq(saasSubscriptions.id, existing[0]!.id));
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

  it('rejects reactivation while the current subscription is UNPAID', async () => {
    const { user: adminA, token: tokenA } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, tokenA);
    const { user: opA } = await createVerifiedUser();
    const { user: opB } = await createVerifiedUser();
    await suspendOrgViaApproval(orgId, opA.id, opB.id);
    await setCurrentSubscriptionStatus(orgId, 'UNPAID');

    await expect(
      svc.reactivateOrganization(orgId, { actorUserId: opA.id, password: PASSWORD, ...reason }),
    ).rejects.toThrow();
    expect(adminA.id).toBeTruthy();
  });

  it('allows reactivation once the current subscription is ACTIVE', async () => {
    const { token: tokenA } = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, tokenA);
    const { user: opA } = await createVerifiedUser();
    const { user: opB } = await createVerifiedUser();
    await suspendOrgViaApproval(orgId, opA.id, opB.id);
    await setCurrentSubscriptionStatus(orgId, 'ACTIVE');

    await expect(
      svc.reactivateOrganization(orgId, { actorUserId: opA.id, password: PASSWORD, ...reason }),
    ).resolves.toBeUndefined();
  });
});
