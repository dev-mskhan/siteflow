import { sql } from 'drizzle-orm';
import {
  check,
  date,
  foreignKey,
  index,
  integer,
  numeric,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { organizations } from './org.schema';
import { paymentApplications } from './payment-application.schema';
import { projects } from './project.schema';
import { purchaseOrders, suppliers } from './procurement.schema';

export const invoices = appSchema.table(
  'invoices',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull(),
    direction: text('direction').notNull(),
    invoiceNumber: text('invoice_number').notNull(),
    supplierId: text('supplier_id'),
    purchaseOrderId: text('purchase_order_id'),
    paymentApplicationId: text('payment_application_id'),
    billToName: text('bill_to_name'),
    invoiceDate: date('invoice_date', { mode: 'string' }).notNull(),
    dueDate: date('due_date', { mode: 'string' }),
    currencyCode: text('currency_code').notNull(),
    subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull(),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),
    retainageAmount: numeric('retainage_amount', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
    status: text('status').notNull().default('DRAFT'),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: text('rejected_by').references(() => users.id, { onDelete: 'restrict' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    voidedBy: text('voided_by').references(() => users.id, { onDelete: 'restrict' }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: 'invoices_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'invoices_purchase_order_scope_fk',
      columns: [t.purchaseOrderId, t.organizationId, t.projectId],
      foreignColumns: [purchaseOrders.id, purchaseOrders.organizationId, purchaseOrders.projectId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'invoices_payment_application_scope_fk',
      columns: [t.paymentApplicationId, t.organizationId, t.projectId],
      foreignColumns: [
        paymentApplications.id,
        paymentApplications.organizationId,
        paymentApplications.projectId,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'invoices_supplier_org_fk',
      columns: [t.supplierId, t.organizationId],
      foreignColumns: [suppliers.id, suppliers.organizationId],
    }).onDelete('restrict'),
    uniqueIndex('invoices_number_unique').on(
      t.organizationId,
      t.projectId,
      t.direction,
      t.invoiceNumber,
    ),
    uniqueIndex('invoices_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    uniqueIndex('invoices_application_unique')
      .on(t.paymentApplicationId)
      .where(sql`${t.paymentApplicationId} IS NOT NULL`),
    index('invoices_project_status_date_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.invoiceDate.desc(),
      t.id.desc(),
    ),
    check('invoices_direction_check', sql`${t.direction} IN ('RECEIVABLE', 'PAYABLE')`),
    check(
      'invoices_source_check',
      sql`(${t.direction} = 'RECEIVABLE' AND ${t.billToName} IS NOT NULL AND ${t.supplierId} IS NULL AND ${t.purchaseOrderId} IS NULL)
        OR (${t.direction} = 'PAYABLE' AND ${t.billToName} IS NULL AND ${t.supplierId} IS NOT NULL AND ${t.purchaseOrderId} IS NOT NULL)`,
    ),
    check('invoices_number_nonempty', sql`length(trim(${t.invoiceNumber})) > 0`),
    check('invoices_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check('invoices_dates_check', sql`${t.dueDate} IS NULL OR ${t.dueDate} >= ${t.invoiceDate}`),
    check(
      'invoices_amounts_check',
      sql`${t.subtotal} >= 0 AND ${t.taxAmount} >= 0 AND ${t.retainageAmount} >= 0 AND ${t.totalAmount} = ${t.subtotal} + ${t.taxAmount} - ${t.retainageAmount} AND ${t.totalAmount} > 0`,
    ),
    check('invoices_version_check', sql`${t.version} > 0`),
    check(
      'invoices_status_check',
      sql`${t.status} IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'VOIDED')`,
    ),
    check(
      'invoices_submit_metadata_check',
      sql`${t.status} NOT IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED') OR (${t.submittedBy} IS NOT NULL AND ${t.submittedAt} IS NOT NULL)`,
    ),
    check(
      'invoices_approval_metadata_check',
      sql`${t.status} <> 'APPROVED' OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      'invoices_rejection_metadata_check',
      sql`${t.status} <> 'REJECTED' OR (${t.rejectedBy} IS NOT NULL AND ${t.rejectedAt} IS NOT NULL AND ${t.rejectionReason} IS NOT NULL)`,
    ),
    check(
      'invoices_void_metadata_check',
      sql`${t.status} <> 'VOIDED' OR (${t.voidedBy} IS NOT NULL AND ${t.voidedAt} IS NOT NULL)`,
    ),
  ],
);

export const payments = appSchema.table(
  'payments',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    invoiceId: text('invoice_id').notNull(),
    direction: text('direction').notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    currencyCode: text('currency_code').notNull(),
    paymentDate: date('payment_date', { mode: 'string' }).notNull(),
    method: text('method').notNull(),
    reference: text('reference'),
    status: text('status').notNull().default('DRAFT'),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: text('rejected_by').references(() => users.id, { onDelete: 'restrict' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    executedBy: text('executed_by').references(() => users.id, { onDelete: 'restrict' }),
    executedAt: timestamp('executed_at', { withTimezone: true }),
    voidedBy: text('voided_by').references(() => users.id, { onDelete: 'restrict' }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: 'payments_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'payments_invoice_scope_fk',
      columns: [t.invoiceId, t.organizationId, t.projectId],
      foreignColumns: [invoices.id, invoices.organizationId, invoices.projectId],
    }).onDelete('restrict'),
    index('payments_invoice_status_idx').on(t.organizationId, t.projectId, t.invoiceId, t.status),
    index('payments_project_financial_summary_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.currencyCode,
      t.direction,
    ),
    index('payments_project_created_id_idx').on(
      t.organizationId,
      t.projectId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    uniqueIndex('payments_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    check('payments_direction_check', sql`${t.direction} IN ('RECEIVABLE', 'PAYABLE')`),
    check('payments_amount_check', sql`${t.amount} > 0`),
    check('payments_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check(
      'payments_method_check',
      sql`length(trim(${t.method})) > 0 AND length(${t.method}) <= 64`,
    ),
    check('payments_version_check', sql`${t.version} > 0`),
    check(
      'payments_status_check',
      sql`${t.status} IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED', 'VOIDED')`,
    ),
    check(
      'payments_submit_metadata_check',
      sql`${t.status} NOT IN ('PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXECUTED') OR (${t.submittedBy} IS NOT NULL AND ${t.submittedAt} IS NOT NULL)`,
    ),
    check(
      'payments_approval_metadata_check',
      sql`${t.status} NOT IN ('APPROVED', 'EXECUTED') OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      'payments_execution_metadata_check',
      sql`${t.status} <> 'EXECUTED' OR (${t.executedBy} IS NOT NULL AND ${t.executedAt} IS NOT NULL)`,
    ),
    check(
      'payments_rejection_metadata_check',
      sql`${t.status} <> 'REJECTED' OR (${t.rejectedBy} IS NOT NULL AND ${t.rejectedAt} IS NOT NULL AND ${t.rejectionReason} IS NOT NULL)`,
    ),
    check(
      'payments_void_metadata_check',
      sql`${t.status} <> 'VOIDED' OR (${t.voidedBy} IS NOT NULL AND ${t.voidedAt} IS NOT NULL)`,
    ),
  ],
);

export type Invoice = typeof invoices.$inferSelect;
export type Payment = typeof payments.$inferSelect;
