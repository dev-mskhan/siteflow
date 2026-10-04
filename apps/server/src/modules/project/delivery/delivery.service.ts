import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { Decimal } from 'decimal.js';
import { sql } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { documentNumberService } from '../../procurement/document-number/document-number.service.js';
import { DeliveryRepository } from './delivery.repository.js';
import {
  DeliveryNotFoundError, DeliveryInvalidStateError, DeliveryResourceOwnershipError,
  ReceiptNotFoundError, ReceiptInvalidStateError, ReceiptQuantityExceedsPoError,
  DeliveryQuantityExceedsPoError, ReceiptQuantityInvariantError,
} from './delivery.errors.js';
import type {
  DeliveryDTO, DeliveryItemDTO, ReceiptDTO, ReceiptItemDTO,
  CreateDeliveryInput, UpdateDeliveryInput, CreateReceiptInput,
  DeliveryStatus, ReceiptStatus,
} from './delivery.types.js';
import type { Delivery, DeliveryItem, Receipt, ReceiptItem } from '@siteflow/database/schema';

const tracer = trace.getTracer('delivery-service');

// Hooks injected from project.routes.ts to avoid circular imports
type RecordReceiptFn = (tx: any, args: { organizationId: string; projectId: string; materialId: string; quantity: string; unitCode: string; sourceId: string }) => Promise<void>;
type ReverseReceiptFn = (tx: any, receiptId: string, orgId: string, projectId: string) => Promise<void>;
type RecordPerfFn = (tx: any, args: any) => Promise<void>;

let _recordReceiptInventory: RecordReceiptFn = async () => {};
let _reverseReceiptInventory: ReverseReceiptFn = async () => {};
let _recordPerformanceEvent: RecordPerfFn = async () => {};

export function setDeliveryHooks(r: RecordReceiptFn, v: ReverseReceiptFn, p: RecordPerfFn) {
  _recordReceiptInventory = r;
  _reverseReceiptInventory = v;
  _recordPerformanceEvent = p;
}

function yyyymm() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function toDeliveryItemDTO(r: DeliveryItem): DeliveryItemDTO {
  return {
    id: r.id,
    organizationId: r.organizationId,
    deliveryId: r.deliveryId,
    purchaseOrderItemId: r.purchaseOrderItemId,
    quantity: r.quantity,
    unitCode: r.unitCode,
    notes: r.notes ?? null,
  };
}

