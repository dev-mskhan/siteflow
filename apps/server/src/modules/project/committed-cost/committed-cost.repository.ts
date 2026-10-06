import { committedCosts, purchaseOrders, type CommittedCost } from '@siteflow/database/schema';
import { eq, and, desc, inArray, lt, or } from 'drizzle-orm';

export class CommittedCostRepository {
  async findPurchaseOrderStatuses(db: any, purchaseOrderIds: string[]) {
    if (purchaseOrderIds.length === 0) return [];
    return db
      .select({ id: purchaseOrders.id, status: purchaseOrders.status })
      .from(purchaseOrders)
      .where(inArray(purchaseOrders.id, purchaseOrderIds));
  }

  async findById(db: any, id: string): Promise<CommittedCost | undefined> {
    const rows = await db
      .select()
      .from(committedCosts)
      .where(eq(committedCosts.id, id));
    return rows[0];
  }

  async findBySource(
    db: any,
    organizationId: string,
    sourceType: string,
    sourceId: string,
  ): Promise<CommittedCost | undefined> {
    const rows = await db
      .select()
      .from(committedCosts)
      .where(
        and(
          eq(committedCosts.organizationId, organizationId),
          eq(committedCosts.sourceType, sourceType as any),
          eq(committedCosts.sourceId, sourceId),
        ),
      );
    return rows[0];
  }

  async create(db: any, data: any): Promise<CommittedCost> {
    const rows = await db.insert(committedCosts).values(data).returning();
    return rows[0]!;
  }

  async update(db: any, id: string, patch: any): Promise<CommittedCost> {
    const rows = await db
      .update(committedCosts)
      .set(patch)
      .where(eq(committedCosts.id, id))
      .returning();
    return rows[0]!;
  }

  async listByProject(
    db: any,
    organizationId: string,
    projectId: string,
    opts: { cursor?: string; limit: number; status?: string },
  ): Promise<CommittedCost[]> {
    const conditions: any[] = [
      eq(committedCosts.organizationId, organizationId),
      eq(committedCosts.projectId, projectId),
    ];
    if (opts.status) conditions.push(eq(committedCosts.status, opts.status as any));
    if (opts.cursor) {
      try {
        const { createdAt, id } = JSON.parse(
          Buffer.from(opts.cursor, 'base64').toString(),
        ) as any;
        conditions.push(
          or(
            lt(committedCosts.createdAt, new Date(createdAt)),
            and(
              eq(committedCosts.createdAt, new Date(createdAt)),
              lt(committedCosts.id, id),
            ),
          ),
        );
      } catch {
        // ignore invalid cursor
      }
    }
    return db
      .select()
      .from(committedCosts)
      .where(and(...conditions))
      .orderBy(desc(committedCosts.createdAt), desc(committedCosts.id))
      .limit(opts.limit);
  }
}
