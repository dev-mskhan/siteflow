import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import {
  costTransactions,
  estimateLineResources,
  estimateLines,
  estimateRevisions,
  estimateSections,
  estimates,
  type NewEstimate,
  type NewEstimateLine,
  type NewEstimateLineResource,
  type NewEstimateRevision,
  type NewEstimateSection,
} from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import type { getDb } from '../../../lib/db/index.js';

type EstimateDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

export class ProjectEstimateRepository {
  async findEstimate(
    db: EstimateDatabase,
    organizationId: string,
    projectId: string,
    estimateId: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(estimates)
      .where(
        and(
          eq(estimates.id, estimateId),
          eq(estimates.organizationId, organizationId),
          eq(estimates.projectId, projectId),
        ),
      )
      .limit(1);
    return lock ? query.for('update') : query;
  }

  async listEstimates(
    db: EstimateDatabase,
    organizationId: string,
    projectId: string,
    options: { status?: string; cursor?: { createdAt: Date; id: string }; limit: number },
  ) {
    return db
      .select()
      .from(estimates)
      .where(
        and(
          eq(estimates.organizationId, organizationId),
          eq(estimates.projectId, projectId),
          ...(options.status ? [eq(estimates.status, options.status)] : []),
          ...(options.cursor
            ? [
                or(
                  lt(estimates.createdAt, options.cursor.createdAt),
                  and(
                    eq(estimates.createdAt, options.cursor.createdAt),
                    lt(estimates.id, options.cursor.id),
                  ),
                )!,
              ]
            : []),
        ),
      )
      .orderBy(desc(estimates.createdAt), desc(estimates.id))
      .limit(options.limit + 1);
  }

  async createEstimate(tx: DatabaseTransaction, data: NewEstimate) {
    const [estimate] = await tx.insert(estimates).values(data).returning();
    return estimate!;
  }

  async updateEstimate(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    estimateId: string,
    expectedVersion: number,
    data: Partial<typeof estimates.$inferInsert>,
  ) {
    const updated = await tx
      .update(estimates)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(estimates.id, estimateId),
          eq(estimates.organizationId, organizationId),
          eq(estimates.projectId, projectId),
          eq(estimates.version, expectedVersion),
        ),
      )
      .returning();
    return updated[0] ?? null;
  }

  async createRevision(tx: DatabaseTransaction, data: NewEstimateRevision) {
    const [revision] = await tx.insert(estimateRevisions).values(data).returning();
    return revision!;
  }

  async findRevision(
    db: EstimateDatabase,
    organizationId: string,
    projectId: string,
    estimateId: string,
    revisionNumber: number,
  ) {
    const [revision] = await db
      .select()
      .from(estimateRevisions)
      .innerJoin(
        estimates,
        and(
          eq(estimates.id, estimateRevisions.estimateId),
          eq(estimates.organizationId, estimateRevisions.organizationId),
          eq(estimates.projectId, estimateRevisions.projectId),
        ),
      )
      .where(
        and(
          eq(estimateRevisions.estimateId, estimateId),
          eq(estimateRevisions.organizationId, organizationId),
          eq(estimateRevisions.projectId, projectId),
          eq(estimateRevisions.revisionNumber, revisionNumber),
        ),
      )
      .limit(1);
    return revision?.estimate_revisions ?? null;
  }

  async findRevisionsByEstimate(
    db: EstimateDatabase,
    organizationId: string,
    projectId: string,
    estimateId: string,
  ) {
    return db
      .select()
      .from(estimateRevisions)
      .where(
        and(
          eq(estimateRevisions.estimateId, estimateId),
          eq(estimateRevisions.organizationId, organizationId),
          eq(estimateRevisions.projectId, projectId),
        ),
      )
      .orderBy(estimateRevisions.revisionNumber);
  }

  async updateRevision(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    revisionId: string,
    data: Partial<typeof estimateRevisions.$inferInsert>,
  ) {
    const [updated] = await tx
      .update(estimateRevisions)
      .set(data)
      .where(
        and(
          eq(estimateRevisions.id, revisionId),
          eq(estimateRevisions.organizationId, organizationId),
          eq(estimateRevisions.projectId, projectId),
        ),
      )
      .returning();
    return updated ?? null;
  }

  async createSection(tx: DatabaseTransaction, data: NewEstimateSection) {
    const [section] = await tx.insert(estimateSections).values(data).returning();
    return section!;
  }

  async createLines(tx: DatabaseTransaction, data: NewEstimateLine[]) {
    if (data.length === 0) return [];
    return tx.insert(estimateLines).values(data).returning();
  }

  async createResources(tx: DatabaseTransaction, data: NewEstimateLineResource[]) {
    if (data.length === 0) return [];
    return tx.insert(estimateLineResources).values(data).returning();
  }

  async findSections(
    db: EstimateDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db
      .select()
      .from(estimateSections)
      .where(
        and(
          eq(estimateSections.revisionId, revisionId),
          eq(estimateSections.organizationId, organizationId),
          eq(estimateSections.projectId, projectId),
        ),
      )
      .orderBy(estimateSections.sectionNumber);
  }

  async findLines(
    db: EstimateDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db
      .select()
      .from(estimateLines)
      .where(
        and(
          eq(estimateLines.revisionId, revisionId),
          eq(estimateLines.organizationId, organizationId),
          eq(estimateLines.projectId, projectId),
        ),
      )
      .orderBy(estimateLines.sectionId, estimateLines.lineNumber);
  }

  async findResourcesByLineIds(
    db: EstimateDatabase,
    organizationId: string,
    projectId: string,
    lineIds: string[],
  ) {
    if (lineIds.length === 0) return [];
    return db
      .select()
      .from(estimateLineResources)
      .where(
        and(
          inArray(estimateLineResources.estimateLineId, lineIds),
          eq(estimateLineResources.organizationId, organizationId),
          eq(estimateLineResources.projectId, projectId),
        ),
      );
  }

  async sumPostedCostByCostCode(
    db: EstimateDatabase,
    organizationId: string,
    projectId: string,
  ) {
    return db
      .select({
        costCodeId: costTransactions.costCodeId,
        actualSubtotal: sql<string>`COALESCE(SUM(${costTransactions.subtotal}), 0)::text`,
      })
      .from(costTransactions)
      .where(
        and(
          eq(costTransactions.organizationId, organizationId),
          eq(costTransactions.projectId, projectId),
          eq(costTransactions.status, 'POSTED'),
        ),
      )
      .groupBy(costTransactions.costCodeId);
  }
}

export const projectEstimateRepository = new ProjectEstimateRepository();
