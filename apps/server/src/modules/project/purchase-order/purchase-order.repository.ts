import {
  purchaseOrders,
  purchaseOrderItems,
  type PurchaseOrder,
  type PurchaseOrderItem,
} from '@siteflow/database/schema';
import { eq, and, desc, lt, or, inArray } from 'drizzle-orm';

export class PurchaseOrderRepository {
  async findById(db: any, id: string): Promise<PurchaseOrder | undefined> {
    const rows = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id));
    return rows[0];
  }

  async findByIdForUpdate(db: any, id: string): Promise<PurchaseOrder | undefined> {
    const rows = await db
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))
      .for('update');
    return rows[0];
  }

  async create(db: any, data: any): Promise<PurchaseOrder> {
    const rows = await db.insert(purchaseOrders).values(data).returning();
    return rows[0]!;
  }

  async update(db: any, id: string, patch: any): Promise<PurchaseOrder> {
    const rows = await db
      .update(purchaseOrders)
      .set(patch)
      .where(eq(purchaseOrders.id, id))
      .returning();
    return rows[0]!;
  }

  async listByProject(
    db: any,
    organizationId: string,
    projectId: string,
    opts: { cursor?: string; limit: number; status?: string },
  ): Promise<PurchaseOrder[]> {
    const conditions: any[] = [
      eq(purchaseOrders.organizationId, organizationId),
      eq(purchaseOrders.projectId, projectId),
    ];
    if (opts.status) conditions.push(eq(purchaseOrders.status, opts.status as any));
    if (opts.cursor) {
      try {
        const { createdAt, id } = JSON.parse(
          Buffer.from(opts.cursor, 'base64').toString(),
        ) as any;
        conditions.push(
          or(
            lt(purchaseOrders.createdAt, new Date(createdAt)),
            and(eq(purchaseOrders.createdAt, new Date(createdAt)), lt(purchaseOrders.id, id)),
          ),
        );
      } catch {
        // ignore invalid cursor
      }
    }
    return db
      .select()
      .from(purchaseOrders)
      .where(and(...conditions))
      .orderBy(desc(purchaseOrders.createdAt), desc(purchaseOrders.id))
      .limit(opts.limit);
  }

  async createItems(db: any, items: any[]): Promise<PurchaseOrderItem[]> {
    if (!items.length) return [];
    return db.insert(purchaseOrderItems).values(items).returning();
  }

  async findItemsByPoId(db: any, purchaseOrderId: string): Promise<PurchaseOrderItem[]> {
    return db
      .select()
      .from(purchaseOrderItems)
      .where(eq(purchaseOrderItems.purchaseOrderId, purchaseOrderId));
  }

  async findItemsByPoIds(db: any, purchaseOrderIds: string[]): Promise<PurchaseOrderItem[]> {
    if (purchaseOrderIds.length === 0) return [];
    return db
      .select()
      .from(purchaseOrderItems)
      .where(inArray(purchaseOrderItems.purchaseOrderId, purchaseOrderIds));
  }
}
