import { and, desc, eq, inArray, lt, or, type SQL } from 'drizzle-orm';
import {
  changeOrderLines,
  changeOrders,
  documents,
  projectBudgetLines,
  projectBudgetRevisions,
  projectBudgets,
  projectCostCodes,
  projectPhases,
  tasks,
} from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import type { getDb } from '../../../lib/db/index.js';
import type { ListChangeOrdersQuery } from '@siteflow/shared';

type ChangeOrderDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

export interface ChangeOrderCursor {
  createdAt: Date;
  id: string;
}

export class ChangeOrderRepository {
  async findById(
    db: ChangeOrderDatabase,
    organizationId: string,
    projectId: string,
    changeOrderId: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(changeOrders)
      .where(and(
        eq(changeOrders.organizationId, organizationId),
        eq(changeOrders.projectId, projectId),
        eq(changeOrders.id, changeOrderId),
      ))
      .limit(1);
    return lock ? query.for('update') : query;
  }

  async list(
    db: ChangeOrderDatabase,
    organizationId: string,
    projectId: string,
    query: ListChangeOrdersQuery,
    cursor?: ChangeOrderCursor,
  ) {
    const conditions: SQL[] = [
      eq(changeOrders.organizationId, organizationId),
      eq(changeOrders.projectId, projectId),
    ];
    if (query.status) conditions.push(eq(changeOrders.status, query.status));
    if (cursor) {
      conditions.push(or(
        lt(changeOrders.createdAt, cursor.createdAt),
        and(eq(changeOrders.createdAt, cursor.createdAt), lt(changeOrders.id, cursor.id)),
      )!);
    }
    return db
      .select()
      .from(changeOrders)
      .where(and(...conditions))
      .orderBy(desc(changeOrders.createdAt), desc(changeOrders.id))
      .limit(query.limit + 1);
  }

  async findLines(
    db: ChangeOrderDatabase,
    organizationId: string,
    projectId: string,
    changeOrderId: string,
  ) {
    return db
      .select()
      .from(changeOrderLines)
      .where(and(
        eq(changeOrderLines.organizationId, organizationId),
        eq(changeOrderLines.projectId, projectId),
        eq(changeOrderLines.changeOrderId, changeOrderId),
      ))
      .orderBy(changeOrderLines.lineNumber);
  }

  async create(tx: DatabaseTransaction, values: typeof changeOrders.$inferInsert) {
    const [row] = await tx.insert(changeOrders).values(values).returning();
    return row!;
  }

  async createLines(tx: DatabaseTransaction, values: (typeof changeOrderLines.$inferInsert)[]) {
    return tx.insert(changeOrderLines).values(values).returning();
  }

  async replaceLines(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    changeOrderId: string,
    values: (typeof changeOrderLines.$inferInsert)[],
  ) {
    await tx.delete(changeOrderLines).where(and(
      eq(changeOrderLines.organizationId, organizationId),
      eq(changeOrderLines.projectId, projectId),
      eq(changeOrderLines.changeOrderId, changeOrderId),
    ));
    return this.createLines(tx, values);
  }

  async update(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    changeOrderId: string,
    expectedVersion: number,
    values: Partial<typeof changeOrders.$inferInsert>,
  ) {
    const [row] = await tx
      .update(changeOrders)
      .set({ ...values, updatedAt: new Date() })
      .where(and(
        eq(changeOrders.id, changeOrderId),
        eq(changeOrders.organizationId, organizationId),
        eq(changeOrders.projectId, projectId),
        eq(changeOrders.version, expectedVersion),
      ))
      .returning();
    return row ?? null;
  }

  async validateLines(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    values: Array<{
      costCodeId: string;
      phaseId?: string;
      taskId?: string;
      documentId?: string;
      boqLineId?: string;
    }>,
  ) {
    // No authoritative BOQ-line source exists yet, so those references cannot be safely scoped.
    if (values.some((line) => line.boqLineId)) return false;
    const costCodeIds = [...new Set(values.map((line) => line.costCodeId))];
    const phaseIds = [...new Set(values.flatMap((line) => line.phaseId ? [line.phaseId] : []))];
    const taskIds = [...new Set(values.flatMap((line) => line.taskId ? [line.taskId] : []))];
    const documentIds = [...new Set(values.flatMap((line) => line.documentId ? [line.documentId] : []))];
    const [codes, phases, taskRows, documentRows] = await Promise.all([
      tx.select({ id: projectCostCodes.id }).from(projectCostCodes).where(and(
        eq(projectCostCodes.organizationId, organizationId),
        eq(projectCostCodes.projectId, projectId),
        eq(projectCostCodes.isActive, true),
        inArray(projectCostCodes.id, costCodeIds),
      )),
      phaseIds.length ? tx.select({ id: projectPhases.id }).from(projectPhases).where(and(
        eq(projectPhases.organizationId, organizationId),
        eq(projectPhases.projectId, projectId),
        eq(projectPhases.status, 'ACTIVE'),
        inArray(projectPhases.id, phaseIds),
      )) : [],
      taskIds.length ? tx.select({ id: tasks.id, phaseId: tasks.phaseId }).from(tasks).where(and(
        eq(tasks.organizationId, organizationId),
        eq(tasks.projectId, projectId),
        inArray(tasks.id, taskIds),
      )) : [],
      documentIds.length ? tx.select({ id: documents.id }).from(documents).where(and(
        eq(documents.organizationId, organizationId),
        eq(documents.projectId, projectId),
        inArray(documents.id, documentIds),
      )) : [],
    ]);
    const invalidTaskPhase = values.some((line) => {
      if (!line.taskId || !line.phaseId) return false;
      const task = taskRows.find((row) => row.id === line.taskId);
      return task?.phaseId != null && task.phaseId !== line.phaseId;
    });
    return codes.length === costCodeIds.length &&
      phases.length === phaseIds.length &&
      taskRows.length === taskIds.length &&
      documentRows.length === documentIds.length &&
      !invalidTaskPhase;
  }

  async getCurrentBudgetForUpdate(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
  ) {
    const [budget] = await tx.select().from(projectBudgets).where(and(
      eq(projectBudgets.organizationId, organizationId),
      eq(projectBudgets.projectId, projectId),
    )).limit(1).for('update');
    if (!budget) return null;
    const [revision] = await tx.select().from(projectBudgetRevisions).where(and(
      eq(projectBudgetRevisions.organizationId, organizationId),
      eq(projectBudgetRevisions.projectId, projectId),
      eq(projectBudgetRevisions.budgetId, budget.id),
      eq(projectBudgetRevisions.revisionNumber, budget.currentRevisionNumber),
    )).limit(1).for('update');
    const lines = revision
      ? await tx.select().from(projectBudgetLines).where(and(
          eq(projectBudgetLines.organizationId, organizationId),
          eq(projectBudgetLines.projectId, projectId),
          eq(projectBudgetLines.revisionId, revision.id),
        )).orderBy(projectBudgetLines.lineNumber)
      : [];
    return { budget, revision, lines };
  }

  async createBudgetRevision(
    tx: DatabaseTransaction,
    values: typeof projectBudgetRevisions.$inferInsert,
  ) {
    const [row] = await tx.insert(projectBudgetRevisions).values(values).returning();
    return row!;
  }

  async insertBudgetLines(
    tx: DatabaseTransaction,
    values: (typeof projectBudgetLines.$inferInsert)[],
  ) {
    if (values.length === 0) return [];
    return tx.insert(projectBudgetLines).values(values).returning();
  }
}

export const changeOrderRepository = new ChangeOrderRepository();
