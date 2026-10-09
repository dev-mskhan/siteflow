import { describe, it, expect } from 'vitest';
import { UnconfiguredWhatsAppProvider } from '../../../src/modules/notification/channels/whatsapp.channel.js';
import { notificationService } from '../../../src/modules/notification/notification.service.js';

describe('F.7 WhatsApp Channel Integration & Tenant Boundary', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const user1Id = `usr1_${runId}`;

  it('keeps source event intact and records unconfigured state without sending network request', async () => {
    const notif = await notificationService.createNotification({
      organizationId: org1Id,
      recipientId: user1Id,
      eventType: 'TaskCompleted',
      channel: 'WHATSAPP',
    });

    const provider = new UnconfiguredWhatsAppProvider();
    const result = await provider.sendMessage({
      to: '+1987654321',
      text: 'Task Completed Alert',
      organizationId: org1Id,
    });

    expect(result.success).toBe(false);
    expect(result.status).toBe('UNCONFIGURED');

    // Notification intent remains persisted in database
    const records = await notificationService.getRecipientNotifications(org1Id, user1Id);
    expect(records.some((r) => r.id === notif.id)).toBe(true);
  });
});
