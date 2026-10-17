// apps/server/tests/integration/notification/event-notification-worker.test.ts
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { eq, inArray } from 'drizzle-orm';
import { getDb } from '../../../src/lib/db/index.js';
import {
  users,
  organizations,
  organizationMemberships,
  roles,
  projectMembers,
  projects,
  notifications,
  notificationPreferences,
} from '@siteflow/database/schema';
import {
  processEventNotification,
} from '../../../src/modules/notification/event-notification.worker.js';
import { notificationService } from '../../../src/modules/notification/notification.service.js';
import { preferenceService } from '../../../src/modules/notification/preferences/preference.service.js';
import { realtimeDeliveryManager } from '../../../src/modules/notification/realtime/realtime.delivery.js';

describe('Event Notification Worker & Tenant Isolation (P1-2, P1-4, P1-9, P1-12)', () => {
  const runId = Math.random().toString(36).substring(7);
  const db = getDb();

  const userIds: string[] = [];
  const orgIds: string[] = [];
  const projectIds: string[] = [];

  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let userCId: string; // Project member in Org A
  let projAId: string;

  beforeAll(async () => {
    // Create User A (Owner of Org A)
    userAId = randomUUID();
    userIds.push(userAId);
    await db.insert(users).values({
      id: userAId,
      email: `owner_a_${runId}@example.com`,
      firstName: 'OwnerA',
      passwordHash: 'dummy',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    });

    // Create User B (Owner of Org B)
    userBId = randomUUID();
    userIds.push(userBId);
    await db.insert(users).values({
      id: userBId,
      email: `owner_b_${runId}@example.com`,
      firstName: 'OwnerB',
      passwordHash: 'dummy',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    });

    // Create User C (Member of Project in Org A)
    userCId = randomUUID();
    userIds.push(userCId);
    await db.insert(users).values({
      id: userCId,
      email: `member_c_${runId}@example.com`,
      firstName: 'MemberC',
      passwordHash: 'dummy',
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
    });

    // Create Org A
    orgAId = randomUUID();
    orgIds.push(orgAId);
    await db.insert(organizations).values({
      id: orgAId,
      name: `Org A ${runId}`,
      slug: `org-a-${runId}`,
      createdBy: userAId,
      status: 'ACTIVE',
    });

    // Create Org B
    orgBId = randomUUID();
    orgIds.push(orgBId);
    await db.insert(organizations).values({
      id: orgBId,
      name: `Org B ${runId}`,
      slug: `org-b-${runId}`,
      createdBy: userBId,
      status: 'ACTIVE',
    });

    // Create Role Admin for Org A and B
    const [roleA] = await db
      .insert(roles)
      .values({
        id: randomUUID(),
        organizationId: orgAId,
        name: 'Organization Admin',
      })
      .returning();

    const [roleB] = await db
      .insert(roles)
      .values({
        id: randomUUID(),
        organizationId: orgBId,
        name: 'Organization Admin',
      })
      .returning();

    // Assign memberships
    await db.insert(organizationMemberships).values([
      {
        id: randomUUID(),
        organizationId: orgAId,
        userId: userAId,
        roleId: roleA.id,
        status: 'ACTIVE',
      },
      {
        id: randomUUID(),
        organizationId: orgBId,
        userId: userBId,
        roleId: roleB.id,
        status: 'ACTIVE',
      },
    ]);

    // Create Project in Org A
    projAId = randomUUID();
    projectIds.push(projAId);
    await db.insert(projects).values({
      id: projAId,
      organizationId: orgAId,
      projectNumber: `PRJ-${runId}`,
      name: `Project A ${runId}`,
      currency: 'USD',
      status: 'ACTIVE',
      createdBy: userAId,
    });

    // Add User C to Project A
    await db.insert(projectMembers).values({
      id: randomUUID(),
      organizationId: orgAId,
      projectId: projAId,
      userId: userCId,
      role: 'PROJECT_MEMBER',
      status: 'ACTIVE',
    });
  }, 60_000);

  afterAll(async () => {
    if (orgIds.length > 0) {
      await db.delete(notifications).where(inArray(notifications.organizationId, orgIds));
      await db.delete(notificationPreferences).where(inArray(notificationPreferences.organizationId, orgIds));
      await db.delete(projectMembers).where(inArray(projectMembers.organizationId, orgIds));
      await db.delete(projects).where(inArray(projects.organizationId, orgIds));
      await db.delete(organizationMemberships).where(inArray(organizationMemberships.organizationId, orgIds));
      await db.delete(roles).where(inArray(roles.organizationId, orgIds));
      await db.delete(organizations).where(inArray(organizations.id, orgIds));
    }
    if (userIds.length > 0) {
      await db.delete(users).where(inArray(users.id, userIds));
    }
  }, 60_000);

  it('delivers organization events strictly to Org A recipients and never to Org B', async () => {
    const broadcastSpy = vi.spyOn(realtimeDeliveryManager, 'broadcastToUser');

    await processEventNotification('billing.subscription.status_changed', {
      organizationId: orgAId,
      subscriptionId: 'sub_123',
      toStatus: 'ACTIVE',
    });

    // Verify User A in Org A received the notification
    const userANotifs = await notificationService.getRecipientNotifications(orgAId, userAId);
    expect(userANotifs.some((n) => n.eventType === 'billing.subscription.status_changed')).toBe(true);

    // Verify User B in Org B did NOT receive any notification
    const userBNotifs = await notificationService.getRecipientNotifications(orgBId, userBId);
    expect(userBNotifs.length).toBe(0);

    // Verify realtime broadcast only targeted User A with Org A
    expect(broadcastSpy).toHaveBeenCalledWith(
      userAId,
      orgAId,
      expect.objectContaining({ type: 'billing.subscription.status_changed', organizationId: orgAId }),
    );
    expect(broadcastSpy).not.toHaveBeenCalledWith(userBId, expect.anything(), expect.anything());

    broadcastSpy.mockRestore();
  });

  it('delivers project events strictly to active project members in that organization', async () => {
    const broadcastSpy = vi.spyOn(realtimeDeliveryManager, 'broadcastToUser');

    await processEventNotification('rfi.responded', {
      organizationId: orgAId,
      projectId: projAId,
      rfiId: 'rfi_123',
    });

    // User C is a member of Project A in Org A -> receives notification
    const userCNotifs = await notificationService.getRecipientNotifications(orgAId, userCId);
    expect(userCNotifs.some((n) => n.eventType === 'rfi.responded')).toBe(true);

    // Org B users receive nothing
    const userBNotifs = await notificationService.getRecipientNotifications(orgBId, userBId);
    expect(userBNotifs.length).toBe(0);

    // Realtime delivered to User C
    expect(broadcastSpy).toHaveBeenCalledWith(
      userCId,
      orgAId,
      expect.objectContaining({ type: 'rfi.responded', projectId: projAId }),
    );

    broadcastSpy.mockRestore();
  });

  it('respects recipient channel preferences for IN_APP and REALTIME', async () => {
    // Disable REALTIME for User A on billing.entitlement.changed
    await preferenceService.setPreference(
      orgAId,
      userAId,
      'billing.entitlement.changed',
      'REALTIME',
      false,
    );

    const broadcastSpy = vi.spyOn(realtimeDeliveryManager, 'broadcastToUser');

    await processEventNotification('billing.entitlement.changed', {
      organizationId: orgAId,
      subscriptionId: 'sub_123',
    });

    // In-app was still enabled, so notification row exists
    const userANotifs = await notificationService.getRecipientNotifications(orgAId, userAId);
    expect(userANotifs.some((n) => n.eventType === 'billing.entitlement.changed')).toBe(true);

    // Realtime broadcast was suppressed for User A
    expect(broadcastSpy).not.toHaveBeenCalledWith(
      userAId,
      orgAId,
      expect.objectContaining({ type: 'billing.entitlement.changed' }),
    );

    broadcastSpy.mockRestore();
  });

  it('throws an error when organizationId is missing', async () => {
    await expect(
      processEventNotification('billing.subscription.status_changed', {
        organizationId: '',
      }),
    ).rejects.toThrow('organizationId is required');
  });
});
