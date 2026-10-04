import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { Decimal } from 'decimal.js';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { documentNumberService } from '../../procurement/document-number/document-number.service.js';
import { SupplierService } from '../../supplier/supplier.service.js';
import { PurchaseOrderRepository } from './purchase-order.repository.js';
import {
  PurchaseOrderNotFoundError,
  PurchaseOrderInvalidStateError,
  PurchaseOrderImmutableFieldError,
} from './purchase-order.errors.js';
import type {
  PurchaseOrderDTO,
  PurchaseOrderItemDTO,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
  ListPurchaseOrdersQuery,
  POItemInput,
} from './purchase-order.types.js';
import type { PurchaseOrder, PurchaseOrderItem } from '@siteflow/database/schema';

const tracer = trace.getTracer('purchase-order-service');
const supplierService = new SupplierService();

function currentYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function computeLineTotals(item: POItemInput): { lineSubtotal: string; lineTotal: string } {
  const qty = new Decimal(item.quantity);
  const up = new Decimal(item.unitPrice);
  const disc = new Decimal(item.discountAmount ?? '0');
  const tax = new Decimal(item.taxAmount ?? '0');
  const lineSubtotal = qty.mul(up).toDecimalPlaces(2);
  const lineTotal = lineSubtotal.minus(disc).plus(tax).toDecimalPlaces(2);
  return { lineSubtotal: lineSubtotal.toFixed(2), lineTotal: lineTotal.toFixed(2) };
}

function computeDocumentTotals(
  items: Array<{ lineSubtotal: string; discountAmount: string; taxAmount: string }>,
): { subtotal: string; discountAmount: string; taxAmount: string; totalAmount: string } {
  let sub = new Decimal(0);
  let disc = new Decimal(0);
  let tax = new Decimal(0);
  for (const i of items) {
    sub = sub.plus(i.lineSubtotal);
    disc = disc.plus(i.discountAmount);
    tax = tax.plus(i.taxAmount);
  }
  return {
    subtotal: sub.toFixed(2),
    discountAmount: disc.toFixed(2),
    taxAmount: tax.toFixed(2),
    totalAmount: sub.minus(disc).plus(tax).toFixed(2),
  };
}

function toItemDTO(row: PurchaseOrderItem): PurchaseOrderItemDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    purchaseOrderId: row.purchaseOrderId,
    materialId: row.materialId,
    description: row.description ?? null,
    quantity: row.quantity,
    unitCode: row.unitCode,
    unitPrice: row.unitPrice,
    discountAmount: row.discountAmount,
    taxAmount: row.taxAmount,
    lineSubtotal: row.lineSubtotal,
    lineTotal: row.lineTotal,
    materialRequestItemId: row.materialRequestItemId ?? null,
    sourceQuoteItemId: row.sourceQuoteItemId ?? null,
    taskId: row.taskId ?? null,
    phaseId: row.phaseId ?? null,
    costCodeId: row.costCodeId ?? null,
    boqLineId: row.boqLineId ?? null,
    expectedDeliveryDate: row.expectedDeliveryDate ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDTO(row: PurchaseOrder, items: PurchaseOrderItem[]): PurchaseOrderDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    poNumber: row.poNumber,
    supplierId: row.supplierId,
    materialRequestId: row.materialRequestId ?? null,
    sourceQuoteId: row.sourceQuoteId ?? null,
    status: row.status as any,
    orderDate: row.orderDate,
    expectedDeliveryDate: row.expectedDeliveryDate ?? null,
    deliveryLocation: row.deliveryLocation ?? null,
    currencyCode: row.currencyCode,
    subtotal: row.subtotal,
    discountAmount: row.discountAmount,
    taxAmount: row.taxAmount,
    totalAmount: row.totalAmount,
    notes: row.notes ?? null,
    createdByMemberId: row.createdByMemberId ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    approvedBy: row.approvedBy ?? null,
    sentAt: row.sentAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    items: items.map(toItemDTO),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Forward declaration stubs — replaced at module init with real committed-cost calls
let notifyCommittedCostCreated: (tx: any, po: PurchaseOrder) => Promise<any> = async () => {};
let notifyCommittedCostCancelled: (
  tx: any,
  poId: string,
  organizationId: string,
  actorUserId: string,
) => Promise<void> = async () => {};

/**
 * Called after module load to wire in the real committed-cost functions,
 * avoiding circular imports.
 */
export function setCommittedCostHooks(
  createFn: (tx: any, po: PurchaseOrder) => Promise<any>,
  cancelFn: (
    tx: any,
    poId: string,
    organizationId: string,
    actorUserId: string,
  ) => Promise<void>,
): void {
  notifyCommittedCostCreated = createFn;
  notifyCommittedCostCancelled = cancelFn;
}

