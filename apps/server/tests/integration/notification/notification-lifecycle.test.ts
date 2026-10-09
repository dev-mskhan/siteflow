import { describe, it, expect } from 'vitest';
import { notificationService } from '../../../src/modules/notification/notification.service.js';

describe('F.4 Notification Core Lifecycle & Tenant Isolation Integration', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const org2Id = `org2_${runId}`;
  const user1Id = `usr1_${runId}`;
  const user2Id = `usr2_${runId}`;

  it('creates notification intent and transitions status safely', async () => {
    const notif = await notificationService.createNotification({
      organizationId: org1Id,
      recipientId: user1Id,
      eventType: 'TaskCompleted',
      channel: 'IN_APP',
      payload: { taskId: `task_${runId}` },
    });

    expect(notif).toBeDefined();
    expect(notif.organizationId).toBe(org1Id);
    expect(notif.recipientId).toBe(user1Id);
    expect(notif.status).toBe('PENDING');

    const delivered = await notificationService.markDelivered(org1Id, notif.id);
    expect(delivered).toBeDefined();
    expect(delivered?.status).toBe('DELIVERED');
    expect(delivered?.deliveredAt).not.toBeNull();
  });

  it('enforces multi-tenant isolation on recipient notifications', async () => {
    await notificationService.createNotification({
      organizationId: org1Id,
      recipientId: user1Id,
      eventType: 'IssueCreated',
      channel: 'EMAIL',
    });

    await notificationService.createNotification({
      organizationId: org2Id,
      recipientId: user2Id,
      eventType: 'IssueCreated',
      channel: 'EMAIL',
    });

    const org1Notifs = await notificationService.getRecipientNotifications(org1Id, user1Id);
    const org2Notifs = await notificationService.getRecipientNotifications(org2Id, user2Id);

    expect(org1Notifs.length).toBeGreaterThanOrEqual(1);
    expect(org1Notifs.every((n) => n.organizationId === org1Id)).toBe(true);

    expect(org2Notifs.length).toBeGreaterThanOrEqual(1);
    expect(org2Notifs.every((n) => n.organizationId === org2Id)).toBe(true);

    // Cross-tenant lookup returns empty
    const crossTenant = await notificationService.getRecipientNotifications(org2Id, user1Id);
    expect(crossTenant.length).toBe(0);
  });

  it('rejects creation without organizationId or recipientId', async () => {
    await expect(
      notificationService.createNotification({
        organizationId: '',
        recipientId: user1Id,
        eventType: 'TaskCompleted',
      }),
    ).rejects.toThrow('organizationId is required');

    await expect(
      notificationService.createNotification({
        organizationId: org1Id,
        recipientId: '',
        eventType: 'TaskCompleted',
      }),
    ).rejects.toThrow('recipientId is required');
  });
});
