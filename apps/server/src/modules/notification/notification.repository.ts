import { notifications, type NotificationRecord, type NewNotificationRecord } from '@siteflow/database/schema';
import { eq, and, desc } from 'drizzle-orm';

export class NotificationRepository {
  async create(db: any, data: NewNotificationRecord): Promise<NotificationRecord> {
    const rows = await db.insert(notifications).values(data).returning();
    return rows[0];
  }

  async findById(db: any, organizationId: string, id: string): Promise<NotificationRecord | undefined> {
    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.organizationId, organizationId), eq(notifications.id, id)))
      .limit(1);
    return rows[0];
  }

  async findByRecipient(
    db: any,
    organizationId: string,
    recipientId: string,
    limit = 50,
  ): Promise<NotificationRecord[]> {
    return db
      .select()
      .from(notifications)
      .where(and(eq(notifications.organizationId, organizationId), eq(notifications.recipientId, recipientId)))
      .orderBy(desc(notifications.createdAt))
      .limit(limit);
  }

  async updateStatus(
    db: any,
    organizationId: string,
    id: string,
    status: 'PENDING' | 'DELIVERED' | 'FAILED' | 'CANCELLED',
    lastError?: string | null,
    deliveredAt?: Date | null,
  ): Promise<NotificationRecord | undefined> {
    const updateData: any = {
      status,
      updatedAt: new Date(),
    };

    if (lastError !== undefined) {
      updateData.lastError = lastError;
    }
    if (deliveredAt !== undefined) {
      updateData.deliveredAt = deliveredAt;
    }

    const rows = await db
      .update(notifications)
      .set(updateData)
      .where(and(eq(notifications.organizationId, organizationId), eq(notifications.id, id)))
      .returning();

    return rows[0];
  }
}

export const notificationRepository = new NotificationRepository();