export class PurchaseOrderService {
  constructor(private repo = new PurchaseOrderRepository()) {}

  private get db() {
    return getDb();
  }

  async createPurchaseOrder(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreatePurchaseOrderInput,
  ): Promise<PurchaseOrderDTO> {
    return withSpan(tracer, 'purchase-order.create', async (span) => {
      span.setAttributes({ organizationId, projectId });
      return this.db.transaction(async (tx) => {
        await supplierService.findActiveById(tx as any, organizationId, input.supplierId);

        const poNumber = await documentNumberService.allocateDocumentNumber(
          tx,
          organizationId,
          projectId,
          'PO',
          currentYYYYMM(),
        );

        const computedItems = input.items.map((item) => {
          const { lineSubtotal, lineTotal } = computeLineTotals(item);
          return {
            id: generateId(),
            organizationId,
            purchaseOrderId: '',
            materialId: item.materialId,
            description: item.description ?? null,
            quantity: item.quantity,
            unitCode: item.unitCode.toUpperCase(),
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount ?? '0.00',
            taxAmount: item.taxAmount ?? '0.00',
            lineSubtotal,
            lineTotal,
            materialRequestItemId: item.materialRequestItemId ?? null,
            sourceQuoteItemId: item.sourceQuoteItemId ?? null,
            taskId: item.taskId ?? null,
            phaseId: item.phaseId ?? null,
            costCodeId: item.costCodeId ?? null,
            boqLineId: item.boqLineId ?? null,
            expectedDeliveryDate: item.expectedDeliveryDate ?? null,
          };
        });
        const docTotals = computeDocumentTotals(computedItems);

        const id = generateId();
        const row = await this.repo.create(tx as any, {
          id,
          organizationId,
          projectId,
          poNumber,
          supplierId: input.supplierId,
          materialRequestId: input.materialRequestId ?? null,
          sourceQuoteId: input.sourceQuoteId ?? null,
          orderDate: input.orderDate,
          expectedDeliveryDate: input.expectedDeliveryDate ?? null,
          deliveryLocation: input.deliveryLocation ?? null,
          currencyCode: input.currencyCode,
          notes: input.notes ?? null,
          ...docTotals,
        });

        const itemsWithPoId = computedItems.map((i) => ({ ...i, purchaseOrderId: id }));
        const items = await this.repo.createItems(tx as any, itemsWithPoId);

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'purchase_order.created',
            resourceType: 'PurchaseOrder',
            resourceId: id,
            metadata: { projectId, poNumber },
          },
          tx,
        );
        return toDTO(row, items);
      });
    });
  }

  async getPurchaseOrder(
    organizationId: string,
    projectId: string,
    poId: string,
  ): Promise<PurchaseOrderDTO> {
    return withSpan(tracer, 'purchase-order.get', async (span) => {
      span.setAttributes({ organizationId, projectId, poId });
      const row = await this.repo.findById(this.db, poId);
      if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
        throw new PurchaseOrderNotFoundError(poId);
      }
      const items = await this.repo.findItemsByPoId(this.db, poId);
      return toDTO(row, items);
    });
  }

  async listPurchaseOrders(
    organizationId: string,
    projectId: string,
    query: ListPurchaseOrdersQuery,
  ): Promise<{ data: PurchaseOrderDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'purchase-order.list', async (span) => {
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
      const allItems = await this.repo.findItemsByPoIds(
        this.db,
        data.map((r) => r.id),
      );
      const itemsByPoId = new Map<string, PurchaseOrderItem[]>();
      for (const item of allItems) {
        const arr = itemsByPoId.get(item.purchaseOrderId) ?? [];
        arr.push(item);
        itemsByPoId.set(item.purchaseOrderId, arr);
      }
      const result: PurchaseOrderDTO[] = data.map((row) => toDTO(row, itemsByPoId.get(row.id) ?? []));
      return { data: result, nextCursor };
    });
  }

  async updatePurchaseOrder(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    poId: string,
    input: UpdatePurchaseOrderInput,
  ): Promise<PurchaseOrderDTO> {
    return withSpan(tracer, 'purchase-order.update', async (span) => {
      span.setAttributes({ organizationId, projectId, poId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findById(tx as any, poId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new PurchaseOrderNotFoundError(poId);
        }
        const approvedStatuses = ['APPROVED', 'SENT', 'ACKNOWLEDGED', 'PARTIALLY_RECEIVED', 'RECEIVED'];
        if (approvedStatuses.includes(row.status)) {
          const allowedFields = new Set(['expectedDeliveryDate', 'deliveryLocation', 'notes']);
          const badFields = Object.keys(input).filter(
            (k) => !allowedFields.has(k) && (input as any)[k] !== undefined,
          );
          if (badFields.length) throw new PurchaseOrderImmutableFieldError(badFields[0]!);
        }
        const updated = await this.repo.update(tx as any, poId, input);
        const items = await this.repo.findItemsByPoId(tx as any, poId);
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'purchase_order.updated',
            resourceType: 'PurchaseOrder',
            resourceId: poId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }

  async submitPurchaseOrder(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    poId: string,
  ): Promise<PurchaseOrderDTO> {
    return withSpan(tracer, 'purchase-order.submit', async (span) => {
      span.setAttributes({ organizationId, projectId, poId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findByIdForUpdate(tx, poId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new PurchaseOrderNotFoundError(poId);
        }
        if (row.status !== 'DRAFT') {
          throw new PurchaseOrderInvalidStateError(row.status, 'submit');
        }
        const updated = await this.repo.update(tx as any, poId, { status: 'PENDING_APPROVAL' });
        const items = await this.repo.findItemsByPoId(tx as any, poId);
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'purchase_order.submitted',
            resourceType: 'PurchaseOrder',
            resourceId: poId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }

  async approvePurchaseOrder(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    poId: string,
  ): Promise<PurchaseOrderDTO> {
    return withSpan(tracer, 'purchase-order.approve', async (span) => {
      span.setAttributes({ organizationId, projectId, poId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findByIdForUpdate(tx, poId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new PurchaseOrderNotFoundError(poId);
        }
        // Idempotency
        if (row.status === 'APPROVED') {
          const items = await this.repo.findItemsByPoId(tx as any, poId);
          return toDTO(row, items);
        }
        if (row.status !== 'PENDING_APPROVAL') {
          throw new PurchaseOrderInvalidStateError(row.status, 'approve');
        }
        const updated = await this.repo.update(tx as any, poId, {
          status: 'APPROVED',
          approvedAt: new Date(),
          approvedBy: actorUserId,
        });
        await notifyCommittedCostCreated(tx, updated);
        const items = await this.repo.findItemsByPoId(tx as any, poId);
        await writeOutboxEvent(
          tx,
          'procurement.purchase_order.approved',
          { organizationId, projectId, poId },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'purchase_order.approved',
            resourceType: 'PurchaseOrder',
            resourceId: poId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }

  async sendPurchaseOrder(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    poId: string,
  ): Promise<PurchaseOrderDTO> {
    return withSpan(tracer, 'purchase-order.send', async (span) => {
      span.setAttributes({ organizationId, projectId, poId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findByIdForUpdate(tx, poId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new PurchaseOrderNotFoundError(poId);
        }
        if (row.status !== 'APPROVED') {
          throw new PurchaseOrderInvalidStateError(row.status, 'send');
        }
        const updated = await this.repo.update(tx as any, poId, {
          status: 'SENT',
          sentAt: new Date(),
        });
        const items = await this.repo.findItemsByPoId(tx as any, poId);
        await writeOutboxEvent(
          tx,
          'procurement.purchase_order.sent',
          { organizationId, projectId, poId },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'purchase_order.sent',
            resourceType: 'PurchaseOrder',
            resourceId: poId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }

  async cancelPurchaseOrder(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    poId: string,
  ): Promise<PurchaseOrderDTO> {
    return withSpan(tracer, 'purchase-order.cancel', async (span) => {
      span.setAttributes({ organizationId, projectId, poId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findByIdForUpdate(tx, poId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new PurchaseOrderNotFoundError(poId);
        }
        // Idempotency
        if (row.status === 'CANCELLED') {
          const items = await this.repo.findItemsByPoId(tx as any, poId);
          return toDTO(row, items);
        }
        const cancellable = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SENT'];
        if (!cancellable.includes(row.status)) {
          throw new PurchaseOrderInvalidStateError(row.status, 'cancel');
        }
        const wasApprovedOrSent = ['APPROVED', 'SENT'].includes(row.status);
        const updated = await this.repo.update(tx as any, poId, {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        });
        if (wasApprovedOrSent) {
          await notifyCommittedCostCancelled(tx, poId, organizationId, actorUserId);
        }
        const items = await this.repo.findItemsByPoId(tx as any, poId);
        await writeOutboxEvent(
          tx,
          'procurement.purchase_order.cancelled',
          { organizationId, projectId, poId },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'purchase_order.cancelled',
            resourceType: 'PurchaseOrder',
            resourceId: poId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }
}
