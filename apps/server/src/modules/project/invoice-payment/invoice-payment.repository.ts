import { and, desc, eq, inArray, lt, or, sql, type SQL } from 'drizzle-orm';
import type { DatabaseTransaction } from '@siteflow/database';
import { invoices, payments, paymentApplications, purchaseOrders } from '@siteflow/database/schema';
import type { getDb } from '../../../lib/db/index.js';
import type { ListInvoicesQuery, ListPaymentsQuery } from '@siteflow/shared';

type Db = DatabaseTransaction | ReturnType<typeof getDb>;

export interface Cursor {
  createdAt: Date;
  id: string;
}

export class InvoicePaymentRepository {
  findInvoice(db: Db, organizationId: string, projectId: string, id: string, lock = false) {
    const query = db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, id),
          eq(invoices.organizationId, organizationId),
          eq(invoices.projectId, projectId),
        ),
      )
      .limit(1);
    return lock ? query.for('update') : query;
  }

  findPayment(db: Db, organizationId: string, projectId: string, id: string, lock = false) {
    const query = db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.id, id),
          eq(payments.organizationId, organizationId),
          eq(payments.projectId, projectId),
        ),
      )
      .limit(1);
    return lock ? query.for('update') : query;
  }

  findPurchaseOrder(
    db: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    id: string,
  ) {
    return db
      .select()
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.id, id),
          eq(purchaseOrders.organizationId, organizationId),
          eq(purchaseOrders.projectId, projectId),
        ),
      )
      .limit(1)
      .for('update');
  }

  findPaymentApplication(
    db: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    id: string,
  ) {
    return db
      .select()
      .from(paymentApplications)
      .where(
        and(
          eq(paymentApplications.id, id),
          eq(paymentApplications.organizationId, organizationId),
          eq(paymentApplications.projectId, projectId),
        ),
      )
      .limit(1)
      .for('update');
  }

  async approvedPurchaseOrderInvoiceTotal(
    db: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    purchaseOrderId: string,
  ) {
    const [row] = await db
      .select({
        amount: sql<string>`COALESCE(SUM(${invoices.totalAmount}), 0)::text`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.projectId, projectId),
          eq(invoices.purchaseOrderId, purchaseOrderId),
          eq(invoices.status, 'APPROVED'),
        ),
      );
    return row?.amount ?? '0';
  }

  async paidTotals(db: Db, organizationId: string, projectId: string, invoiceIds: string[]) {
    if (invoiceIds.length === 0) return new Map<string, string>();
    const rows = await db
      .select({
        invoiceId: payments.invoiceId,
        amount: sql<string>`COALESCE(SUM(${payments.amount}), 0)::text`,
      })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.projectId, projectId),
          inArray(payments.invoiceId, invoiceIds),
          eq(payments.status, 'EXECUTED'),
        ),
      )
      .groupBy(payments.invoiceId);
    return new Map(rows.map((row) => [row.invoiceId, row.amount]));
  }

  async listInvoices(
    db: Db,
    organizationId: string,
    projectId: string,
    query: ListInvoicesQuery,
    cursor?: Cursor,
  ) {
    const conditions: SQL[] = [
      eq(invoices.organizationId, organizationId),
      eq(invoices.projectId, projectId),
    ];
    if (query.direction) conditions.push(eq(invoices.direction, query.direction));
    if (query.status) conditions.push(eq(invoices.status, query.status));
    if (cursor) {
      conditions.push(
        or(
          lt(invoices.createdAt, cursor.createdAt),
          and(eq(invoices.createdAt, cursor.createdAt), lt(invoices.id, cursor.id)),
        )!,
      );
    }
    return db
      .select()
      .from(invoices)
      .where(and(...conditions))
      .orderBy(desc(invoices.createdAt), desc(invoices.id))
      .limit(query.limit + 1);
  }

  async listPayments(
    db: Db,
    organizationId: string,
    projectId: string,
    query: ListPaymentsQuery,
    cursor?: Cursor,
  ) {
    const conditions: SQL[] = [
      eq(payments.organizationId, organizationId),
      eq(payments.projectId, projectId),
    ];
    if (query.invoiceId) conditions.push(eq(payments.invoiceId, query.invoiceId));
    if (query.status) conditions.push(eq(payments.status, query.status));
    if (cursor) {
      conditions.push(
        or(
          lt(payments.createdAt, cursor.createdAt),
          and(eq(payments.createdAt, cursor.createdAt), lt(payments.id, cursor.id)),
        )!,
      );
    }
    return db
      .select()
      .from(payments)
      .where(and(...conditions))
      .orderBy(desc(payments.createdAt), desc(payments.id))
      .limit(query.limit + 1);
  }

  createInvoice(tx: DatabaseTransaction, value: typeof invoices.$inferInsert) {
    return tx.insert(invoices).values(value).returning();
  }

  createPayment(tx: DatabaseTransaction, value: typeof payments.$inferInsert) {
    return tx.insert(payments).values(value).returning();
  }

  updateInvoice(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    id: string,
    version: number,
    value: Partial<typeof invoices.$inferInsert>,
  ) {
    return tx
      .update(invoices)
      .set({ ...value, updatedAt: new Date() })
      .where(
        and(
          eq(invoices.id, id),
          eq(invoices.organizationId, organizationId),
          eq(invoices.projectId, projectId),
          eq(invoices.version, version),
        ),
      )
      .returning();
  }

  updatePayment(
    tx: DatabaseTransaction,
    organizationId: string,
    projectId: string,
    id: string,
    version: number,
    value: Partial<typeof payments.$inferInsert>,
  ) {
    return tx
      .update(payments)
      .set({ ...value, updatedAt: new Date() })
      .where(
        and(
          eq(payments.id, id),
          eq(payments.organizationId, organizationId),
          eq(payments.projectId, projectId),
          eq(payments.version, version),
        ),
      )
      .returning();
  }
}

export const invoicePaymentRepository = new InvoicePaymentRepository();
