import {
  deliveries, deliveryItems, receipts, receiptItems, purchaseOrderItems, purchaseOrders,
} from '@siteflow/database/schema';
import type {
  Delivery, DeliveryItem, Receipt, ReceiptItem, PurchaseOrderItem, PurchaseOrder,
} from '@siteflow/database/schema';
import { eq, and, desc, lt, or, sql, inArray } from 'drizzle-orm';

export class DeliveryRepository {
  async findDeliveryById(db: any, id: string): Promise<Delivery | undefined> {
    return (await db.select().from(deliveries).where(eq(deliveries.id, id)))[0];
  }
  async createDelivery(db: any, data: any): Promise<Delivery> {
    return (await db.insert(deliveries).values(data).returning())[0]!;
  }
  async updateDelivery(db: any, id: string, patch: any): Promise<Delivery> {
    return (await db.update(deliveries).set(patch).where(eq(deliveries.id, id)).returning())[0]!;
  }
  async createDeliveryItems(db: any, items: any[]): Promise<DeliveryItem[]> {
    if (!items.length) return [];
    return db.insert(deliveryItems).values(items).returning();
  }
  async findDeliveryItemsByDeliveryId(db: any, deliveryId: string): Promise<DeliveryItem[]> {
    return db.select().from(deliveryItems).where(eq(deliveryItems.deliveryId, deliveryId));
  }
  async findDeliveryItemsByDeliveryIds(db: any, deliveryIds: string[]): Promise<DeliveryItem[]> {
    if (deliveryIds.length === 0) return [];
    return db.select().from(deliveryItems).where(inArray(deliveryItems.deliveryId, deliveryIds));
  }
  async listDeliveries(db: any, organizationId: string, projectId: string, opts: { cursor?: string; limit: number }): Promise<Delivery[]> {
    const conds: any[] = [eq(deliveries.organizationId, organizationId), eq(deliveries.projectId, projectId)];
    if (opts.cursor) {
      try {
        const { createdAt, id } = JSON.parse(Buffer.from(opts.cursor, 'base64').toString()) as any;
        conds.push(or(lt(deliveries.createdAt, new Date(createdAt)), and(eq(deliveries.createdAt, new Date(createdAt)), lt(deliveries.id, id))));
      } catch {
        // Invalid cursors are ignored for compatibility with existing list endpoints.
      }
    }
    return db.select().from(deliveries).where(and(...conds)).orderBy(desc(deliveries.createdAt), desc(deliveries.id)).limit(opts.limit);
  }

  async findReceiptById(db: any, id: string): Promise<Receipt | undefined> {
    return (await db.select().from(receipts).where(eq(receipts.id, id)))[0];
  }
  async findReceiptByIdForUpdate(db: any, id: string): Promise<Receipt | undefined> {
    await db.execute(sql`SELECT id FROM app.receipts WHERE id = ${id} FOR UPDATE`);
    return this.findReceiptById(db, id);
  }
  async createReceipt(db: any, data: any): Promise<Receipt> {
    return (await db.insert(receipts).values(data).returning())[0]!;
  }
  async updateReceipt(db: any, id: string, patch: any): Promise<Receipt> {
    return (await db.update(receipts).set(patch).where(eq(receipts.id, id)).returning())[0]!;
  }
  async createReceiptItems(db: any, items: any[]): Promise<ReceiptItem[]> {
    if (!items.length) return [];
    return db.insert(receiptItems).values(items).returning();
  }
  async findReceiptItemsByReceiptId(db: any, receiptId: string): Promise<ReceiptItem[]> {
    return db.select().from(receiptItems).where(eq(receiptItems.receiptId, receiptId));
  }
  async findReceiptItemsByReceiptIds(db: any, receiptIds: string[]): Promise<ReceiptItem[]> {
    if (receiptIds.length === 0) return [];
    return db.select().from(receiptItems).where(inArray(receiptItems.receiptId, receiptIds));
  }
  async listReceipts(db: any, organizationId: string, projectId: string, opts: { cursor?: string; limit: number }): Promise<Receipt[]> {
    const conds: any[] = [eq(receipts.organizationId, organizationId), eq(receipts.projectId, projectId)];
    if (opts.cursor) {
      try {
        const { createdAt, id } = JSON.parse(Buffer.from(opts.cursor, 'base64').toString()) as any;
        conds.push(or(lt(receipts.createdAt, new Date(createdAt)), and(eq(receipts.createdAt, new Date(createdAt)), lt(receipts.id, id))));
      } catch {
        // Invalid cursors are ignored for compatibility with existing list endpoints.
      }
    }
    return db.select().from(receipts).where(and(...conds)).orderBy(desc(receipts.createdAt), desc(receipts.id)).limit(opts.limit);
  }
  async findPoItemById(db: any, id: string): Promise<PurchaseOrderItem | undefined> {
    return (await db.select().from(purchaseOrderItems).where(eq(purchaseOrderItems.id, id)))[0];
  }
  async findPurchaseOrderById(db: any, id: string): Promise<PurchaseOrder | undefined> {
    return (await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id)))[0];
  }
  async sumDeliveredQty(db: any, purchaseOrderItemId: string): Promise<number> {
    const result = await db.execute(
      sql`SELECT COALESCE(SUM(di.quantity),0) AS total FROM app.delivery_items di JOIN app.deliveries d ON d.id=di.delivery_id WHERE di.purchase_order_item_id=${purchaseOrderItemId} AND d.status!='CANCELLED'`
    );
    return parseFloat((result.rows ?? result)[0]?.total ?? '0');
  }
  async sumPostedReceivedQty(
    db: any,
    purchaseOrderItemId: string,
    excludingReceiptId: string,
  ): Promise<number> {
    const result = await db.execute(
      sql`SELECT COALESCE(SUM(ri.quantity_delivered), 0) AS total
          FROM app.receipt_items ri
          JOIN app.receipts r ON r.id = ri.receipt_id
          WHERE ri.purchase_order_item_id = ${purchaseOrderItemId}
            AND r.status = 'POSTED'
            AND r.id <> ${excludingReceiptId}`,
    );
    return parseFloat((result.rows ?? result)[0]?.total ?? '0');
  }
}
