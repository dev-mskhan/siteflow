import { describe, it, expect } from 'vitest';
import { processOperationsRemindersJob } from '../../../src/modules/project/operations-reminders/operations-reminders.worker.js';
import { notificationService } from '../../../src/modules/notification/notification.service.js';

describe('F.8 Scheduled Operational Reminders & Worker Integration', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const org2Id = `org2_${runId}`;

  it('scans overdue operational entities for tenant and creates notification intents', async () => {
    const mockService: any = {
      scanOverdueRFIs: async (orgId: string) => {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientId: `usr_${runId}`,
          eventType: 'RfiOverdue',
        });
        return 1;
      },
      scanExpiringDocuments: async (orgId: string) => {
        await notificationService.createNotification({
          organizationId: orgId,
          recipientId: `usr_${runId}`,
          eventType: 'DocumentExpiring',
        });
        return 1;
      },
    };

    const result = await processOperationsRemindersJob({ organizationId: org1Id }, mockService);

    expect(result.rfiCount).toBe(1);
    expect(result.docCount).toBe(1);

    const notifs = await notificationService.getRecipientNotifications(org1Id, `usr_${runId}`);
    expect(notifs.length).toBe(2);
    expect(notifs.every((n) => n.organizationId === org1Id)).toBe(true);
  });

  it('rejects worker execution when missing organizationId tenant context', async () => {
    await expect(processOperationsRemindersJob({ organizationId: '' })).rejects.toThrow('organizationId is required');
  });
});
