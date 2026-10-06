import { and, desc, eq, inArray, lt, or, type SQL } from 'drizzle-orm';
import {
  costTransactions,
  projectCostCodes,
  projectPhases,
  tasks,
  documents,
} from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import type { getDb } from '../../../lib/db/index.js';
import type { ListCostTransactionsQuery } from '@siteflow/shared';

type CostDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

export interface CostTransactionCursor {
  createdAt: Date;
  id: string;
}

export class CostTransactionRepository {
  async findById(
    db: CostDatabase,
    organizationId: string,
    projectId: string,
    transactionId: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(costTransactions)
      .where(
        and(
          eq(costTransactions.organizationId, organizationId),
          eq(costTransactions.projectId, projectId),
          eq(costTransactions.id, transactionId),
        ),
      )
      .limit(1);
    return lock ? query.for('update') : query;
  }

  async findReversal(
    db: CostDatabase,
    organizationId: string,
    projectId: string,
    transactionId: string,
  ) {
    return db
      .select({ id: costTransactions.id })
      .from(costTransactions)
      .where(
        and(
          eq(costTransactions.organizationId, organizationId),
          eq(costTransactions.projectId, projectId),
          eq(costTransactions.reversalOfId, transactionId),
        ),
      )
      .limit(1);
  }

  async findReversals(
    db: CostDatabase,
    organizationId: string,
    projectId: string,
    transactionIds: string[],
  ) {
    if (transactionIds.length === 0) return [];
    return db
      .select({ id: costTransactions.id, reversalOfId: costTransactions.reversalOfId })
      .from(costTransactions)
      .where(
        and(
          eq(costTransactions.organizationId, organizationId),
          eq(costTransactions.projectId, projectId),
          inArray(costTransactions.reversalOfId, transactionIds),
        ),
      );
  }

  async insert(tx: DatabaseTransaction, values: typeof costTransactions.$inferInsert) {
    const [row] = await tx.insert(costTransactions).values(values).returning();
    return row!;
  }

  async update(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    transactionId: string,
    expectedVersion: number,
    values: Partial<typeof costTransactions.$inferInsert>,
  ) {
    const [row] = await tx
      .update(costTransactions)
      .set(values)
      .where(
        and(
          eq(costTransactions.id, transactionId),
          eq(costTransactions.organizationId, organizationId),
          eq(costTransactions.projectId, projectId),
          eq(costTransactions.version, expectedVersion),
        ),
      )
      .returning();
    return row ?? null;
  }

  async validateReferences(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    input: {
      costCodeId: string;
      phaseId?: string;
      taskId?: string;
      documentId?: string;
      sourceType: 'MANUAL' | 'DOCUMENT' | 'TASK' | 'PHASE';
      sourceId?: string;
    },
    lockCostCode = false,
  ) {
    const codeQuery = tx
      .select({ id: projectCostCodes.id, isActive: projectCostCodes.isActive })
      .from(projectCostCodes)
      .where(
        and(
          eq(projectCostCodes.id, input.costCodeId),
          eq(projectCostCodes.organizationId, organizationId),
          eq(projectCostCodes.projectId, projectId),
        ),
      )
      .limit(1);
    const codeRows = lockCostCode ? await codeQuery.for('update') : await codeQuery;
    const [phaseRows, taskRows, documentRows, sourceRows] = await Promise.all([
      input.phaseId
        ? tx
            .select({ id: projectPhases.id })
            .from(projectPhases)
            .where(
              and(
                eq(projectPhases.id, input.phaseId),
                eq(projectPhases.organizationId, organizationId),
                eq(projectPhases.projectId, projectId),
              ),
            )
            .limit(1)
        : [],
      input.taskId
        ? tx
            .select({ id: tasks.id, phaseId: tasks.phaseId })
            .from(tasks)
            .where(
              and(
                eq(tasks.id, input.taskId),
                eq(tasks.organizationId, organizationId),
                eq(tasks.projectId, projectId),
              ),
            )
            .limit(1)
        : [],
      input.documentId
        ? tx
            .select({ id: documents.id })
            .from(documents)
            .where(
              and(
                eq(documents.id, input.documentId),
                eq(documents.organizationId, organizationId),
                eq(documents.projectId, projectId),
              ),
            )
            .limit(1)
        : [],
      input.sourceType === 'DOCUMENT' && input.sourceId
        ? tx
            .select({ id: documents.id })
            .from(documents)
            .where(
              and(
                eq(documents.id, input.sourceId),
                eq(documents.organizationId, organizationId),
                eq(documents.projectId, projectId),
              ),
            )
            .limit(1)
        : input.sourceType === 'TASK' && input.sourceId
          ? tx
              .select({ id: tasks.id })
              .from(tasks)
              .where(
                and(
                  eq(tasks.id, input.sourceId),
                  eq(tasks.organizationId, organizationId),
                  eq(tasks.projectId, projectId),
                ),
              )
              .limit(1)
          : input.sourceType === 'PHASE' && input.sourceId
            ? tx
                .select({ id: projectPhases.id })
                .from(projectPhases)
                .where(
                  and(
                    eq(projectPhases.id, input.sourceId),
                    eq(projectPhases.organizationId, organizationId),
                    eq(projectPhases.projectId, projectId),
                  ),
                )
                .limit(1)
            : [],
    ]);
    const taskPhaseMismatch =
      input.phaseId !== undefined &&
      taskRows.length > 0 &&
      taskRows[0]!.phaseId !== null &&
      taskRows[0]!.phaseId !== input.phaseId;
    const sourceMissing = input.sourceType !== 'MANUAL' && sourceRows.length === 0;
    return {
      costCode: codeRows[0] ?? null,
      valid:
        codeRows.length > 0 &&
        (input.phaseId === undefined || phaseRows.length > 0) &&
        (input.taskId === undefined || taskRows.length > 0) &&
        (input.documentId === undefined || documentRows.length > 0) &&
        !taskPhaseMismatch &&
        !sourceMissing,
    };
  }

  async list(
    db: CostDatabase,
    organizationId: string,
    projectId: string,
    query: ListCostTransactionsQuery,
    cursor?: CostTransactionCursor,
  ) {
    const conditions: SQL[] = [
      eq(costTransactions.organizationId, organizationId),
      eq(costTransactions.projectId, projectId),
    ];
    if (query.status) conditions.push(eq(costTransactions.status, query.status));
    if (query.costCodeId) conditions.push(eq(costTransactions.costCodeId, query.costCodeId));
    if (cursor) {
      conditions.push(
        or(
          lt(costTransactions.createdAt, cursor.createdAt),
          and(
            eq(costTransactions.createdAt, cursor.createdAt),
            lt(costTransactions.id, cursor.id),
          ),
        )!,
      );
    }
    return db
      .select()
      .from(costTransactions)
      .where(and(...conditions))
      .orderBy(desc(costTransactions.createdAt), desc(costTransactions.id))
      .limit(query.limit + 1);
  }
}

export const costTransactionRepository = new CostTransactionRepository();
