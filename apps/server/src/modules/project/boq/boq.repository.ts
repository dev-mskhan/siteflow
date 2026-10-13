import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import {
  boqImportRuns,
  boqItems,
  boqMappings,
  boqRevisions,
  boqSections,
  boqs,
  projectCostCodes,
  type NewBoq,
  type NewBoqItem,
  type NewBoqRevision,
  type NewBoqSection,
} from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import type { getDb } from '../../../lib/db/index.js';

type BoqDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

export class ProjectBoqRepository {
  async findBoq(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    boqId: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(boqs)
      .where(
        and(
          eq(boqs.id, boqId),
          eq(boqs.organizationId, organizationId),
          eq(boqs.projectId, projectId),
        ),
      )
      .limit(1);
    const [row] = await (lock ? query.for('update') : query);
    return row ?? null;
  }

  async listBoqs(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    options: {
      status?: string;
      cursor?: { updatedAt: Date; id: string };
      limit: number;
    },
  ) {
    return db
      .select()
      .from(boqs)
      .where(
        and(
          eq(boqs.organizationId, organizationId),
          eq(boqs.projectId, projectId),
          ...(options.status ? [eq(boqs.status, options.status)] : []),
          ...(options.cursor
            ? [
                or(
                  lt(boqs.updatedAt, options.cursor.updatedAt),
                  and(
                    eq(boqs.updatedAt, options.cursor.updatedAt),
                    lt(boqs.id, options.cursor.id),
                  ),
                )!,
              ]
            : []),
        ),
      )
      .orderBy(desc(boqs.updatedAt), desc(boqs.id))
      .limit(options.limit + 1);
  }

  async nextBoqNumber(tx: DatabaseTransaction, organizationId: string, projectId: string) {
    const [row] = await tx
      .select({
        next: sql<number>`COALESCE(MAX(${boqs.boqNumber}), 0) + 1`,
      })
      .from(boqs)
      .where(and(eq(boqs.organizationId, organizationId), eq(boqs.projectId, projectId)));
    return Number(row?.next ?? 1);
  }

  async insertBoq(tx: DatabaseTransaction, data: NewBoq) {
    const [row] = await tx.insert(boqs).values(data).returning();
    return row!;
  }

  async updateBoqVersioned(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    boqId: string,
    expectedVersion: number,
    data: Partial<typeof boqs.$inferInsert>,
  ) {
    const [row] = await tx
      .update(boqs)
      .set({ ...data, version: sql`${boqs.version} + 1`, updatedAt: new Date() })
      .where(
        and(
          eq(boqs.id, boqId),
          eq(boqs.organizationId, organizationId),
          eq(boqs.projectId, projectId),
          eq(boqs.version, expectedVersion),
        ),
      )
      .returning();
    return row ?? null;
  }

  async findRevision(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(boqRevisions)
      .where(
        and(
          eq(boqRevisions.id, revisionId),
          eq(boqRevisions.organizationId, organizationId),
          eq(boqRevisions.projectId, projectId),
        ),
      )
      .limit(1);
    const [row] = await (lock ? query.for('update') : query);
    return row ?? null;
  }

  async findRevisionsByBoq(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    boqId: string,
    options: { cursor?: { revisionNumber: number }; limit: number },
  ) {
    return db
      .select()
      .from(boqRevisions)
      .where(
        and(
          eq(boqRevisions.boqId, boqId),
          eq(boqRevisions.organizationId, organizationId),
          eq(boqRevisions.projectId, projectId),
          ...(options.cursor
            ? [lt(boqRevisions.revisionNumber, options.cursor.revisionNumber)]
            : []),
        ),
      )
      .orderBy(desc(boqRevisions.revisionNumber))
      .limit(options.limit + 1);
  }