function toDeliveryDTO(r: Delivery, items: DeliveryItem[]): DeliveryDTO {
  return {
    id: r.id,
    organizationId: r.organizationId,
    projectId: r.projectId,
    purchaseOrderId: r.purchaseOrderId,
    deliveryNumber: r.deliveryNumber,
    status: r.status as DeliveryStatus,
    scheduledDate: r.scheduledDate ?? null,
    actualDeliveryDate: r.actualDeliveryDate ?? null,
    supplierReference: r.supplierReference ?? null,
    carrier: r.carrier ?? null,
    trackingReference: r.trackingReference ?? null,
    notes: r.notes ?? null,
    items: items.map(toDeliveryItemDTO),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

function toReceiptItemDTO(r: ReceiptItem): ReceiptItemDTO {
  return {
    id: r.id,
    organizationId: r.organizationId,
    receiptId: r.receiptId,
    purchaseOrderItemId: r.purchaseOrderItemId,
    quantityDelivered: r.quantityDelivered,
    quantityAccepted: r.quantityAccepted,
    quantityRejected: r.quantityRejected,
    unitCode: r.unitCode,
    rejectionReason: r.rejectionReason ?? null,
    condition: r.condition ?? null,
    notes: r.notes ?? null,
  };
}

function toReceiptDTO(r: Receipt, items: ReceiptItem[]): ReceiptDTO {
  return {
    id: r.id,
    organizationId: r.organizationId,
    projectId: r.projectId,
    purchaseOrderId: r.purchaseOrderId,
    deliveryId: r.deliveryId ?? null,
    receiptNumber: r.receiptNumber,
    status: r.status as ReceiptStatus,
    receivedAt: r.receivedAt.toISOString(),
    receivedByMemberId: r.receivedByMemberId ?? null,
    notes: r.notes ?? null,
    items: items.map(toReceiptItemDTO),
    createdAt: r.createdAt.toISOString(),
  };
}

export class DeliveryService {
  constructor(private repo = new DeliveryRepository()) {}
  private get db() { return getDb(); }

  async createDelivery(actorUserId: string, organizationId: string, projectId: string, input: CreateDeliveryInput): Promise<DeliveryDTO> {
    return withSpan(tracer, 'delivery.create', async (span) => {
      span.setAttributes({ organizationId, projectId });
      return this.db.transaction(async (tx) => {
        const purchaseOrder = await this.repo.findPurchaseOrderById(tx as any, input.purchaseOrderId);
        if (
          !purchaseOrder ||
          purchaseOrder.organizationId !== organizationId ||
          purchaseOrder.projectId !== projectId
        ) {
          throw new DeliveryResourceOwnershipError();
        }
        if (purchaseOrder.status !== 'SENT' && purchaseOrder.status !== 'ACKNOWLEDGED') {
          throw new DeliveryInvalidStateError(purchaseOrder.status, 'schedule');
        }
        const deliveryNumber = await documentNumberService.allocateDocumentNumber(tx, organizationId, projectId, 'DL', yyyymm());
        for (const item of input.items) {
          const poItem = await this.repo.findPoItemById(tx as any, item.purchaseOrderItemId);
          if (
            !poItem ||
            poItem.organizationId !== organizationId ||
            poItem.purchaseOrderId !== input.purchaseOrderId
          ) {
            throw new DeliveryResourceOwnershipError();
          }
          const alreadyDelivered = await this.repo.sumDeliveredQty(tx as any, item.purchaseOrderItemId);
          if (new Decimal(alreadyDelivered).plus(item.quantity).gt(poItem.quantity)) throw new DeliveryQuantityExceedsPoError();
        }
        const id = generateId();
        const row = await this.repo.createDelivery(tx as any, {
          id, organizationId, projectId, purchaseOrderId: input.purchaseOrderId,
          deliveryNumber,
          scheduledDate: input.scheduledDate ?? null,
          supplierReference: input.supplierReference ?? null,
          carrier: input.carrier ?? null,
          trackingReference: input.trackingReference ?? null,
          notes: input.notes ?? null,
        });
        const itemsData = input.items.map(i => ({
          id: generateId(), organizationId, deliveryId: id,
          purchaseOrderItemId: i.purchaseOrderItemId,
          quantity: i.quantity,
          unitCode: i.unitCode.toUpperCase(),
          notes: i.notes ?? null,
        }));
        const items = await this.repo.createDeliveryItems(tx as any, itemsData);
        await auditService.log({ organizationId, actorUserId, action: 'delivery.created', resourceType: 'Delivery', resourceId: id, metadata: { projectId } }, tx);
        return toDeliveryDTO(row, items);
      });
    });
  }

  async getDelivery(organizationId: string, projectId: string, deliveryId: string): Promise<DeliveryDTO> {
    return withSpan(tracer, 'delivery.get', async (span) => {
      span.setAttributes({ organizationId, projectId, deliveryId });
      const row = await this.repo.findDeliveryById(this.db, deliveryId);
      if (!row || row.organizationId !== organizationId || row.projectId !== projectId) throw new DeliveryNotFoundError(deliveryId);
      const items = await this.repo.findDeliveryItemsByDeliveryId(this.db, deliveryId);
      return toDeliveryDTO(row, items);
    });
  }

  async listDeliveries(organizationId: string, projectId: string, query: { cursor?: string; limit?: number }): Promise<{ data: DeliveryDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'delivery.list', async (span) => {
      span.setAttributes({ organizationId, projectId });
      const limit = query.limit ?? 50;
      const rows = await this.repo.listDeliveries(this.db, organizationId, projectId, { cursor: query.cursor, limit: limit + 1 });
      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      let nextCursor: string | null = null;
      if (hasMore && data.length > 0) {
        const last = data[data.length - 1]!;
        nextCursor = Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString('base64');
      }
      const allItems = await this.repo.findDeliveryItemsByDeliveryIds(
        this.db,
        data.map((r) => r.id),
      );
      const itemsByDeliveryId = new Map<string, DeliveryItem[]>();
      for (const item of allItems) {
        const arr = itemsByDeliveryId.get(item.deliveryId) ?? [];
        arr.push(item);
        itemsByDeliveryId.set(item.deliveryId, arr);
      }
      const result: DeliveryDTO[] = data.map((row) =>
        toDeliveryDTO(row, itemsByDeliveryId.get(row.id) ?? []),
      );
      return { data: result, nextCursor };
    });
  }

  async updateDelivery(actorUserId: string, organizationId: string, projectId: string, deliveryId: string, input: UpdateDeliveryInput): Promise<DeliveryDTO> {
    return withSpan(tracer, 'delivery.update', async (span) => {
      span.setAttributes({ organizationId, projectId, deliveryId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findDeliveryById(tx as any, deliveryId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) throw new DeliveryNotFoundError(deliveryId);
        if (row.status === 'CANCELLED' && input.status === 'DELIVERED') {
          throw new DeliveryInvalidStateError(row.status, 'mark as delivered');
        }
        const wasDelivered = row.status === 'DELIVERED';
        const updated = await this.repo.updateDelivery(tx as any, deliveryId, input);
        const items = await this.repo.findDeliveryItemsByDeliveryId(tx as any, deliveryId);
        if (!wasDelivered && input.status === 'DELIVERED') {
          const poRows = await tx.execute(sql`SELECT supplier_id FROM app.purchase_orders WHERE id=${row.purchaseOrderId}`) as any;
          const supplierId = (poRows.rows ?? poRows)[0]?.supplier_id;
          const isLate = row.scheduledDate && input.actualDeliveryDate && input.actualDeliveryDate > row.scheduledDate;
          await _recordPerformanceEvent(tx, {
            organizationId, projectId, partnerType: 'SUPPLIER', supplierId,
            sourceType: 'DELIVERY', sourceId: deliveryId,
            eventType: isLate ? 'DELIVERY_LATE' : 'DELIVERY_ON_TIME',
            occurredAt: new Date(),
          });
          await writeOutboxEvent(tx, 'procurement.delivery.delivered', { organizationId, projectId, deliveryId }, organizationId);
        }
        await auditService.log({ organizationId, actorUserId, action: 'delivery.updated', resourceType: 'Delivery', resourceId: deliveryId, metadata: { projectId } }, tx);
        return toDeliveryDTO(updated, items);
      });
    });
  }

  async createReceipt(actorUserId: string, organizationId: string, projectId: string, input: CreateReceiptInput): Promise<ReceiptDTO> {
    return withSpan(tracer, 'receipt.create', async (span) => {
      span.setAttributes({ organizationId, projectId });
      return this.db.transaction(async (tx) => {
        await tx.execute(sql`SELECT id FROM app.purchase_orders WHERE id=${input.purchaseOrderId} FOR UPDATE`);
        const purchaseOrder = await this.repo.findPurchaseOrderById(tx as any, input.purchaseOrderId);
        if (
          !purchaseOrder ||
          purchaseOrder.organizationId !== organizationId ||
          purchaseOrder.projectId !== projectId
        ) {
          throw new DeliveryResourceOwnershipError();
        }
        const receiptNumber = await documentNumberService.allocateDocumentNumber(tx, organizationId, projectId, 'RC', yyyymm());
        for (const item of input.items) {
          const poItem = await this.repo.findPoItemById(tx as any, item.purchaseOrderItemId);
          if (
            !poItem ||
            poItem.organizationId !== organizationId ||
            poItem.purchaseOrderId !== input.purchaseOrderId
          ) {
            throw new DeliveryResourceOwnershipError();
          }
          const qd = new Decimal(item.quantityDelivered);
          const qa = new Decimal(item.quantityAccepted);
          const qr = new Decimal(item.quantityRejected ?? '0');
          if (qa.plus(qr).gt(qd)) throw new ReceiptQuantityInvariantError();
        }
        const id = generateId();
        const row = await this.repo.createReceipt(tx as any, {
          id, organizationId, projectId, purchaseOrderId: input.purchaseOrderId,
          deliveryId: input.deliveryId ?? null,
          receiptNumber,
          receivedAt: new Date(input.receivedAt),
          notes: input.notes ?? null,
        });
        const itemsData = input.items.map(i => ({
          id: generateId(), organizationId, receiptId: id,
          purchaseOrderItemId: i.purchaseOrderItemId,
          quantityDelivered: i.quantityDelivered,
          quantityAccepted: i.quantityAccepted,
          quantityRejected: i.quantityRejected ?? '0',
          unitCode: i.unitCode.toUpperCase(),
          rejectionReason: i.rejectionReason ?? null,
          condition: i.condition ?? null,
          notes: i.notes ?? null,
        }));
        const items = await this.repo.createReceiptItems(tx as any, itemsData);
        await auditService.log({ organizationId, actorUserId, action: 'receipt.created', resourceType: 'Receipt', resourceId: id, metadata: { projectId } }, tx);
        return toReceiptDTO(row, items);
      });
    });
  }

  async getReceipt(organizationId: string, projectId: string, receiptId: string): Promise<ReceiptDTO> {
    return withSpan(tracer, 'receipt.get', async (span) => {
      span.setAttributes({ organizationId, projectId, receiptId });
      const row = await this.repo.findReceiptById(this.db, receiptId);
      if (!row || row.organizationId !== organizationId || row.projectId !== projectId) throw new ReceiptNotFoundError(receiptId);
      const items = await this.repo.findReceiptItemsByReceiptId(this.db, receiptId);
      return toReceiptDTO(row, items);
    });
  }

  async listReceipts(organizationId: string, projectId: string, query: { cursor?: string; limit?: number }): Promise<{ data: ReceiptDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'receipt.list', async (span) => {
      span.setAttributes({ organizationId, projectId });
      const limit = query.limit ?? 50;
      const rows = await this.repo.listReceipts(this.db, organizationId, projectId, { cursor: query.cursor, limit: limit + 1 });
      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      let nextCursor: string | null = null;
      if (hasMore && data.length > 0) {
        const last = data[data.length - 1]!;
        nextCursor = Buffer.from(JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id })).toString('base64');
      }
      const allItems = await this.repo.findReceiptItemsByReceiptIds(
        this.db,
        data.map((r) => r.id),
      );
      const itemsByReceiptId = new Map<string, ReceiptItem[]>();
      for (const item of allItems) {
        const arr = itemsByReceiptId.get(item.receiptId) ?? [];
        arr.push(item);
        itemsByReceiptId.set(item.receiptId, arr);
      }
      const result: ReceiptDTO[] = data.map((row) =>
        toReceiptDTO(row, itemsByReceiptId.get(row.id) ?? []),
      );
      return { data: result, nextCursor };
    });
  }

  async postReceipt(actorUserId: string, organizationId: string, projectId: string, receiptId: string): Promise<ReceiptDTO> {
    return withSpan(tracer, 'receipt.post', async (span) => {
      span.setAttributes({ organizationId, projectId, receiptId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findReceiptByIdForUpdate(tx as any, receiptId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) throw new ReceiptNotFoundError(receiptId);
        if (row.status !== 'DRAFT') throw new ReceiptInvalidStateError(row.status, 'post');
        await tx.execute(sql`SELECT id FROM app.purchase_orders WHERE id=${row.purchaseOrderId} FOR UPDATE`);
        const items = await this.repo.findReceiptItemsByReceiptId(tx as any, receiptId);
        const purchaseOrder = await this.repo.findPurchaseOrderById(tx as any, row.purchaseOrderId);
        if (
          !purchaseOrder ||
          purchaseOrder.organizationId !== organizationId ||
          purchaseOrder.projectId !== projectId
        ) {
          throw new DeliveryResourceOwnershipError();
        }
        for (const item of items) {
          const poItem = await this.repo.findPoItemById(tx as any, item.purchaseOrderItemId);
          if (
            !poItem ||
            poItem.organizationId !== organizationId ||
            poItem.purchaseOrderId !== row.purchaseOrderId
          ) {
            throw new DeliveryResourceOwnershipError();
          }
          const previousDelivered = await this.repo.sumPostedReceivedQty(tx as any, item.purchaseOrderItemId, receiptId);
          if (new Decimal(previousDelivered).plus(item.quantityDelivered).gt(poItem.quantity)) {
            throw new ReceiptQuantityExceedsPoError();
          }
        }
        const updated = await this.repo.updateReceipt(tx as any, receiptId, { status: 'POSTED' });
        for (const item of items) {
          const poItem = await this.repo.findPoItemById(tx as any, item.purchaseOrderItemId);
          if (poItem && new Decimal(item.quantityAccepted).gt(0)) {
            await _recordReceiptInventory(tx, {
              organizationId, projectId, materialId: poItem.materialId,
              quantity: item.quantityAccepted, unitCode: item.unitCode, sourceId: receiptId,
            });
          }
          if (new Decimal(item.quantityRejected).gt(0)) {
            const poRows = await tx.execute(sql`SELECT supplier_id FROM app.purchase_orders WHERE id=${row.purchaseOrderId}`) as any;
            const supplierId = (poRows.rows ?? poRows)[0]?.supplier_id;
            await _recordPerformanceEvent(tx, {
              organizationId, projectId, partnerType: 'SUPPLIER', supplierId,
              sourceType: 'RECEIPT', sourceId: receiptId,
              eventType: 'RECEIPT_REJECTION', occurredAt: new Date(),
              metricValue: item.quantityRejected,
            });
          }
        }
        await writeOutboxEvent(tx, 'procurement.receipt.posted', { organizationId, projectId, receiptId }, organizationId);
        await auditService.log({ organizationId, actorUserId, action: 'receipt.posted', resourceType: 'Receipt', resourceId: receiptId, metadata: { projectId } }, tx);
        return toReceiptDTO(updated, items);
      });
    });
  }

  async voidReceipt(actorUserId: string, organizationId: string, projectId: string, receiptId: string): Promise<ReceiptDTO> {
    return withSpan(tracer, 'receipt.void', async (span) => {
      span.setAttributes({ organizationId, projectId, receiptId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findReceiptByIdForUpdate(tx as any, receiptId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) throw new ReceiptNotFoundError(receiptId);
        if (row.status !== 'POSTED') throw new ReceiptInvalidStateError(row.status, 'void');
        const updated = await this.repo.updateReceipt(tx as any, receiptId, { status: 'VOIDED' });
        const items = await this.repo.findReceiptItemsByReceiptId(tx as any, receiptId);
        await _reverseReceiptInventory(tx, receiptId, organizationId, projectId);
        await writeOutboxEvent(
          tx,
          'procurement.receipt.voided',
          { organizationId, projectId, receiptId },
          organizationId,
        );
        await auditService.log({ organizationId, actorUserId, action: 'receipt.voided', resourceType: 'Receipt', resourceId: receiptId, metadata: { projectId } }, tx);
        return toReceiptDTO(updated, items);
      });
    });
  }
}
