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
        sql`SELECT id, organization_id, project_id, partner_type, supplier_id,
                   subcontractor_id, event_type, source_type, source_id, occurred_at,
                   metric_value, unit, notes, created_at
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
              JSON.stringify({ occurredAt: last.occurredAt, id: last.id }),
            ).toString('base64')
          : null;

      return {
        data: data.map((r: any) => ({
          id: r.id,
          organizationId: r.organizationId,
          projectId: r.projectId,
          partnerType: r.partnerType,
          supplierId: r.supplierId,
          subcontractorId: r.subcontractorId,
          eventType: r.eventType,
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          occurredAt: r.occurredAt,
          metricValue: r.metricValue === null ? null : Number(r.metricValue),
          unit: r.unit,
          notes: r.notes,
          createdAt: r.createdAt,
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
        sql`SELECT id, organization_id, project_id, partner_type, supplier_id,
                   subcontractor_id, event_type, source_type, source_id, occurred_at,
                   metric_value, unit, notes, created_at
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
              JSON.stringify({ occurredAt: last.occurredAt, id: last.id }),
            ).toString('base64')
          : null;

      return {
        data: data.map((r: any) => ({
          id: r.id,
          organizationId: r.organizationId,
          projectId: r.projectId,
          partnerType: r.partnerType,
          supplierId: r.supplierId,
          subcontractorId: r.subcontractorId,
          eventType: r.eventType,
          sourceType: r.sourceType,
          sourceId: r.sourceId,
          occurredAt: r.occurredAt,
          metricValue: r.metricValue === null ? null : Number(r.metricValue),
          unit: r.unit,
          notes: r.notes,
          createdAt: r.createdAt,
        })),
        nextCursor,
      };
    });
  }
}

export const partnerPerformanceService = new PartnerPerformanceService();
