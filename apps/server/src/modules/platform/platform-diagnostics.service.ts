// apps/server/src/modules/platform/platform-diagnostics.service.ts
import { and, asc, eq, sql } from 'drizzle-orm';
import { outboxEvents } from '@siteflow/database/schema';
import { getDb } from '../../lib/db/index.js';
import { ConflictError, NotFoundError } from '../auth/auth.errors.js';
import { countReminderDeliveriesByStatus } from '../billing/reminder-delivery.repository.js';
import { auditService } from '../audit/audit.service.js';
import { platformBillingService } from './platform-billing.service.js';

export const DIAGNOSTIC_MAX_WINDOW_HOURS = 24;
const QUEUE_STATES = ['created', 'retry', 'active', 'completed', 'cancelled', 'failed'] as const;

export interface HealthView {
  status: 'ok' | 'degraded';
  database: { ok: boolean; latencyMs: number };
  checkedAt: string;
}

export interface QueueDiagnosticsView {
  windowHours: number;
  counts: Record<(typeof QUEUE_STATES)[number], number>;
  oldestWaitingJobAgeSeconds: number | null;
  webhookInbox: Awaited<ReturnType<typeof platformBillingService.getWebhookInboxSummary>>['counts'];
  outbox: {
    failedCount: number;
    oldestFailedAt: string | null;
    failed: Array<{
      id: string;
      eventType: string;
      organizationId: string | null;
      retryCount: number;
      createdAt: string;
    }>;
  };
}

export interface OrganizationDiagnosticsView {
  organizationId: string;
  notificationDeliveries: Record<string, number>;
  storageBytes: number;
}

function clampWindowHours(hours: number): number {
  return Math.min(Math.max(Math.floor(hours), 1), DIAGNOSTIC_MAX_WINDOW_HOURS);
}

export class PlatformDiagnosticsService {
  private queueDiagnosticsCache = new Map<number, { data: QueueDiagnosticsView; expiresAt: number }>();

  async getHealth(): Promise<HealthView> {
    const started = Date.now();
    let ok = true;
    try {
      await getDb().execute(sql`SELECT 1`);
    } catch {
      ok = false;
    }
    const latencyMs = Date.now() - started;
    return {
      status: ok ? 'ok' : 'degraded',
      database: { ok, latencyMs },
      checkedAt: new Date().toISOString(),
    };
  }

