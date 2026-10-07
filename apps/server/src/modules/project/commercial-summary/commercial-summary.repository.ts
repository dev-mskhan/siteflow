import { and, eq, inArray, sum } from 'drizzle-orm';
import {
  committedCosts,
  costTransactions,
  projectBudgetLines,
  projectBudgetRevisions,
  projectBudgets,
  projectCostCodes,
  projects,
  purchaseOrderItems,
  purchaseOrders,
} from '@siteflow/database/schema';
import type { getDb } from '../../../lib/db/index.js';

type CommercialDatabase = ReturnType<typeof getDb>;

export class CommercialSummaryRepository {
  async findProjectCurrency(db: CommercialDatabase, organizationId: string, projectId: string) {
    const [project] = await db
      .select({ currencyCode: projects.currency })
      .from(projects)
      .where(and(eq(projects.organizationId, organizationId), eq(projects.id, projectId)))
      .limit(1);
    return project?.currencyCode ?? null;
  }

  async findCostCode(
    db: CommercialDatabase,
    organizationId: string,
    projectId: string,
    costCodeId: string,
  ) {
    const [costCode] = await db
      .select({
        id: projectCostCodes.id,
        code: projectCostCodes.code,
        description: projectCostCodes.description,
      })
      .from(projectCostCodes)
      .where(
        and(
          eq(projectCostCodes.organizationId, organizationId),
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.id, costCodeId),
        ),
      )
      .limit(1);
    return costCode ?? null;
  }

  async findApprovedBudgetLines(
    db: CommercialDatabase,
    organizationId: string,
    projectId: string,
    costCodeId?: string,
  ) {
    return db
      .select({
        currencyCode: projectBudgets.currencyCode,
        revisionNumber: projectBudgetRevisions.revisionNumber,
        costCodeId: projectBudgetLines.costCodeId,
        total: sum(projectBudgetLines.amount),
      })
      .from(projectBudgetRevisions)
      .innerJoin(
        projectBudgets,
        and(
          eq(projectBudgets.id, projectBudgetRevisions.budgetId),
          eq(projectBudgets.organizationId, projectBudgetRevisions.organizationId),
          eq(projectBudgets.projectId, projectBudgetRevisions.projectId),
        ),
      )
      .innerJoin(
        projectBudgetLines,
        and(
          eq(projectBudgetLines.revisionId, projectBudgetRevisions.id),
          eq(projectBudgetLines.organizationId, projectBudgetRevisions.organizationId),
          eq(projectBudgetLines.projectId, projectBudgetRevisions.projectId),
        ),
      )
      .where(
        and(
          eq(projectBudgetRevisions.organizationId, organizationId),
          eq(projectBudgetRevisions.projectId, projectId),
          inArray(projectBudgetRevisions.status, ['APPROVED', 'SUPERSEDED', 'CLOSED']),
          ...(costCodeId ? [eq(projectBudgetLines.costCodeId, costCodeId)] : []),
        ),
      )
      .groupBy(
        projectBudgets.currencyCode,
        projectBudgetRevisions.revisionNumber,
        projectBudgetLines.costCodeId,
      );
  }

  async findProjectCommitments(db: CommercialDatabase, organizationId: string, projectId: string) {
    return db
      .select({
        currencyCode: committedCosts.currencyCode,
        total: sum(committedCosts.committedAmount),
      })
      .from(committedCosts)
      .innerJoin(
        purchaseOrders,
        and(
          eq(purchaseOrders.id, committedCosts.purchaseOrderId),
          eq(purchaseOrders.organizationId, committedCosts.organizationId),
          eq(purchaseOrders.projectId, committedCosts.projectId),
          eq(purchaseOrders.status, 'APPROVED'),
        ),
      )
      .where(
        and(
          eq(committedCosts.organizationId, organizationId),
          eq(committedCosts.projectId, projectId),
          eq(committedCosts.sourceType, 'PURCHASE_ORDER'),
          eq(committedCosts.status, 'ACTIVE'),
        ),
      )
      .groupBy(committedCosts.currencyCode);
  }

  async findCostCodeCommitments(
    db: CommercialDatabase,
    organizationId: string,
    projectId: string,
    costCodeId: string,
  ) {
    return db
      .select({
        currencyCode: committedCosts.currencyCode,
        total: sum(purchaseOrderItems.lineTotal),
      })
      .from(committedCosts)
      .innerJoin(
        purchaseOrders,
        and(
          eq(purchaseOrders.id, committedCosts.purchaseOrderId),
          eq(purchaseOrders.organizationId, committedCosts.organizationId),
          eq(purchaseOrders.projectId, committedCosts.projectId),
          eq(purchaseOrders.status, 'APPROVED'),
        ),
      )
      .innerJoin(
        purchaseOrderItems,
        and(
          eq(purchaseOrderItems.organizationId, committedCosts.organizationId),
          eq(purchaseOrderItems.purchaseOrderId, committedCosts.sourceId),
          eq(purchaseOrderItems.costCodeId, costCodeId),
        ),
      )
      .where(
        and(
          eq(committedCosts.organizationId, organizationId),
          eq(committedCosts.projectId, projectId),
          eq(committedCosts.sourceType, 'PURCHASE_ORDER'),
          eq(committedCosts.status, 'ACTIVE'),
        ),
      )
      .groupBy(committedCosts.currencyCode);
  }

  async findPostedActuals(
    db: CommercialDatabase,
    organizationId: string,
    projectId: string,
    costCodeId?: string,
  ) {
    return db
      .select({
        currencyCode: costTransactions.currencyCode,
        total: sum(costTransactions.totalAmount),
      })
      .from(costTransactions)
      .where(
        and(
          eq(costTransactions.organizationId, organizationId),
          eq(costTransactions.projectId, projectId),
          eq(costTransactions.status, 'POSTED'),
          ...(costCodeId ? [eq(costTransactions.costCodeId, costCodeId)] : []),
        ),
      )
      .groupBy(costTransactions.currencyCode);
  }
}

export const commercialSummaryRepository = new CommercialSummaryRepository();
