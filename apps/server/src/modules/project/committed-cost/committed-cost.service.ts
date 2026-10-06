import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { CommittedCostRepository } from './committed-cost.repository.js';
import type { CommittedCostDTO, ListCommittedCostsQuery } from './committed-cost.types.js';
import type { CommittedCost, PurchaseOrder } from '@siteflow/database/schema';

const tracer = trace.getTracer('committed-cost-service');

function toDTO(row: CommittedCost, purchaseOrderStatus: string | null = null): CommittedCostDTO {
  const lifecycleStatus =
    row.status === 'CANCELLED'
      ? 'CANCELLED'
      : row.status === 'RELEASED' || purchaseOrderStatus === 'CLOSED'
        ? 'CLOSED'
        : 'APPROVED';
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    sourceType: row.sourceType as 'PURCHASE_ORDER',
    sourceId: row.sourceId,
    supplierId: row.supplierId ?? null,
    purchaseOrderId: row.purchaseOrderId ?? null,
    costCodeId: row.costCodeId ?? null,
    taskId: row.taskId ?? null,
    boqLineId: row.boqLineId ?? null,
    currencyCode: row.currencyCode,
    committedAmount: row.committedAmount,
    status: row.status as CommittedCostDTO['status'],
    lifecycleStatus,
    purchaseOrderStatus,
    committedAt: row.committedAt.toISOString(),
    releasedAt: row.releasedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class CommittedCostService {
  constructor(private repo = new CommittedCostRepository()) {}

  private get db() {
    return getDb();
  }

  /**
   * Called inside the PO approve transaction. Creates committed cost idempotently.
   */
  async createFromPO(tx: any, po: PurchaseOrder): Promise<CommittedCostDTO> {
    return withSpan(tracer, 'committed-cost.create-from-po', async (span) => {
      span.setAttributes({ poId: po.id });
      try {
        const id = generateId();
        const row = await this.repo.create(tx, {
          id,
          organizationId: po.organizationId,
          projectId: po.projectId,
          sourceType: 'PURCHASE_ORDER',
          sourceId: po.id,
          supplierId: po.supplierId,
          purchaseOrderId: po.id,
          currencyCode: po.currencyCode,
          committedAmount: po.totalAmount,
          committedAt: new Date(),
        });
        await writeOutboxEvent(
          tx,
          'procurement.committed_cost.created',
          {
            organizationId: po.organizationId,
            projectId: po.projectId,
            committedCostId: id,
            poId: po.id,
          },
          po.organizationId,
        );
        await auditService.log(
          {
            organizationId: po.organizationId,
            actorUserId: po.approvedBy!,
            action: 'committed_cost.created',
            resourceType: 'CommittedCost',
            resourceId: id,
            metadata: { poId: po.id },
          },
          tx,
        );
        return toDTO(row, 'APPROVED');
      } catch (err: any) {
        // Unique constraint violation = already exists, return existing
        if (err?.code === '23505' || err?.message?.includes('unique')) {
          const existing = await this.repo.findBySource(
            tx,
            po.organizationId,
            'PURCHASE_ORDER',
            po.id,
          );
          if (existing) return toDTO(existing, 'APPROVED');
        }
        throw err;
      }
    });
  }

  /**
   * Called inside the PO cancel transaction. Cancels the committed cost if active.
   */
  async cancelFromPO(
    tx: any,
    poId: string,
    organizationId: string,
    actorUserId: string,
  ): Promise<void> {
    return withSpan(tracer, 'committed-cost.cancel-from-po', async (span) => {
      span.setAttributes({ poId });
      const existing = await this.repo.findBySource(tx, organizationId, 'PURCHASE_ORDER', poId);
      if (!existing || existing.status !== 'ACTIVE') return;
      await this.repo.update(tx, existing.id, { status: 'CANCELLED', releasedAt: new Date() });
      await writeOutboxEvent(
        tx,
        'procurement.committed_cost.cancelled',
        { organizationId, poId, committedCostId: existing.id },
        organizationId,
      );
      await auditService.log(
        {
          organizationId,
          actorUserId,
          action: 'committed_cost.cancelled',
          resourceType: 'CommittedCost',
          resourceId: existing.id,
          metadata: { poId },
        },
        tx,
      );
    });
  }

  async getCommittedCost(
    organizationId: string,
    projectId: string,
    committedCostId: string,
  ): Promise<CommittedCostDTO> {
    return withSpan(tracer, 'committed-cost.get', async (span) => {
      span.setAttributes({ organizationId, projectId, committedCostId });
      const row = await this.repo.findById(this.db, committedCostId);
      if (
        !row ||
        row.organizationId !== organizationId ||
        row.projectId !== projectId
      ) {
        const err = new Error(`Committed cost not found: ${committedCostId}`) as any;
        err.statusCode = 404;
        err.code = 'COMMITTED_COST_NOT_FOUND';
        throw err;
      }
      const [purchaseOrder] = await this.repo.findPurchaseOrderStatuses(
        this.db,
        row.purchaseOrderId ? [row.purchaseOrderId] : [],
      );
      return toDTO(row, purchaseOrder?.status ?? null);
    });
  }

  async listCommittedCosts(
    organizationId: string,
    projectId: string,
    query: ListCommittedCostsQuery,
  ): Promise<{ data: CommittedCostDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'committed-cost.list', async (span) => {
      span.setAttributes({ organizationId, projectId });
      const limit = query.limit ?? 50;
      const rows = await this.repo.listByProject(this.db, organizationId, projectId, {
        cursor: query.cursor,
        limit: limit + 1,
        status: query.status,
      });
      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      let nextCursor: string | null = null;
      if (hasMore && data.length > 0) {
        const last = data[data.length - 1]!;
        nextCursor = Buffer.from(
          JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
        ).toString('base64');
      }
      const purchaseOrderStatuses = await this.repo.findPurchaseOrderStatuses(
        this.db,
        data.flatMap((row) => (row.purchaseOrderId ? [row.purchaseOrderId] : [])),
      );
      const statusById = new Map<string, string>(
        purchaseOrderStatuses.map((purchaseOrder: { id: string; status: string }) => [
          purchaseOrder.id,
          purchaseOrder.status,
        ]),
      );
      return {
        data: data.map((row) =>
          toDTO(row, row.purchaseOrderId ? statusById.get(row.purchaseOrderId) ?? null : null),
        ),
        nextCursor,
      };
    });
  }
}

export const committedCostService = new CommittedCostService();
