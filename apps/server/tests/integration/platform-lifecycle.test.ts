// apps/server/tests/integration/platform-lifecycle.test.ts
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../src/lib/db/index.js';
import { users, organizations, platformApprovals, auditLogs } from '@siteflow/database/schema';
import { hashPassword } from '../../src/modules/auth/password.service.js';
import { PlatformLifecycleService } from '../../src/modules/platform/platform-lifecycle.service.js';
import { auditService } from '../../src/modules/audit/audit.service.js';

const PASSWORD = 'Correct-Horse-9';
const reason = {
  reasonCode: 'SECURITY_INCIDENT' as const,
  reasonNote: 'Integration test reason text',
};

describe('platform lifecycle service (Phase 11-03)', () => {
  const svc = new PlatformLifecycleService();
  const tag = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const orgIds: string[] = [];
  let operatorA: string;
  let operatorB: string;
  let targetUser: string;

  beforeAll(async () => {
    const db = getDb();
    const hash = await hashPassword(PASSWORD);
    operatorA = `test-lc-opa-${tag}`;
    operatorB = `test-lc-opb-${tag}`;
    targetUser = `test-lc-target-${tag}`;
    await db.insert(users).values([
      { id: operatorA, email: `opa.${tag}@example.test`, firstName: 'A', passwordHash: hash },
      { id: operatorB, email: `opb.${tag}@example.test`, firstName: 'B', passwordHash: hash },
      { id: targetUser, email: `tgt.${tag}@example.test`, firstName: 'T', passwordHash: hash },
    ]);
    userIds.push(operatorA, operatorB, targetUser);
  });

  afterAll(async () => {
    const db = getDb();
    if (orgIds.length) {
      await db.delete(platformApprovals).where(inArray(platformApprovals.targetId, orgIds));
      await db.delete(auditLogs).where(inArray(auditLogs.organizationId, orgIds));
      await db.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    if (userIds.length) {
      await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, userIds));
      await db.delete(users).where(inArray(users.id, userIds));
    }
  });

  async function createOrg(suffix: string): Promise<string> {
    const id = `test-lc-org-${tag}-${suffix}`;
    await getDb().insert(organizations).values({
      id,
      name: `LC ${suffix}`,
      slug: `lc-${tag}-${suffix}`,
      createdBy: operatorA,
    });
    orgIds.push(id);
    return id;
  }

  async function expectAuditCount(action: string, resourceId: string, count = 1) {
    const rows = await getDb()
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(and(eq(auditLogs.action, action), eq(auditLogs.resourceId, resourceId)));
    expect(rows).toHaveLength(count);
  }

  it('rejects a wrong password for an account suspension', async () => {
    await expect(
      svc.suspendAccount(targetUser, { actorUserId: operatorA, password: 'wrong-password', ...reason }),
    ).rejects.toThrow('Password confirmation failed');
  });

  it('forbids an operator from suspending their own account', async () => {
    await expect(
      svc.suspendAccount(operatorA, { actorUserId: operatorA, password: PASSWORD, ...reason }),
    ).rejects.toThrow('Operators cannot suspend their own account');
  });

  it('rolls back the mutation and audit row when a later transaction step fails', async () => {
    const originalLog = auditService.log.bind(auditService);
    const auditSpy = vi.spyOn(auditService, 'log').mockImplementation(async (entry, tx) => {
      await originalLog(entry, tx);
      throw new Error('forced failure after audit insert');
    });

    try {
      await expect(
        svc.suspendAccount(targetUser, { actorUserId: operatorA, password: PASSWORD, ...reason }),
      ).rejects.toThrow('forced failure after audit insert');
    } finally {
      auditSpy.mockRestore();
    }

    const [user] = await getDb().select({ status: users.status }).from(users).where(eq(users.id, targetUser));
    expect(user!.status).toBe('ACTIVE');
    await expectAuditCount('platform.account.suspended', targetUser, 0);
  });

  it('allows exactly one of two concurrent account suspensions', async () => {
    const results = await Promise.allSettled([
      svc.suspendAccount(targetUser, { actorUserId: operatorA, password: PASSWORD, ...reason }),
      svc.suspendAccount(targetUser, { actorUserId: operatorB, password: PASSWORD, ...reason }),
    ]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');
    const reasons = rejected.map((r) => (r.status === 'rejected' ? String(r.reason?.message ?? r.reason) : ''));
    expect(fulfilled, reasons.join(' | ')).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    const [row] = await getDb().select({ status: users.status }).from(users).where(eq(users.id, targetUser));
    expect(row.status).toBe('SUSPENDED');
    await expectAuditCount('platform.account.suspended', targetUser);
  });

  it('reactivates a suspended account and rejects a second reactivation', async () => {
    await svc.reactivateAccount(targetUser, { actorUserId: operatorA, password: PASSWORD, ...reason });
    await expectAuditCount('platform.account.reactivated', targetUser);
    await expect(
      svc.reactivateAccount(targetUser, { actorUserId: operatorA, password: PASSWORD, ...reason }),
    ).rejects.toThrow('Account is not suspended');
  });

  it('requires a second operator to approve an organization suspension', async () => {
    const orgId = await createOrg('approve');
    const { approvalId } = await svc.requestOrganizationSuspension(orgId, {
      actorUserId: operatorA,
      password: PASSWORD,
      ...reason,
    });
    await expectAuditCount('platform.organization.suspension_requested', orgId);

    await expect(
      svc.approveOrganizationSuspension(approvalId, { actorUserId: operatorA, password: PASSWORD, ...reason }),
    ).rejects.toThrow('cannot be approved by this operator');

    await svc.approveOrganizationSuspension(approvalId, {
      actorUserId: operatorB,
      password: PASSWORD,
      ...reason,
    });

    const [org] = await getDb().select({ status: organizations.status }).from(organizations).where(eq(organizations.id, orgId));
    expect(org.status).toBe('SUSPENDED');
    await expectAuditCount('platform.organization.suspended', orgId);

    await svc.reactivateOrganization(orgId, {
      actorUserId: operatorA,
      password: PASSWORD,
      ...reason,
    });
    await expectAuditCount('platform.organization.reactivated', orgId);

    await expect(
      svc.approveOrganizationSuspension(approvalId, { actorUserId: operatorB, password: PASSWORD, ...reason }),
    ).rejects.toThrow('cannot be approved by this operator');
  });

  it('does not let a second approval of the same request suspend twice', async () => {
    const orgId = await createOrg('double');
    const { approvalId } = await svc.requestOrganizationSuspension(orgId, {
      actorUserId: operatorA,
      password: PASSWORD,
      ...reason,
    });
    const results = await Promise.allSettled([
      svc.approveOrganizationSuspension(approvalId, { actorUserId: operatorB, password: PASSWORD, ...reason }),
      svc.approveOrganizationSuspension(approvalId, { actorUserId: operatorB, password: PASSWORD, ...reason }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });
});
