import { getDb } from '../../../lib/db/index.js';
import { notificationService } from '../../notification/notification.service.js';
import { createLogger } from '@siteflow/observability/server';
import { rfis, documents } from '@siteflow/database/schema';
import { eq, and, lt } from 'drizzle-orm';

const logger = createLogger({ name: 'operations-reminders-service' });

export class OperationsRemindersService {
  private get db() {
    return getDb();
  }

  /**
   * Scans overdue RFIs for a tenant and creates notification intents idempotently.
   */
  async scanOverdueRFIs(organizationId: string): Promise<number> {
    if (!organizationId) {
      throw new Error('organizationId is required for operational reminder scan');
    }

    logger.info({ organizationId }, 'Scanning overdue RFIs for operational reminders');
    const now = new Date();

    const overdueRfis = await this.db
      .select()
      .from(rfis)
      .where(and(eq(rfis.organizationId, organizationId), eq(rfis.status, 'OPEN'), lt(rfis.dueDate, now)));

    let createdCount = 0;
    for (const rfi of overdueRfis) {
      if (rfi.assignedToMemberId) {
        await notificationService.createNotification({
          organizationId,
          projectId: rfi.projectId,
          recipientId: rfi.assignedToMemberId,
          eventId: rfi.id,
          eventType: 'RfiOverdue',
          channel: 'IN_APP',
          payload: { rfiId: rfi.id, subject: rfi.subject, dueDate: rfi.dueDate },
        });
        createdCount++;
      }
    }

    return createdCount;
  }

  /**
   * Scans expiring documents for a tenant and creates notification intents.
   */
  async scanExpiringDocuments(organizationId: string): Promise<number> {
    if (!organizationId) {
      throw new Error('organizationId is required for document expiry scan');
    }

    logger.info({ organizationId }, 'Scanning expiring documents for operational reminders');
    const now = new Date();

    const expiringDocs = await this.db
      .select()
      .from(documents)
      .where(and(eq(documents.organizationId, organizationId), eq(documents.status, 'ACTIVE'), lt(documents.expirationDate, now)));

    let createdCount = 0;
    for (const doc of expiringDocs) {
      await notificationService.createNotification({
        organizationId,
        projectId: doc.projectId,
        recipientId: doc.uploadedByMemberId ?? 'system',
        eventId: doc.id,
        eventType: 'DocumentExpiring',
        channel: 'IN_APP',
        payload: { documentId: doc.id, name: doc.name, expirationDate: doc.expirationDate },
      });
      createdCount++;
    }

    return createdCount;
  }
}

export const operationsRemindersService = new OperationsRemindersService();
