import { trace } from '@opentelemetry/api';
import { withSpan } from '@siteflow/observability/server';
import { sql } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { partnerPerformanceEvents } from '@siteflow/database/schema';

const tracer = trace.getTracer('performance-service');

export class PartnerPerformanceService {
  private get db() {
    return getDb();
  }

  /**
   * Idempotently records a partner performance fact inside an existing transaction.
   * The unique index on (sourceType, sourceId, eventType, supplierId, subcontractorId)
   * silently absorbs duplicate inserts from worker retries.
   */
  async recordEvent(
    tx: any,
    args: {
      organizationId: string;
      projectId?: string;
      partnerType: 'SUPPLIER' | 'SUBCONTRACTOR';
      supplierId?: string;
      subcontractorId?: string;
      sourceType: string;
      sourceId: string;
      eventType: string;
      occurredAt: Date;
      metricValue?: string | null;
      unit?: string | null;
      notes?: string | null;
    },
  ): Promise<void> {
    return withSpan(tracer, 'performance.record', async () => {
      try {
        await tx.insert(partnerPerformanceEvents).values({
          id: generateId(),
          organizationId: args.organizationId,
          projectId: args.projectId ?? null,
          partnerType: args.partnerType,
          supplierId: args.supplierId ?? null,
          subcontractorId: args.subcontractorId ?? null,
          sourceType: args.sourceType,
          sourceId: args.sourceId,
          eventType: args.eventType,
          occurredAt: args.occurredAt,
          metricValue: args.metricValue ?? null,
          unit: args.unit ?? null,
          notes: args.notes ?? null,
        });
      } catch (err: any) {
        // Unique constraint = already recorded — idempotent no-op
        if (err?.code === '23505' || err?.message?.includes('unique')) return;
        throw err;
      }
    });
  }

  async listSupplierEvents(
    organizationId: string,
    projectId: string,
    supplierId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ data: any[]; nextCursor: string | null }> {
    return withSpan(tracer, 'performance.list-supplier', async () => {
      const limit = Math.min(opts.limit ?? 50, 100);
      const fetchLimit = limit + 1;

      let cursorFilter = sql``;
      if (opts.cursor) {
        try {
          const { occurredAt, id } = JSON.parse(Buffer.from(opts.cursor, 'base64').toString());
          cursorFilter = sql` AND (occurred_at < ${occurredAt} OR (occurred_at = ${occurredAt} AND id < ${id}))`;
        } catch {
          // ignore invalid cursor
        }
      }

      const rows = await this.db.execute(
        sql`SELECT id, event_type, source_type, source_id, occurred_at, metric_value, unit, notes
            FROM app.partner_performance_events
            WHERE organization_id = ${organizationId}
              AND project_id = ${projectId}
              AND supplier_id = ${supplierId}
              ${cursorFilter}
            ORDER BY occurred_at DESC, id DESC LIMIT ${fetchLimit}`,
      ) as any;

      const raw: any[] = rows.rows ?? rows;
      const hasMore = raw.length > limit;
      const data = hasMore ? raw.slice(0, limit) : raw;
      const last = data[data.length - 1];
      const nextCursor: string | null =
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ occurredAt: last.occurred_at, id: last.id }),
            ).toString('base64')
          : null;

      return {
        data: data.map((r: any) => ({
          id: r.id,
          eventType: r.event_type,
          sourceType: r.source_type,
          sourceId: r.source_id,
          occurredAt: r.occurred_at,
          metricValue: r.metric_value,
          unit: r.unit,
          notes: r.notes,
        })),
        nextCursor,
      };
    });
  }

  async listSubcontractorEvents(
    organizationId: string,
    projectId: string,
    subcontractorId: string,
    opts: { cursor?: string; limit?: number } = {},
  ): Promise<{ data: any[]; nextCursor: string | null }> {
    return withSpan(tracer, 'performance.list-subcontractor', async () => {
      const limit = Math.min(opts.limit ?? 50, 100);
      const fetchLimit = limit + 1;

      let cursorFilter = sql``;
      if (opts.cursor) {
        try {
          const { occurredAt, id } = JSON.parse(Buffer.from(opts.cursor, 'base64').toString());
          cursorFilter = sql` AND (occurred_at < ${occurredAt} OR (occurred_at = ${occurredAt} AND id < ${id}))`;
        } catch {
          // ignore invalid cursor
        }
      }

      const rows = await this.db.execute(
        sql`SELECT id, event_type, source_type, source_id, occurred_at, metric_value, unit, notes
            FROM app.partner_performance_events
            WHERE organization_id = ${organizationId}
              AND project_id = ${projectId}
              AND subcontractor_id = ${subcontractorId}
              ${cursorFilter}
            ORDER BY occurred_at DESC, id DESC LIMIT ${fetchLimit}`,
      ) as any;

      const raw: any[] = rows.rows ?? rows;
      const hasMore = raw.length > limit;
      const data = hasMore ? raw.slice(0, limit) : raw;
      const last = data[data.length - 1];
      const nextCursor: string | null =
        hasMore && last
          ? Buffer.from(
              JSON.stringify({ occurredAt: last.occurred_at, id: last.id }),
            ).toString('base64')
          : null;

      return {
        data: data.map((r: any) => ({
          id: r.id,
          eventType: r.event_type,
          sourceType: r.source_type,
          sourceId: r.source_id,
          occurredAt: r.occurred_at,
          metricValue: r.metric_value,
          unit: r.unit,
          notes: r.notes,
        })),
        nextCursor,
      };
    });
  }
}

export const partnerPerformanceService = new PartnerPerformanceService();
