import { describe, it, expect } from 'vitest';
import { processEmailNotificationJob } from '../../../src/modules/notification/email/email.worker.js';
import { notificationService } from '../../../src/modules/notification/notification.service.js';
import { type EmailProvider } from '../../../src/modules/notification/email/email.provider.js';

describe('F.5 Email Notification Delivery Integration', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const user1Id = `usr1_${runId}`;

  class MockEmailProvider implements EmailProvider {
    public sentCount = 0;
    public lastParams: any = null;

    async sendEmail(params: any): Promise<{ messageId: string; previewUrl?: string | false }> {
      this.sentCount++;
      this.lastParams = params;
      return { messageId: `msg_${runId}_${this.sentCount}` };
    }
  }

  it('renders template, calls provider outside transaction, and marks notification delivered', async () => {
    const notif = await notificationService.createNotification({
      organizationId: org1Id,
      recipientId: user1Id,
      eventType: 'TaskCompleted',
      channel: 'EMAIL',
      payload: { taskTitle: 'Install Foundation Structural Steel' },
    });

    const mockProvider = new MockEmailProvider();

    const result = await processEmailNotificationJob(
      {
        notificationId: notif.id,
        organizationId: org1Id,
        recipientEmail: 'siteadmin@siteflow.dev',
        eventType: 'TaskCompleted',
        payload: { taskTitle: 'Install Foundation Structural Steel' },
      },
      mockProvider,
    );

    expect(result.success).toBe(true);
    expect(mockProvider.sentCount).toBe(1);
    expect(mockProvider.lastParams.to).toBe('siteadmin@siteflow.dev');
    expect(mockProvider.lastParams.organizationId).toBe(org1Id);

    // Verify durable delivered status
    const updated = await notificationService.getRecipientNotifications(org1Id, user1Id);
    const target = updated.find((n) => n.id === notif.id);
    expect(target).toBeDefined();
    expect(target?.status).toBe('DELIVERED');
  });

  it('marks notification status FAILED when provider throws an error', async () => {
    const notif = await notificationService.createNotification({
      organizationId: org1Id,
      recipientId: user1Id,
      eventType: 'IssueCreated',
      channel: 'EMAIL',
    });

    const failingProvider: EmailProvider = {
      sendEmail: async () => {
        throw new Error('SMTP Connection Timeout');
      },
    };

    await expect(
      processEmailNotificationJob(
        {
          notificationId: notif.id,
          organizationId: org1Id,
          recipientEmail: 'siteadmin@siteflow.dev',
          eventType: 'IssueCreated',
        },
        failingProvider,
      ),
    ).rejects.toThrow('SMTP Connection Timeout');

    const updated = await notificationService.getRecipientNotifications(org1Id, user1Id);
    const target = updated.find((n) => n.id === notif.id);
    expect(target).toBeDefined();
    expect(target?.status).toBe('FAILED');
    expect(target?.lastError).toContain('SMTP Connection Timeout');
  });

  it('enforces tenant context on worker job data', async () => {
    const mockProvider = new MockEmailProvider();
    await expect(
      processEmailNotificationJob(
        {
          notificationId: `notif_${runId}`,
          organizationId: '',
          recipientEmail: 'admin@dev.null',
          eventType: 'TaskCompleted',
        },
        mockProvider,
      ),
    ).rejects.toThrow('organizationId is required');
  });
});
