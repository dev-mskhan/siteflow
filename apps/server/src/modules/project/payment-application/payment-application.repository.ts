import { and, desc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import {
  changeOrderLines,
  changeOrders,
  paymentApplicationLines,
  paymentApplications,
  scheduleOfValueLines,
  scheduleOfValueProgress,
  scheduleOfValueRevisions,
  scheduleOfValues,
  type NewPaymentApplicationLine,
} from '@siteflow/database/schema';
import type { DatabaseTransaction } from '@siteflow/database';
import type { getDb } from '../../../lib/db/index.js';

type PaymentDatabase = DatabaseTransaction | ReturnType<typeof getDb>;

export interface PaymentApplicationCursor {
  createdAt: Date;
  id: string;
}

export class PaymentApplicationRepository {
  async findSchedule(db: PaymentDatabase, organizationId: string, projectId: string, lock = false) {
    const query = db
      .select()
      .from(scheduleOfValues)
      .where(
        and(
          eq(scheduleOfValues.organizationId, organizationId),
          eq(scheduleOfValues.projectId, projectId),
        ),
      )
      .limit(1);
    return lock ? query.for('update') : query;
  }

  async findSovLinesByIds(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    lineIds: string[],
  ) {
    if (lineIds.length === 0) return [];
    return db
      .select({
        id: scheduleOfValueLines.id,
        costCodeId: scheduleOfValueLines.costCodeId,
      })
      .from(scheduleOfValueLines)
      .where(
        and(
          eq(scheduleOfValueLines.organizationId, organizationId),
          eq(scheduleOfValueLines.projectId, projectId),
          inArray(scheduleOfValueLines.id, lineIds),
        ),
      );
  }

  async findApprovedRevision(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    scheduleId: string,
    revisionNumber: number,
  ) {
    return db
      .select()
      .from(scheduleOfValueRevisions)
      .where(
        and(
          eq(scheduleOfValueRevisions.scheduleOfValuesId, scheduleId),
          eq(scheduleOfValueRevisions.organizationId, organizationId),
          eq(scheduleOfValueRevisions.projectId, projectId),
          eq(scheduleOfValueRevisions.revisionNumber, revisionNumber),
          eq(scheduleOfValueRevisions.status, 'APPROVED'),
        ),
      )
      .limit(1);
  }

  async findSovLines(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    revisionId: string,
    lineIds?: string[],
    lock = false,
  ) {
    const query = db
      .select()
      .from(scheduleOfValueLines)
      .where(
        and(
          eq(scheduleOfValueLines.organizationId, organizationId),
          eq(scheduleOfValueLines.projectId, projectId),
          eq(scheduleOfValueLines.revisionId, revisionId),
          ...(lineIds ? [inArray(scheduleOfValueLines.id, lineIds)] : []),
        ),
      );
    return lock ? query.for('update') : query;
  }

  async findById(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    id: string,
    lock = false,
  ) {
    const query = db
      .select()
      .from(paymentApplications)
      .where(
        and(
          eq(paymentApplications.id, id),
          eq(paymentApplications.organizationId, organizationId),
          eq(paymentApplications.projectId, projectId),
        ),
      )
      .limit(1);
    return lock ? query.for('update') : query;
  }

  async findLines(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    applicationId: string,
  ) {
    return db
      .select()
      .from(paymentApplicationLines)
      .where(
        and(
          eq(paymentApplicationLines.paymentApplicationId, applicationId),
          eq(paymentApplicationLines.organizationId, organizationId),
          eq(paymentApplicationLines.projectId, projectId),
        ),
      )
      .orderBy(paymentApplicationLines.lineNumber);
  }

  async findLinesForApplications(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    applicationIds: string[],
  ) {
    if (applicationIds.length === 0) return [];
    return db
      .select()
      .from(paymentApplicationLines)
      .where(
        and(
          eq(paymentApplicationLines.organizationId, organizationId),
          eq(paymentApplicationLines.projectId, projectId),
          inArray(paymentApplicationLines.paymentApplicationId, applicationIds),
        ),
      )
      .orderBy(paymentApplicationLines.paymentApplicationId, paymentApplicationLines.lineNumber);
  }

  async findProgress(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    lineIds: string[],
    lock = false,
  ) {
    if (lineIds.length === 0) return [];
    const query = db
      .select()
      .from(scheduleOfValueProgress)
      .where(
        and(
          eq(scheduleOfValueProgress.organizationId, organizationId),
          eq(scheduleOfValueProgress.projectId, projectId),
          inArray(scheduleOfValueProgress.scheduleOfValueLineId, lineIds),
        ),
      )
      .orderBy(scheduleOfValueProgress.scheduleOfValueLineId);
    return lock ? query.for('update') : query;
  }

  async nextApplicationNumber(db: PaymentDatabase, projectId: string) {
    const [result] = await db
      .select({
        lastNumber: sql<number>`COALESCE(MAX(${paymentApplications.applicationNumber}), 0)::int`,
      })
      .from(paymentApplications)
      .where(eq(paymentApplications.projectId, projectId));
    return (result?.lastNumber ?? 0) + 1;
  }

  async list(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    limit: number,
    cursor?: PaymentApplicationCursor,
  ) {
    return db
      .select()
      .from(paymentApplications)
      .where(
        and(
          eq(paymentApplications.organizationId, organizationId),
          eq(paymentApplications.projectId, projectId),
          ...(cursor
            ? [
                or(
                  lt(paymentApplications.createdAt, cursor.createdAt),
                  and(
                    eq(paymentApplications.createdAt, cursor.createdAt),
                    lt(paymentApplications.id, cursor.id),
                  ),
                )!,
              ]
            : []),
        ),
      )
      .orderBy(desc(paymentApplications.createdAt), desc(paymentApplications.id))
      .limit(limit + 1);
  }

  async priorApprovedGross(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    lineIds: string[],
    excludeApplicationId?: string,
  ) {
    if (lineIds.length === 0) return new Map<string, string>();
    const rows = await db
      .select({
        lineId: paymentApplicationLines.scheduleOfValueLineId,
        total: sql<string>`COALESCE(SUM(${paymentApplicationLines.approvedGross}), 0)::text`,
      })
      .from(paymentApplicationLines)
      .innerJoin(
        paymentApplications,
        and(
          eq(paymentApplications.id, paymentApplicationLines.paymentApplicationId),
          eq(paymentApplications.organizationId, paymentApplicationLines.organizationId),
          eq(paymentApplications.projectId, paymentApplicationLines.projectId),
        ),
      )
      .where(
        and(
          eq(paymentApplicationLines.organizationId, organizationId),
          eq(paymentApplicationLines.projectId, projectId),
          inArray(paymentApplicationLines.scheduleOfValueLineId, lineIds),
          inArray(paymentApplications.status, ['APPROVED', 'PARTIALLY_APPROVED']),
          ...(excludeApplicationId
            ? [sql`${paymentApplications.id} <> ${excludeApplicationId}`]
            : []),
        ),
      )
      .groupBy(paymentApplicationLines.scheduleOfValueLineId);
    return new Map(rows.map((row) => [row.lineId, row.total]));
  }

  async effectiveChangeOrderRevenueByCostCode(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    currencyCode: string,
    costCodeIds: string[],
  ) {
    if (costCodeIds.length === 0) return new Map<string, string>();
    const rows = await db
      .select({
        costCodeId: changeOrderLines.costCodeId,
        total: sql<string>`COALESCE(SUM(${changeOrderLines.revenueDelta}), 0)::text`,
      })
      .from(changeOrderLines)
      .innerJoin(
        changeOrders,
        and(
          eq(changeOrders.id, changeOrderLines.changeOrderId),
          eq(changeOrders.organizationId, changeOrderLines.organizationId),
          eq(changeOrders.projectId, changeOrderLines.projectId),
        ),
      )
      .where(
        and(
          eq(changeOrderLines.organizationId, organizationId),
          eq(changeOrderLines.projectId, projectId),
          eq(changeOrders.currencyCode, currencyCode),
          eq(changeOrders.status, 'EFFECTED'),
          inArray(changeOrderLines.costCodeId, costCodeIds),
        ),
      )
      .groupBy(changeOrderLines.costCodeId);
    return new Map(rows.map((row) => [row.costCodeId, row.total]));
  }

  async findEligibleChangeOrders(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    currencyCode: string,
    costCodeIds: string[],
  ) {
    if (costCodeIds.length === 0) return [];
    return db
      .select({
        changeOrderId: changeOrders.id,
        changeOrderNumber: changeOrders.changeOrderNumber,
        revenueDelta: sql<string>`SUM(${changeOrderLines.revenueDelta})::text`,
      })
      .from(changeOrderLines)
      .innerJoin(
        changeOrders,
        and(
          eq(changeOrders.id, changeOrderLines.changeOrderId),
          eq(changeOrders.organizationId, changeOrderLines.organizationId),
          eq(changeOrders.projectId, changeOrderLines.projectId),
        ),
      )
      .where(
        and(
          eq(changeOrderLines.organizationId, organizationId),
          eq(changeOrderLines.projectId, projectId),
          eq(changeOrders.currencyCode, currencyCode),
          eq(changeOrders.status, 'EFFECTED'),
          inArray(changeOrderLines.costCodeId, costCodeIds),
        ),
      )
      .groupBy(changeOrders.id, changeOrders.changeOrderNumber)
      .orderBy(changeOrders.changeOrderNumber);
  }

  async findEligibleChangeOrdersByCostCode(
    db: PaymentDatabase,
    organizationId: string,
    projectId: string,
    currencyCodes: string[],
    costCodeIds: string[],
  ) {
    if (currencyCodes.length === 0 || costCodeIds.length === 0) return [];
    return db
      .select({
        currencyCode: changeOrders.currencyCode,
        costCodeId: changeOrderLines.costCodeId,
        changeOrderId: changeOrders.id,
        changeOrderNumber: changeOrders.changeOrderNumber,
        revenueDelta: sql<string>`SUM(${changeOrderLines.revenueDelta})::text`,
      })
      .from(changeOrderLines)
      .innerJoin(
        changeOrders,
        and(
          eq(changeOrders.id, changeOrderLines.changeOrderId),
          eq(changeOrders.organizationId, changeOrderLines.organizationId),
          eq(changeOrders.projectId, changeOrderLines.projectId),
        ),
      )
      .where(
        and(
          eq(changeOrderLines.organizationId, organizationId),
          eq(changeOrderLines.projectId, projectId),
          inArray(changeOrders.currencyCode, currencyCodes),
          eq(changeOrders.status, 'EFFECTED'),
          inArray(changeOrderLines.costCodeId, costCodeIds),
        ),
      )
      .groupBy(
        changeOrders.currencyCode,
        changeOrderLines.costCodeId,
        changeOrders.id,
        changeOrders.changeOrderNumber,
      )
      .orderBy(
        changeOrders.currencyCode,
        changeOrderLines.costCodeId,
        changeOrders.changeOrderNumber,
      );
  }

  async updateProgress(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    lineId: string,
    values: Partial<typeof scheduleOfValueProgress.$inferInsert>,
  ) {
    return tx
      .update(scheduleOfValueProgress)
      .set(values)
      .where(
        and(
          eq(scheduleOfValueProgress.organizationId, organizationId),
          eq(scheduleOfValueProgress.projectId, projectId),
          eq(scheduleOfValueProgress.scheduleOfValueLineId, lineId),
        ),
      )
      .returning();
  }

  async create(tx: DatabaseTransaction, values: typeof paymentApplications.$inferInsert) {
    const [row] = await tx.insert(paymentApplications).values(values).returning();
    return row!;
  }

  async update(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    id: string,
    expectedVersion: number,
    values: Partial<typeof paymentApplications.$inferInsert>,
  ) {
    const [row] = await tx
      .update(paymentApplications)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(paymentApplications.id, id),
          eq(paymentApplications.organizationId, organizationId),
          eq(paymentApplications.projectId, projectId),
          eq(paymentApplications.version, expectedVersion),
        ),
      )
      .returning();
    return row ?? null;
  }

  async insertLines(tx: DatabaseTransaction, lines: NewPaymentApplicationLine[]) {
    if (lines.length === 0) return [];
    return tx.insert(paymentApplicationLines).values(lines).returning();
  }

  async replaceLines(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    id: string,
    lines: NewPaymentApplicationLine[],
  ) {
    await tx
      .delete(paymentApplicationLines)
      .where(
        and(
          eq(paymentApplicationLines.paymentApplicationId, id),
          eq(paymentApplicationLines.organizationId, organizationId),
          eq(paymentApplicationLines.projectId, projectId),
        ),
      );
    return this.insertLines(tx, lines);
  }
}

export const paymentApplicationRepository = new PaymentApplicationRepository();
