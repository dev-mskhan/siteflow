import { defaultEmailProvider, type EmailProvider } from './email.provider.js';
import { renderEmailTemplate } from './email.templates.ts';
import { notificationService } from '../notification.service.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'email-worker' });

export interface ProcessEmailJobData {
  notificationId: string;
  organizationId: string;
  recipientEmail: string;
  eventType: string;
  payload?: Record<string, unknown>;
}

export async function processEmailNotificationJob(
  data: ProcessEmailJobData,
  provider: EmailProvider = defaultEmailProvider,
): Promise<{ success: boolean; messageId?: string }> {
  if (!data.organizationId) {
    throw new Error('organizationId is required for tenant email worker job execution');
  }

  logger.info({ notificationId: data.notificationId, organizationId: data.organizationId, recipient: data.recipientEmail }, 'Processing email notification worker job');

  const { subject, html, text } = renderEmailTemplate({
    eventType: data.eventType,
    payload: data.payload ?? {},
  });

  try {
    const result = await provider.sendEmail({
      to: data.recipientEmail,
      subject,
      html,
      text,
      organizationId: data.organizationId,
    });

    await notificationService.markDelivered(data.organizationId, data.notificationId);
    return { success: true, messageId: result.messageId };
  } catch (err: any) {
    const errorMsg = err?.message || String(err);
    logger.error({ notificationId: data.notificationId, organizationId: data.organizationId, error: errorMsg }, 'Email notification send failed');
    await notificationService.markFailed(data.organizationId, data.notificationId, errorMsg);
    throw err;
  }
}
