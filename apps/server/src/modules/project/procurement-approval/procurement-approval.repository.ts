import {
  procurementApprovals,
  materialRequests,
  quotes,
  type ProcurementApproval,
} from '@siteflow/database/schema';
import { eq, and, desc, lt, or } from 'drizzle-orm';

export class ProcurementApprovalRepository {
  async findById(db: any, id: string): Promise<ProcurementApproval | undefined> {
    const rows = await db
      .select()
      .from(procurementApprovals)
      .where(eq(procurementApprovals.id, id));
    return rows[0];
  }

  async findPendingForResource(
    db: any,
    resourceType: string,
    resourceId: string,
  ): Promise<ProcurementApproval | undefined> {
    const rows = await db
      .select()
      .from(procurementApprovals)
      .where(
        and(
          eq(procurementApprovals.resourceType, resourceType as any),
          eq(procurementApprovals.resourceId, resourceId),
          eq(procurementApprovals.status, 'PENDING'),
        ),
      );
    return rows[0];
  }

  async create(db: any, data: any): Promise<ProcurementApproval> {
    const rows = await db.insert(procurementApprovals).values(data).returning();
    return rows[0]!;
  }

  async update(db: any, id: string, patch: any): Promise<ProcurementApproval> {
    const rows = await db
      .update(procurementApprovals)
      .set(patch)
      .where(eq(procurementApprovals.id, id))
      .returning();
    return rows[0]!;
  }

  async listByProject(
    db: any,
    organizationId: string,
    projectId: string,
    opts: { cursor?: string; limit: number; status?: string },
  ): Promise<ProcurementApproval[]> {
    const conditions: any[] = [
      eq(procurementApprovals.organizationId, organizationId),
      eq(procurementApprovals.projectId, projectId),
    ];
    if (opts.status) conditions.push(eq(procurementApprovals.status, opts.status as any));
    if (opts.cursor) {
      try {
        const { createdAt, id } = JSON.parse(
          Buffer.from(opts.cursor, 'base64').toString(),
        ) as any;
        conditions.push(
          or(
            lt(procurementApprovals.createdAt, new Date(createdAt)),
            and(
              eq(procurementApprovals.createdAt, new Date(createdAt)),
              lt(procurementApprovals.id, id),
            ),
          ),
        );
      } catch {
        // ignore invalid cursor
      }
    }
    return db
      .select()
      .from(procurementApprovals)
      .where(and(...conditions))
      .orderBy(desc(procurementApprovals.createdAt), desc(procurementApprovals.id))
      .limit(opts.limit);
  }

  async loadMaterialRequest(db: any, id: string) {
    const rows = await db.select().from(materialRequests).where(eq(materialRequests.id, id));
    return rows[0];
  }

  async loadQuote(db: any, id: string) {
    const rows = await db.select().from(quotes).where(eq(quotes.id, id));
    return rows[0];
  }
}