  async findDraftRevision(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    boqId: string,
  ) {
    const [row] = await db
      .select()
      .from(boqRevisions)
      .where(
        and(
          eq(boqRevisions.boqId, boqId),
          eq(boqRevisions.organizationId, organizationId),
          eq(boqRevisions.projectId, projectId),
          eq(boqRevisions.status, 'DRAFT'),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async insertRevision(tx: DatabaseTransaction, data: NewBoqRevision) {
    const [row] = await tx.insert(boqRevisions).values(data).returning();
    return row!;
  }

  async updateRevision(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    revisionId: string,
    data: Partial<typeof boqRevisions.$inferInsert>,
  ) {
    const [row] = await tx
      .update(boqRevisions)
      .set(data)
      .where(
        and(
          eq(boqRevisions.id, revisionId),
          eq(boqRevisions.organizationId, organizationId),
          eq(boqRevisions.projectId, projectId),
        ),
      )
      .returning();
    return row ?? null;
  }

  async findSections(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db
      .select()
      .from(boqSections)
      .where(
        and(
          eq(boqSections.revisionId, revisionId),
          eq(boqSections.organizationId, organizationId),
          eq(boqSections.projectId, projectId),
        ),
      )
      .orderBy(boqSections.sortOrder);
  }

  async insertSections(tx: DatabaseTransaction, data: NewBoqSection[]) {
    if (data.length === 0) return [];
    return tx.insert(boqSections).values(data).returning();
  }

  async findItems(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db
      .select()
      .from(boqItems)
      .where(
        and(
          eq(boqItems.revisionId, revisionId),
          eq(boqItems.organizationId, organizationId),
          eq(boqItems.projectId, projectId),
        ),
      )
      .orderBy(boqItems.sortOrder);
  }

  async insertItems(tx: DatabaseTransaction, data: NewBoqItem[]) {
    if (data.length === 0) return [];
    return tx.insert(boqItems).values(data).returning();
  }

  async findItem(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    itemId: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(boqItems)
      .where(
        and(
          eq(boqItems.id, itemId),
          eq(boqItems.organizationId, organizationId),
          eq(boqItems.projectId, projectId),
        ),
      )
      .limit(1);
    const [row] = await (lock ? query.for('update') : query);
    return row ?? null;
  }

  async updateItemCostCode(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    itemId: string,
    costCodeId: string | null,
  ) {
    const [row] = await tx
      .update(boqItems)
      .set({ costCodeId })
      .where(
        and(
          eq(boqItems.id, itemId),
          eq(boqItems.organizationId, organizationId),
          eq(boqItems.projectId, projectId),
        ),
      )
      .returning();
    return row ?? null;
  }

  async findActiveMappings(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db
      .select()
      .from(boqMappings)
      .where(
        and(
          eq(boqMappings.revisionId, revisionId),
          eq(boqMappings.organizationId, organizationId),
          eq(boqMappings.projectId, projectId),
          eq(boqMappings.status, 'ACTIVE'),
        ),
      );
  }

  async supersedeActiveMappingsForItem(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    itemId: string,
    supersededBy: string,
  ) {
    return tx
      .update(boqMappings)
      .set({ status: 'SUPERSEDED', supersededBy, supersededAt: new Date() })
      .where(
        and(
          eq(boqMappings.itemId, itemId),
          eq(boqMappings.organizationId, organizationId),
          eq(boqMappings.projectId, projectId),
          eq(boqMappings.status, 'ACTIVE'),
        ),
      )
      .returning({ id: boqMappings.id });
  }

  async insertMappings(tx: DatabaseTransaction, data: (typeof boqMappings.$inferInsert)[]) {
    if (data.length === 0) return [];
    return tx.insert(boqMappings).values(data).returning();
  }

  async deleteRevisionContents(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    const scope = and(
      eq(boqMappings.revisionId, revisionId),
      eq(boqMappings.organizationId, organizationId),
      eq(boqMappings.projectId, projectId),
    );
    await tx.delete(boqMappings).where(scope);
    await tx
      .delete(boqItems)
      .where(
        and(
          eq(boqItems.revisionId, revisionId),
          eq(boqItems.organizationId, organizationId),
          eq(boqItems.projectId, projectId),
        ),
      );
    await tx
      .delete(boqSections)
      .where(
        and(
          eq(boqSections.revisionId, revisionId),
          eq(boqSections.organizationId, organizationId),
          eq(boqSections.projectId, projectId),
        ),
      );
  }

  async findCostCodesByCodes(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    codes: string[],
  ) {
    if (codes.length === 0) return [];
    return db
      .select({ id: projectCostCodes.id, code: projectCostCodes.code })
      .from(projectCostCodes)
      .where(
        and(
          inArray(projectCostCodes.code, codes),
          eq(projectCostCodes.organizationId, organizationId),
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.isActive, true),
        ),
      );
  }

  async findActiveCostCodeById(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    costCodeId: string,
  ) {
    const [row] = await db
      .select({ id: projectCostCodes.id })
      .from(projectCostCodes)
      .where(
        and(
          eq(projectCostCodes.id, costCodeId),
          eq(projectCostCodes.organizationId, organizationId),
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.isActive, true),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async insertImportRun(
    tx: DatabaseTransaction,
    data: typeof boqImportRuns.$inferInsert,
  ) {
    const [row] = await tx.insert(boqImportRuns).values(data).returning();
    return row!;
  }

  async findImportRun(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    importId: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(boqImportRuns)
      .where(
        and(
          eq(boqImportRuns.id, importId),
          eq(boqImportRuns.organizationId, organizationId),
          eq(boqImportRuns.projectId, projectId),
        ),
      )
      .limit(1);
    const [row] = await (lock ? query.for('update') : query);
    return row ?? null;
  }

  async findImportRunByIdempotencyKey(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    boqId: string,
    idempotencyKeyHash: string,
  ) {
    const [row] = await db
      .select()
      .from(boqImportRuns)
      .where(
        and(
          eq(boqImportRuns.organizationId, organizationId),
          eq(boqImportRuns.projectId, projectId),
          eq(boqImportRuns.boqId, boqId),
          eq(boqImportRuns.idempotencyKeyHash, idempotencyKeyHash),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async updateImportRun(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    importId: string,
    data: Partial<typeof boqImportRuns.$inferInsert>,
  ) {
    const [row] = await tx
      .update(boqImportRuns)
      .set(data)
      .where(
        and(
          eq(boqImportRuns.id, importId),
          eq(boqImportRuns.organizationId, organizationId),
          eq(boqImportRuns.projectId, projectId),
        ),
      )
      .returning();
    return row ?? null;
  }

  async findItemsForExport(
    db: BoqDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db
      .select({
        itemKey: boqItems.itemKey,
        sectionKey: boqSections.sectionKey,
        description: boqItems.description,
        specification: boqItems.specification,
        unit: boqItems.unit,
        quantity: boqItems.quantity,
        unitRate: boqItems.unitRate,
        amount: boqItems.amount,
        currencyCode: boqItems.currencyCode,
        costCode: projectCostCodes.code,
        sortOrder: boqItems.sortOrder,
      })
      .from(boqItems)
      .innerJoin(
        boqSections,
        and(
          eq(boqSections.id, boqItems.sectionId),
          eq(boqSections.revisionId, boqItems.revisionId),
        ),
      )
      .leftJoin(
        projectCostCodes,
        and(
          eq(projectCostCodes.id, boqItems.costCodeId),
          eq(projectCostCodes.organizationId, boqItems.organizationId),
          eq(projectCostCodes.projectId, boqItems.projectId),
        ),
      )
      .where(
        and(
          eq(boqItems.revisionId, revisionId),
          eq(boqItems.organizationId, organizationId),
          eq(boqItems.projectId, projectId),
        ),
      )
      .orderBy(boqItems.sortOrder);
  }
}

export const projectBoqRepository = new ProjectBoqRepository();
