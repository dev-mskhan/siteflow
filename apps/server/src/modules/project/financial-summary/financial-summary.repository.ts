import { and, desc, eq, inArray, lt, or, sql, sum } from 'drizzle-orm';
import {
  changeOrders,
  financialAuditEvents,
  invoices,
  paymentApplications,
  payments,
  retainageRecords,
  scheduleOfValueRevisions,
  scheduleOfValues,
} from '@siteflow/database/schema';
import type { FinancialAuditQuery } from '@siteflow/shared';
import type { getDb } from '../../../lib/db/index.js';

type Database = ReturnType<typeof getDb>;
type AuditCursor = { createdAt: string; id: string };

export class FinancialSummaryRepository {
  async findApprovedContractValues(db: Database, organizationId: string, projectId: string) {
    return db
      .select({
        currencyCode: scheduleOfValueRevisions.currencyCode,
        total: sum(scheduleOfValueRevisions.contractValue),
      })
      .from(scheduleOfValues)
      .innerJoin(
        scheduleOfValueRevisions,
        and(
          eq(scheduleOfValueRevisions.scheduleOfValuesId, scheduleOfValues.id),
          eq(scheduleOfValueRevisions.organizationId, scheduleOfValues.organizationId),
          eq(scheduleOfValueRevisions.projectId, scheduleOfValues.projectId),
          eq(scheduleOfValueRevisions.revisionNumber, scheduleOfValues.currentRevisionNumber),
          eq(scheduleOfValueRevisions.status, 'APPROVED'),
        ),
      )
      .where(
        and(
          eq(scheduleOfValues.organizationId, organizationId),
          eq(scheduleOfValues.projectId, projectId),
        ),
      )
      .groupBy(scheduleOfValueRevisions.currencyCode);
  }

  async findApprovedApplications(db: Database, organizationId: string, projectId: string) {
    return db
      .select({
        currencyCode: paymentApplications.currencyCode,
        total: sum(paymentApplications.approvedAmount),
      })
      .from(paymentApplications)
      .where(
        and(
          eq(paymentApplications.organizationId, organizationId),
          eq(paymentApplications.projectId, projectId),
          inArray(paymentApplications.status, ['APPROVED', 'PARTIALLY_APPROVED']),
        ),
      )
      .groupBy(paymentApplications.currencyCode);
  }

  async findBilledInvoiceTotals(db: Database, organizationId: string, projectId: string) {
    return db
      .select({
        currencyCode: invoices.currencyCode,
        direction: invoices.direction,
        total: sum(invoices.totalAmount),
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.projectId, projectId),
          inArray(invoices.status, ['PENDING_APPROVAL', 'APPROVED', 'REJECTED']),
        ),
      )
      .groupBy(invoices.currencyCode, invoices.direction);
  }

  async findApprovedInvoiceTotals(db: Database, organizationId: string, projectId: string) {
    return db
      .select({
        currencyCode: invoices.currencyCode,
        direction: invoices.direction,
        total: sum(invoices.totalAmount),
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.projectId, projectId),
          eq(invoices.status, 'APPROVED'),
        ),
      )
      .groupBy(invoices.currencyCode, invoices.direction);
  }

  async findExecutedPayments(db: Database, organizationId: string, projectId: string) {
    return db
      .select({
        currencyCode: payments.currencyCode,
        direction: payments.direction,
        total: sum(payments.amount),
      })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.projectId, projectId),
          eq(payments.status, 'EXECUTED'),
        ),
      )
      .groupBy(payments.currencyCode, payments.direction);
  }

  async findRetainageTotals(db: Database, organizationId: string, projectId: string) {
    return db
      .select({
        currencyCode: retainageRecords.currencyCode,
        held: sum(retainageRecords.remainingAmount),
        released: sum(retainageRecords.releasedAmount),
      })
      .from(retainageRecords)
      .where(
        and(
          eq(retainageRecords.organizationId, organizationId),
          eq(retainageRecords.projectId, projectId),
        ),
      )
      .groupBy(retainageRecords.currencyCode);
  }

  async findChangeOrder(
    db: Database,
    organizationId: string,
    projectId: string,
    changeOrderId: string,
  ) {
    const [row] = await db
      .select({ id: changeOrders.id })
      .from(changeOrders)
      .where(
        and(
          eq(changeOrders.organizationId, organizationId),
          eq(changeOrders.projectId, projectId),
          eq(changeOrders.id, changeOrderId),
        ),
      )
      .limit(1);
    return row ?? null;
  }

  async listAuditEvents(
    db: Database,
    organizationId: string,
    projectId: string,
    query: FinancialAuditQuery,
    cursor: AuditCursor | null,
    changeOrderId?: string,
  ) {
    const filters = [
      eq(financialAuditEvents.organizationId, organizationId),
      eq(financialAuditEvents.projectId, projectId),
      ...(query.action ? [eq(financialAuditEvents.action, query.action)] : []),
      ...(query.entityType ? [eq(financialAuditEvents.entityType, query.entityType)] : []),
      ...(query.entityId ? [eq(financialAuditEvents.entityId, query.entityId)] : []),
      ...(changeOrderId
        ? [
            eq(financialAuditEvents.entityType, 'ChangeOrder'),
            eq(financialAuditEvents.entityId, changeOrderId),
          ]
        : []),
      ...(cursor
        ? [
            or(
              sql`${financialAuditEvents.createdAt} < ${cursor.createdAt}::timestamptz`,
              and(
                sql`${financialAuditEvents.createdAt} = ${cursor.createdAt}::timestamptz`,
                lt(financialAuditEvents.id, cursor.id),
              ),
            )!,
          ]
        : []),
    ];
    return db
      .select({
        id: financialAuditEvents.id,
        organizationId: financialAuditEvents.organizationId,
        projectId: financialAuditEvents.projectId,
        actorUserId: financialAuditEvents.actorUserId,
        action: financialAuditEvents.action,
        entityType: financialAuditEvents.entityType,
        entityId: financialAuditEvents.entityId,
        previousState: financialAuditEvents.previousState,
        newState: financialAuditEvents.newState,
        amount: financialAuditEvents.amount,
        currencyCode: financialAuditEvents.currencyCode,
        reason: financialAuditEvents.reason,
        requestId: financialAuditEvents.requestId,
        createdAt: financialAuditEvents.createdAt,
        cursorCreatedAt: sql<string>`${financialAuditEvents.createdAt}::text`,
      })
      .from(financialAuditEvents)
      .where(and(...filters))
      .orderBy(desc(financialAuditEvents.createdAt), desc(financialAuditEvents.id))
      .limit(query.limit + 1);
  }
}

export const financialSummaryRepository = new FinancialSummaryRepository();
