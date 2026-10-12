// apps/server/src/modules/platform/platform-diagnostics.service.ts
import { sql } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import { NotFoundError } from '../auth/auth.errors.js';
import { countReminderDeliveriesByStatus } from '../billing/reminder-delivery.repository.js';
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

    const rows = (await getDb().execute(sql`
      SELECT state::text AS "state", COUNT(*)::int AS "count"
      FROM pgboss.job
      WHERE created_on >= now() - make_interval(hours => ${hours})
      GROUP BY state
    `)) as unknown as Array<{ state: string; count: number }>;

    const oldest = (await getDb().execute(sql`
      SELECT EXTRACT(EPOCH FROM (now() - MIN(start_after)))::int AS "ageSeconds"
      FROM pgboss.job
      WHERE state IN ('created', 'retry')
        AND start_after <= now()
        AND created_on >= now() - make_interval(hours => ${hours})
    `)) as unknown as Array<{ ageSeconds: number | null }>;

    const counts = Object.fromEntries(QUEUE_STATES.map((s) => [s, 0])) as QueueDiagnosticsView['counts'];
    for (const row of rows) {
      if (row.state in counts) counts[row.state as keyof QueueDiagnosticsView['counts']] = row.count;
    }

    const inbox = await platformBillingService.getWebhookInboxSummary();

    return {
      windowHours: hours,
      counts,
      oldestWaitingJobAgeSeconds: oldest[0]?.ageSeconds ?? null,
      webhookInbox: inbox.counts,
    };
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
