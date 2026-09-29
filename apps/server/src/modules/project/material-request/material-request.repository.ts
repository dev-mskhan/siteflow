import {
  materialRequests,
  materialRequestItems,
  type MaterialRequest,
  type MaterialRequestItem,
} from '@siteflow/database/schema';
import { eq, and, desc, lt, or } from 'drizzle-orm';

export class MaterialRequestRepository {
  async findById(db: any, id: string): Promise<MaterialRequest | undefined> {
    const rows = await db.select().from(materialRequests).where(eq(materialRequests.id, id));
    return rows[0];
  }

  async create(db: any, data: any): Promise<MaterialRequest> {
    const rows = await db.insert(materialRequests).values(data).returning();
    return rows[0]!;
  }

  async update(db: any, id: string, patch: any): Promise<MaterialRequest> {
    const rows = await db
      .update(materialRequests)
      .set(patch)
      .where(eq(materialRequests.id, id))
      .returning();
    return rows[0]!;
  }

  async listByProject(
    db: any,
    organizationId: string,
    projectId: string,
    opts: { cursor?: string; limit: number; status?: string },
  ): Promise<MaterialRequest[]> {
    const conditions: any[] = [
      eq(materialRequests.organizationId, organizationId),
      eq(materialRequests.projectId, projectId),
    ];
    if (opts.status) conditions.push(eq(materialRequests.status, opts.status as any));
    if (opts.cursor) {
      try {
        const { createdAt, id } = JSON.parse(
          Buffer.from(opts.cursor, 'base64').toString(),
        ) as { createdAt: string; id: string };
        conditions.push(
          or(
            lt(materialRequests.createdAt, new Date(createdAt)),
            and(
              eq(materialRequests.createdAt, new Date(createdAt)),
              lt(materialRequests.id, id),
            ),
          ),
        );
      } catch {
        // ignore invalid cursor
      }
    }
    return db
      .select()
      .from(materialRequests)
      .where(and(...conditions))
      .orderBy(desc(materialRequests.createdAt), desc(materialRequests.id))
      .limit(opts.limit);
  }

  async createItems(db: any, items: any[]): Promise<MaterialRequestItem[]> {
    if (!items.length) return [];
    const rows = await db.insert(materialRequestItems).values(items).returning();
    return rows;
  }

  async findItemsByRequestId(db: any, materialRequestId: string): Promise<MaterialRequestItem[]> {
    return db
      .select()
      .from(materialRequestItems)
      .where(eq(materialRequestItems.materialRequestId, materialRequestId));
  }
}
