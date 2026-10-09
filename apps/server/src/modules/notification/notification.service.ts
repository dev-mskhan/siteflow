import { getDb } from '../../lib/db/index.js';
import { generateId } from '../../lib/id.js';
import { notificationRepository, NotificationRepository } from './notification.repository.js';
import { type NotificationRecord, type NewNotificationRecord } from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'notification-service' });

export interface CreateNotificationParams {
  organizationId: string;
  projectId?: string | null;
  recipientId: string;
  eventId?: string | null;
  eventType: string;
  channel?: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP';
  templateId?: string | null;
  payload?: Record<string, unknown>;
}

export class NotificationService {
  constructor(private repo: NotificationRepository = notificationRepository) {}

  private get db() {
    return getDb();
  }

  async createNotification(params: CreateNotificationParams): Promise<NotificationRecord> {
    if (!params.organizationId) {
      throw new Error('organizationId is required to create a notification');
    }
    if (!params.recipientId) {
      throw new Error('recipientId is required to create a notification');
    }

    const data: NewNotificationRecord = {
      id: generateId(),
      organizationId: params.organizationId,
      projectId: params.projectId ?? null,
      recipientId: params.recipientId,
      eventId: params.eventId ?? null,
      eventType: params.eventType,
      channel: params.channel ?? 'IN_APP',
      templateId: params.templateId ?? null,
      payload: params.payload ?? {},
      status: 'PENDING',
      retryCount: 0,
    };

    logger.info(
      { notificationId: data.id, organizationId: params.organizationId, recipientId: params.recipientId, eventType: params.eventType },
      'Creating notification record',
    );

    return this.repo.create(this.db, data);
  }

  async getRecipientNotifications(organizationId: string, recipientId: string, limit = 50): Promise<NotificationRecord[]> {
    return this.repo.findByRecipient(this.db, organizationId, recipientId, limit);
  }

  async markDelivered(organizationId: string, id: string): Promise<NotificationRecord | undefined> {
    logger.info({ notificationId: id, organizationId }, 'Marking notification delivered');
    return this.repo.updateStatus(this.db, organizationId, id, 'DELIVERED', null, new Date());
  }

  async markFailed(organizationId: string, id: string, error: string): Promise<NotificationRecord | undefined> {
    logger.error({ notificationId: id, organizationId, error }, 'Marking notification failed');
    return this.repo.updateStatus(this.db, organizationId, id, 'FAILED', error);
  }
}

export const notificationService = new NotificationService();
