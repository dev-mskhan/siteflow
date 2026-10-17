import type PgBoss from 'pg-boss';
import { and, eq } from 'drizzle-orm';
import {
  organizationMemberships,
  organizations,
  projectMembers,
  roles,
  users,
} from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';
import { getDb } from '../../lib/db/index.js';
import { registerWorker } from '../../lib/queue/worker-factory.js';
import { notificationService } from './notification.service.js';
import { preferenceService } from './preferences/preference.service.js';
import { realtimeDeliveryManager } from './realtime/realtime.delivery.js';
import { processEmailNotificationJob } from './email/email.worker.js';
import { NOTIFICATION_EVENT_QUEUES } from './notification.jobs.js';

const logger = createLogger({ name: 'event-notification-worker' });

const NOTIFICATION_EVENTS = Object.values(NOTIFICATION_EVENT_QUEUES);

export interface EventNotificationPayload {
  organizationId: string;
  outboxEventId?: string;
  projectId?: string;
  rfiId?: string;
  submittalId?: string;
  subscriptionId?: string;
  toStatus?: string;
}

interface Recipient {
  userId: string;
  email: string | null;
}

async function getOrgAdminsAndOwner(organizationId: string): Promise<Recipient[]> {
  const db = getDb();
  const [organization] = await db
    .select({ ownerId: organizations.createdBy })
    .from(organizations)
    .where(eq(organizations.id, organizationId))
    .limit(1);
  if (!organization) return [];

  const admins = await db
    .select({ userId: users.id, email: users.email })
    .from(organizationMemberships)
    .innerJoin(users, eq(users.id, organizationMemberships.userId))
    .innerJoin(roles, eq(roles.id, organizationMemberships.roleId))
    .where(
      and(
        eq(organizationMemberships.organizationId, organizationId),
        eq(organizationMemberships.status, 'ACTIVE'),
        eq(roles.name, 'Organization Admin'),
      ),
    );
  const [owner] = await db
    .select({ userId: users.id, email: users.email })
    .from(users)
    .where(eq(users.id, organization.ownerId))
    .limit(1);
  return [...new Map([...admins, ...(owner ? [owner] : [])].map((recipient) => [recipient.userId, recipient])).values()];
}

async function getProjectMembers(organizationId: string, projectId: string): Promise<Recipient[]> {
  return getDb()
    .select({ userId: users.id, email: users.email })
    .from(projectMembers)
    .innerJoin(users, eq(users.id, projectMembers.userId))
    .where(
      and(
        eq(projectMembers.organizationId, organizationId),
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.status, 'ACTIVE'),
      ),
    );
}

function eventDescription(eventType: string): string {
  switch (eventType) {
    case 'platform.organization.suspended':
      return 'Your organization has been suspended.';
    case 'platform.organization.reactivated':
      return 'Your organization has been reactivated.';
    case 'billing.subscription.status_changed':
      return 'Your organization subscription status changed.';
    case 'billing.entitlement.changed':
      return 'Your organization subscription entitlements changed.';
    case 'billing.grace.started':
      return 'Your organization subscription entered its billing grace period.';
    case 'billing.grace.ended':
      return 'Your organization subscription billing grace period ended.';
    case 'rfi.responded':
      return 'An RFI received a response.';
    case 'submittal.reviewed':
      return 'A submittal was reviewed.';
    default:
      return 'Your organization has a new update.';
  }
}

export async function processEventNotification(
  eventType: (typeof NOTIFICATION_EVENTS)[number],
  data: EventNotificationPayload,
): Promise<void> {
  if (!data.organizationId) throw new Error(`organizationId is required for ${eventType}`);
  const recipients =
    data.projectId && (eventType === 'rfi.responded' || eventType === 'submittal.reviewed')
      ? await getProjectMembers(data.organizationId, data.projectId)
      : await getOrgAdminsAndOwner(data.organizationId);
  const eventId = data.outboxEventId ?? null;
  const description = eventDescription(eventType);
  const realtimeEvent = {
    type: eventType,
    organizationId: data.organizationId,
    ...(data.projectId ? { projectId: data.projectId } : {}),
    ...(data.rfiId ? { rfiId: data.rfiId } : {}),
    ...(data.submittalId ? { submittalId: data.submittalId } : {}),
    ...(data.subscriptionId ? { subscriptionId: data.subscriptionId } : {}),
    ...(data.toStatus ? { status: data.toStatus } : {}),
  };

  for (const recipient of recipients) {
    if (await preferenceService.isChannelEnabled(data.organizationId, recipient.userId, eventType, 'IN_APP')) {
      await notificationService.createNotification({
        organizationId: data.organizationId,
        recipientId: recipient.userId,
        eventId,
        eventType,
        channel: 'IN_APP',
        projectId: data.projectId ?? null,
        payload: realtimeEvent,
      });
    }
    if (await preferenceService.isChannelEnabled(data.organizationId, recipient.userId, eventType, 'REALTIME')) {
      realtimeDeliveryManager.broadcastToUser(recipient.userId, data.organizationId, realtimeEvent);
    }
    if (
      recipient.email &&
      (eventType === 'platform.organization.suspended' || eventType === 'platform.organization.reactivated')
    ) {
      const emailNotice = await notificationService.createNotification({
        organizationId: data.organizationId,
        recipientId: recipient.userId,
        eventId,
        eventType,
        channel: 'EMAIL',
        payload: { message: description },
      });
      await processEmailNotificationJob({
        notificationId: emailNotice.id,
        organizationId: data.organizationId,
        recipientEmail: recipient.email,
        eventType,
        payload: { message: description },
      });
    }
  }

  logger.info({ organizationId: data.organizationId, eventType, recipientCount: recipients.length }, 'Event notifications processed');
}

export async function registerEventNotificationWorkers(boss: PgBoss): Promise<void> {
  for (const eventType of NOTIFICATION_EVENTS) {
    await registerWorker<EventNotificationPayload>(
      boss,
      { queue: eventType, concurrency: 5, timeoutSecs: 30 },
      async (job) => processEventNotification(eventType, job.data),
    );
  }
}