  async getQueueDiagnostics(windowHours: number): Promise<QueueDiagnosticsView> {
    const hours = clampWindowHours(windowHours);
    const now = Date.now();
    const cached = this.queueDiagnosticsCache.get(hours);
    if (cached && cached.expiresAt > now) {
      return cached.data;
    }

    // One pgboss scan: the table is partitioned per queue, so planning cost scales with partition count.
    const [rows, inbox, failedOutbox] = await Promise.all([
      getDb().execute(sql`
        SELECT
          state::text AS "state",
          COUNT(*)::int AS "count",
          MIN(start_after) FILTER (WHERE state IN ('created', 'retry') AND start_after <= now()) AS "oldestWaitingAt",
          now() AS "observedAt"
        FROM pgboss.job
        WHERE created_on >= now() - make_interval(hours => ${hours})
        GROUP BY state
      `) as unknown as Promise<
        Array<{ state: string; count: number; oldestWaitingAt: string | Date | null; observedAt: string | Date }>
      >,
      platformBillingService.getWebhookInboxSummary(),
      getDb()
        .select({
          id: outboxEvents.id,
          eventType: outboxEvents.eventType,
          organizationId: outboxEvents.organizationId,
          retryCount: outboxEvents.retryCount,
          createdAt: outboxEvents.createdAt,
        })
        .from(outboxEvents)
        .where(eq(outboxEvents.status, 'FAILED'))
        .orderBy(asc(outboxEvents.createdAt))
        .limit(25),
    ]);

    let failedCount = failedOutbox.length;
    let oldestFailedAt: string | null = failedOutbox[0]?.createdAt
      ? failedOutbox[0].createdAt.toISOString()
      : null;

    if (failedOutbox.length === 25) {
      const failedOutboxSummary = (await getDb().execute(sql`
        SELECT COUNT(*)::int AS "failedCount", MIN(created_at) AS "oldestFailedAt"
        FROM app.outbox_events
        WHERE status = 'FAILED'
      `)) as unknown as Array<{ failedCount: number; oldestFailedAt: string | Date | null }>;
      failedCount = Number(failedOutboxSummary[0]?.failedCount ?? 25);
      oldestFailedAt = failedOutboxSummary[0]?.oldestFailedAt
        ? new Date(failedOutboxSummary[0].oldestFailedAt).toISOString()
        : null;
    }

    const counts = Object.fromEntries(QUEUE_STATES.map((s) => [s, 0])) as QueueDiagnosticsView['counts'];
    let oldestWaitingMs: number | null = null;
    let observedMs = Date.now();
    for (const row of rows) {
      if (row.state in counts) counts[row.state as keyof QueueDiagnosticsView['counts']] = row.count;
      if (row.oldestWaitingAt !== null) {
        const waitingMs = new Date(row.oldestWaitingAt).getTime();
        oldestWaitingMs = oldestWaitingMs === null ? waitingMs : Math.min(oldestWaitingMs, waitingMs);
        observedMs = new Date(row.observedAt).getTime();
      }
    }
    const oldestWaitingJobAgeSeconds =
      oldestWaitingMs === null ? null : Math.max(0, Math.floor((observedMs - oldestWaitingMs) / 1000));

    const result: QueueDiagnosticsView = {
      windowHours: hours,
      counts,
      oldestWaitingJobAgeSeconds,
      webhookInbox: inbox.counts,
      outbox: {
        failedCount,
        oldestFailedAt,
        failed: failedOutbox.map((event) => ({
          id: event.id,
          eventType: event.eventType,
          organizationId: event.organizationId,
          retryCount: event.retryCount,
          createdAt: event.createdAt.toISOString(),
        })),
      },
    };

    this.queueDiagnosticsCache.set(hours, { data: result, expiresAt: now + 1000 });
    return result;
  }

  async replayFailedOutboxEvent(eventId: string, actorUserId: string): Promise<void> {
    await getDb().transaction(async (tx) => {
      const [event] = await tx
        .select({
          id: outboxEvents.id,
          organizationId: outboxEvents.organizationId,
          eventType: outboxEvents.eventType,
        })
        .from(outboxEvents)
        .where(and(eq(outboxEvents.id, eventId), eq(outboxEvents.status, 'FAILED')))
        .for('update');
      if (!event) throw new ConflictError('Outbox event is not failed or has already been replayed');

      await tx
        .update(outboxEvents)
        .set({ status: 'PENDING', retryCount: 0, lastError: null, updatedAt: new Date() })
        .where(and(eq(outboxEvents.id, eventId), eq(outboxEvents.status, 'FAILED')));
      await auditService.log(
        {
          organizationId: event.organizationId,
          actorUserId,
          action: 'platform.outbox.replayed',
          resourceType: 'outbox_event',
          resourceId: event.id,
          metadata: { eventType: event.eventType },
        },
        tx,
      );
      await tx.execute(sql`NOTIFY siteflow_outbox`);
    });
    this.queueDiagnosticsCache.clear();
  }

  async getOrganizationDiagnostics(organizationId: string): Promise<OrganizationDiagnosticsView> {
    const exists = (await getDb().execute(
      sql`SELECT 1 FROM app.organizations WHERE id = ${organizationId} LIMIT 1`,
    )) as unknown as unknown[];
    if (exists.length === 0) {
      throw new NotFoundError('Organization not found');
    }

    const [notificationDeliveries, storage] = await Promise.all([
      countReminderDeliveriesByStatus(organizationId),
      getDb().execute(sql`
        SELECT (
          COALESCE((SELECT SUM(file_size) FROM app.documents WHERE organization_id = ${organizationId}), 0)
          + COALESCE((SELECT SUM(file_size) FROM app.document_versions WHERE organization_id = ${organizationId}), 0)
        )::bigint AS "storageBytes"
      `),
    ]);

    const storageRow = (storage as unknown as Array<{ storageBytes: string | number }>)[0];

    return {
      organizationId,
      notificationDeliveries,
      storageBytes: Number(storageRow?.storageBytes ?? 0),
    };
  }
}

export const platformDiagnosticsService = new PlatformDiagnosticsService();
