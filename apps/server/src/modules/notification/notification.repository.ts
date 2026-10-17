import { notifications, type NotificationRecord, type NewNotificationRecord } from '@siteflow/database/schema';
import { eq, and, desc, isNull, count } from 'drizzle-orm';

export class NotificationRepository {
  async create(db: any, data: NewNotificationRecord): Promise<NotificationRecord> {
    const rows = await db.insert(notifications).values(data).onConflictDoNothing().returning();
    if (rows[0]) return rows[0];
    if (data.eventId) {
      const existing = await db
        .select()
        .from(notifications)
        .where(
          and(
            eq(notifications.organizationId, data.organizationId),
            eq(notifications.recipientId, data.recipientId),
            eq(notifications.eventId, data.eventId),
            eq(notifications.channel, data.channel ?? 'IN_APP'),
          ),
        )
        .limit(1);
      if (existing[0]) return existing[0];
    }
    throw new Error('Notification insert conflicted without a matching idempotent delivery');
  }

  async findByNotificationId(db: any, organizationId: string, id: string): Promise<NotificationRecord | undefined> {
    const rows = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.organizationId, organizationId), eq(notifications.id, id)))
      .limit(1);
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

  async markRead(
    db: any,
    organizationId: string,
    recipientId: string,
    id: string,
  ): Promise<NotificationRecord | undefined> {
    const rows = await db
      .update(notifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(notifications.organizationId, organizationId),
          eq(notifications.recipientId, recipientId),
          eq(notifications.id, id),
        ),
      )
      .returning();
    return rows[0];
  }

  async markAllRead(db: any, organizationId: string, recipientId: string): Promise<number> {
    const rows = await db
      .update(notifications)
      .set({ readAt: new Date(), updatedAt: new Date() })
      .where(
        and(
          eq(notifications.organizationId, organizationId),
          eq(notifications.recipientId, recipientId),
          isNull(notifications.readAt),
        ),
      )
      .returning({ id: notifications.id });
    return rows.length;
  }

  async getUnreadCount(db: any, organizationId: string, recipientId: string): Promise<number> {
    const [row] = await db
      .select({ count: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.organizationId, organizationId),
          eq(notifications.recipientId, recipientId),
          isNull(notifications.readAt),
        ),
      );
    return Number(row?.count ?? 0);
  }
}

export const notificationRepository = new NotificationRepository();
