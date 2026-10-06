import { and, desc, eq, inArray, sum } from 'drizzle-orm';
import {
  projectBudgetLines,
  projectBudgetRevisions,
  projectBudgets,
  projectCostCodes,
  projectPhases,
  type NewProjectBudgetLine,
  type NewProjectBudgetRevision,
  type NewProjectBudget,
} from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import type { getDb } from '../../../lib/db/index.js';

type BudgetDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

export class ProjectBudgetRepository {
  async findBudget(
    db: BudgetDatabase,
    organizationId: string,
    projectId: string,
    budgetId?: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(projectBudgets)
      .where(
        and(
          eq(projectBudgets.organizationId, organizationId),
          eq(projectBudgets.projectId, projectId),
          ...(budgetId ? [eq(projectBudgets.id, budgetId)] : []),
        ),
      )
      .limit(1);
    return lock ? query.for('update') : query;
  }

  async createBudget(tx: DatabaseTransaction, data: NewProjectBudget) {
    const [budget] = await tx.insert(projectBudgets).values(data).returning();
    return budget!;
  }

  async updateBudget(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    budgetId: string,
    expectedVersion: number,
    data: Partial<typeof projectBudgets.$inferInsert>,
  ) {
    const updated = await tx
      .update(projectBudgets)
      .set({ ...data, updatedAt: new Date() })
      .where(
        and(
          eq(projectBudgets.id, budgetId),
          eq(projectBudgets.organizationId, organizationId),
          eq(projectBudgets.projectId, projectId),
          eq(projectBudgets.version, expectedVersion),
        ),
      )
      .returning();
    return updated[0] ?? null;
  }

  async createRevision(tx: DatabaseTransaction, data: NewProjectBudgetRevision) {
    const [revision] = await tx.insert(projectBudgetRevisions).values(data).returning();
    return revision!;
  }

  async findRevision(
    db: BudgetDatabase,
    organizationId: string,
    projectId: string,
    budgetId: string,
    revisionNumber: number,
    lock = false,
  ) {
    const query = db
      .select()
      .from(projectBudgetRevisions)
      .where(
        and(
          eq(projectBudgetRevisions.organizationId, organizationId),
          eq(projectBudgetRevisions.projectId, projectId),
          eq(projectBudgetRevisions.budgetId, budgetId),
          eq(projectBudgetRevisions.revisionNumber, revisionNumber),
        ),
      )
      .limit(1);
    return lock ? query.for('update') : query;
  }

  async updateRevision(
    tx: DatabaseTransaction,
    revisionId: string,
    organizationId: string,
    projectId: string,
    data: Partial<typeof projectBudgetRevisions.$inferInsert>,
  ) {
    const updated = await tx
      .update(projectBudgetRevisions)
      .set(data)
      .where(
        and(
          eq(projectBudgetRevisions.id, revisionId),
          eq(projectBudgetRevisions.organizationId, organizationId),
          eq(projectBudgetRevisions.projectId, projectId),
        ),
      )
      .returning();
    return updated[0] ?? null;
  }

  async insertLines(tx: DatabaseTransaction, lines: NewProjectBudgetLine[]) {
    if (lines.length === 0) return [];
    return tx.insert(projectBudgetLines).values(lines).returning();
  }

  async replaceLines(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    revisionId: string,
    lines: NewProjectBudgetLine[],
  ) {
    await tx
      .delete(projectBudgetLines)
      .where(
        and(
          eq(projectBudgetLines.revisionId, revisionId),
          eq(projectBudgetLines.organizationId, organizationId),
          eq(projectBudgetLines.projectId, projectId),
        ),
      );
    return this.insertLines(tx, lines);
  }

  async findLines(
    db: BudgetDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
  ) {
    return db
      .select()
      .from(projectBudgetLines)
      .where(
        and(
          eq(projectBudgetLines.organizationId, organizationId),
          eq(projectBudgetLines.projectId, projectId),
          eq(projectBudgetLines.revisionId, revisionId),
        ),
      )
      .orderBy(projectBudgetLines.lineNumber);
  }

  async findApprovedRevisionTotals(
    db: BudgetDatabase,
    organizationId: string,
    projectId: string,
    budgetId: string,
  ) {
    const revisions = await db
      .select({ id: projectBudgetRevisions.id })
      .from(projectBudgetRevisions)
      .where(
        and(
          eq(projectBudgetRevisions.organizationId, organizationId),
          eq(projectBudgetRevisions.projectId, projectId),
          eq(projectBudgetRevisions.budgetId, budgetId),
          inArray(projectBudgetRevisions.status, ['APPROVED', 'SUPERSEDED', 'CLOSED']),
        ),
      )
      .orderBy(desc(projectBudgetRevisions.revisionNumber));
    return revisions;
  }

  async getApprovedRevisionTotals(
    db: BudgetDatabase,
    organizationId: string,
    projectId: string,
    budgetId: string,
  ) {
    return db
      .select({
        revisionNumber: projectBudgetRevisions.revisionNumber,
        total: sum(projectBudgetLines.amount),
      })
      .from(projectBudgetRevisions)
      .leftJoin(projectBudgetLines, eq(projectBudgetLines.revisionId, projectBudgetRevisions.id))
      .where(
        and(
          eq(projectBudgetRevisions.organizationId, organizationId),
          eq(projectBudgetRevisions.projectId, projectId),
          eq(projectBudgetRevisions.budgetId, budgetId),
          inArray(projectBudgetRevisions.status, ['APPROVED', 'SUPERSEDED', 'CLOSED']),
        ),
      )
      .groupBy(projectBudgetRevisions.id, projectBudgetRevisions.revisionNumber)
      .orderBy(desc(projectBudgetRevisions.revisionNumber));
  }

  async validateReferences(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    costCodeIds: string[],
    phaseIds: string[],
  ) {
    const [codes, phases] = await Promise.all([
      costCodeIds.length === 0
        ? []
        : tx
            .select({ id: projectCostCodes.id })
            .from(projectCostCodes)
            .where(
              and(
                eq(projectCostCodes.organizationId, organizationId),
                eq(projectCostCodes.projectId, projectId),
                eq(projectCostCodes.isActive, true),
                inArray(projectCostCodes.id, costCodeIds),
              ),
            ),
      phaseIds.length === 0
        ? []
        : tx
            .select({ id: projectPhases.id })
            .from(projectPhases)
            .where(
              and(
                eq(projectPhases.organizationId, organizationId),
                eq(projectPhases.projectId, projectId),
                eq(projectPhases.status, 'ACTIVE'),
                inArray(projectPhases.id, phaseIds),
              ),
            ),
    ]);
    return { codes, phases };
  }
}

export const projectBudgetRepository = new ProjectBudgetRepository();
