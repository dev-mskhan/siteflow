import { notificationPreferences, type NotificationPreference } from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';
import { generateId } from '../../../lib/id.js';

export class PreferenceRepository {
  async getPreferences(db: any, organizationId: string, userId: string): Promise<NotificationPreference[]> {
    return db
      .select()
      .from(notificationPreferences)
      .where(and(eq(notificationPreferences.organizationId, organizationId), eq(notificationPreferences.userId, userId)));
  }

  async findPreference(
    db: any,
    organizationId: string,
    userId: string,
    eventType: string,
    channel: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP',
  ): Promise<NotificationPreference | undefined> {
    const rows = await db
      .select()
      .from(notificationPreferences)
      .where(
        and(
          eq(notificationPreferences.organizationId, organizationId),
          eq(notificationPreferences.userId, userId),
          eq(notificationPreferences.eventType, eventType),
          eq(notificationPreferences.channel, channel),
        ),
      )
      .limit(1);

    return rows[0];
  }

  async upsertPreference(
    db: any,
    organizationId: string,
    userId: string,
    eventType: string,
    channel: 'EMAIL' | 'IN_APP' | 'REALTIME' | 'WHATSAPP',
    enabled: boolean,
  ): Promise<NotificationPreference> {
    const existing = await this.findPreference(db, organizationId, userId, eventType, channel);
    const id = existing?.id ?? generateId();

    const rows = await db
      .insert(notificationPreferences)
      .values({
        id,
        organizationId,
        userId,
        eventType,
        channel,
        enabled,
      })
      .onConflictDoUpdate({
        target: [notificationPreferences.organizationId, notificationPreferences.userId, notificationPreferences.eventType, notificationPreferences.channel],
        set: {
          enabled,
          updatedAt: new Date(),
        },
      })
      .returning();

    return rows[0];
  }
}

export const preferenceRepository = new PreferenceRepository();
