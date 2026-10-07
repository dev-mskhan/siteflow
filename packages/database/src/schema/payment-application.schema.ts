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
import { scheduleOfValueLines, scheduleOfValueRevisions } from './schedule-of-values.schema';
import { projects } from './project.schema';

export const paymentApplications = appSchema.table(
  'payment_applications',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull(),
    revisionId: text('revision_id').notNull(),
    applicationNumber: integer('application_number').notNull(),
    billingPeriodStart: date('billing_period_start', { mode: 'string' }).notNull(),
    billingPeriodEnd: date('billing_period_end', { mode: 'string' }).notNull(),
    currencyCode: text('currency_code').notNull(),
    status: text('status').notNull().default('DRAFT'),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'restrict' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: text('rejected_by').references(() => users.id, { onDelete: 'restrict' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    voidedBy: text('voided_by').references(() => users.id, { onDelete: 'restrict' }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    grossRequested: numeric('gross_requested', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    retainageRequested: numeric('retainage_requested', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    priorApprovedGross: numeric('prior_approved_gross', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    requestedAmount: numeric('requested_amount', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    approvedGross: numeric('approved_gross', { precision: 15, scale: 2 }).notNull().default('0.00'),
    approvedRetainage: numeric('approved_retainage', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    approvedAmount: numeric('approved_amount', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: 'payment_applications_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'payment_applications_revision_scope_fk',
      columns: [t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [
        scheduleOfValueRevisions.id,
        scheduleOfValueRevisions.organizationId,
        scheduleOfValueRevisions.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('payment_applications_number_unique').on(t.projectId, t.applicationNumber),
    uniqueIndex('payment_applications_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    index('payment_applications_project_status_period_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.billingPeriodEnd.desc(),
    ),
    index('payment_applications_project_created_id_idx').on(
      t.organizationId,
      t.projectId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    check('payment_applications_number_positive', sql`${t.applicationNumber} > 0`),
    check('payment_applications_version_positive', sql`${t.version} > 0`),
    check(
      'payment_applications_period_check',
      sql`${t.billingPeriodStart} <= ${t.billingPeriodEnd}`,
    ),
    check('payment_applications_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check(
      'payment_applications_status_check',
      sql`${t.status} IN ('DRAFT', 'PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED', 'VOIDED')`,
    ),
    check(
      'payment_applications_submission_metadata_check',
      sql`${t.status} NOT IN ('PENDING_REVIEW', 'UNDER_REVIEW', 'APPROVED', 'PARTIALLY_APPROVED', 'REJECTED') OR (${t.submittedBy} IS NOT NULL AND ${t.submittedAt} IS NOT NULL)`,
    ),
    check(
      'payment_applications_review_metadata_check',
      sql`${t.status} <> 'UNDER_REVIEW' OR (${t.reviewedBy} IS NOT NULL AND ${t.reviewedAt} IS NOT NULL)`,
    ),
    check(
      'payment_applications_approval_metadata_check',
      sql`${t.status} NOT IN ('APPROVED', 'PARTIALLY_APPROVED') OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      'payment_applications_rejection_metadata_check',
      sql`${t.status} <> 'REJECTED' OR (${t.rejectedBy} IS NOT NULL AND ${t.rejectedAt} IS NOT NULL AND ${t.rejectionReason} IS NOT NULL)`,
    ),
    check(
      'payment_applications_void_metadata_check',
      sql`${t.status} <> 'VOIDED' OR (${t.voidedBy} IS NOT NULL AND ${t.voidedAt} IS NOT NULL)`,
    ),
    check(
      'payment_applications_totals_nonnegative',
      sql`${t.grossRequested} >= 0 AND ${t.retainageRequested} >= 0 AND ${t.priorApprovedGross} >= 0 AND ${t.requestedAmount} >= 0 AND ${t.approvedGross} >= 0 AND ${t.approvedRetainage} >= 0 AND ${t.approvedAmount} >= 0`,
    ),
    check(
      'payment_applications_totals_reconcile',
      sql`${t.grossRequested} - ${t.retainageRequested} = ${t.requestedAmount} AND ${t.approvedGross} - ${t.approvedRetainage} = ${t.approvedAmount}`,
    ),
  ],
);

export const paymentApplicationLines = appSchema.table(
  'payment_application_lines',
  {
    id: text('id').primaryKey(),
    paymentApplicationId: text('payment_application_id').notNull(),
    scheduleOfValueLineId: text('schedule_of_value_line_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    lineNumber: integer('line_number').notNull(),
    currentWork: numeric('current_work', { precision: 15, scale: 2 }).notNull(),
    storedMaterials: numeric('stored_materials', { precision: 15, scale: 2 }).notNull(),
    grossCompleted: numeric('gross_completed', { precision: 15, scale: 2 }).notNull(),
    retainagePercent: numeric('retainage_percent', { precision: 5, scale: 2 }).notNull(),
    retainageRequested: numeric('retainage_requested', { precision: 15, scale: 2 }).notNull(),
    priorApprovedGross: numeric('prior_approved_gross', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    requestedAmount: numeric('requested_amount', { precision: 15, scale: 2 }).notNull(),
    approvedCurrentWork: numeric('approved_current_work', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    approvedStoredMaterials: numeric('approved_stored_materials', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    approvedGross: numeric('approved_gross', { precision: 15, scale: 2 }).notNull().default('0.00'),
    approvedRetainage: numeric('approved_retainage', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    approvedAmount: numeric('approved_amount', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'payment_application_lines_application_scope_fk',
      columns: [t.paymentApplicationId, t.organizationId, t.projectId],
      foreignColumns: [
        paymentApplications.id,
        paymentApplications.organizationId,
        paymentApplications.projectId,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'payment_application_lines_sov_line_scope_fk',
      columns: [t.scheduleOfValueLineId, t.organizationId, t.projectId],
      foreignColumns: [
        scheduleOfValueLines.id,
        scheduleOfValueLines.organizationId,
        scheduleOfValueLines.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('payment_application_lines_application_line_unique').on(
      t.paymentApplicationId,
      t.scheduleOfValueLineId,
    ),
    uniqueIndex('payment_application_lines_number_unique').on(t.paymentApplicationId, t.lineNumber),
    index('payment_application_lines_project_sov_line_idx').on(
      t.organizationId,
      t.projectId,
      t.scheduleOfValueLineId,
    ),
    uniqueIndex('payment_application_lines_id_scope_unique').on(
      t.id,
      t.organizationId,
      t.projectId,
    ),
    check('payment_application_lines_line_number_positive', sql`${t.lineNumber} > 0`),
    check(
      'payment_application_lines_amounts_nonnegative',
      sql`${t.currentWork} >= 0 AND ${t.storedMaterials} >= 0 AND ${t.grossCompleted} >= 0 AND ${t.retainageRequested} >= 0 AND ${t.priorApprovedGross} >= 0 AND ${t.requestedAmount} >= 0 AND ${t.approvedCurrentWork} >= 0 AND ${t.approvedStoredMaterials} >= 0 AND ${t.approvedGross} >= 0 AND ${t.approvedRetainage} >= 0 AND ${t.approvedAmount} >= 0`,
    ),
    check(
      'payment_application_lines_request_reconciles',
      sql`${t.currentWork} + ${t.storedMaterials} = ${t.grossCompleted} AND ${t.grossCompleted} - ${t.retainageRequested} = ${t.requestedAmount}`,
    ),
    check(
      'payment_application_lines_approval_reconciles',
      sql`${t.approvedCurrentWork} + ${t.approvedStoredMaterials} = ${t.approvedGross} AND ${t.approvedGross} - ${t.approvedRetainage} = ${t.approvedAmount}`,
    ),
    check(
      'payment_application_lines_retainage_percent_range',
      sql`${t.retainagePercent} BETWEEN 0 AND 100`,
    ),
  ],
);

export type PaymentApplication = typeof paymentApplications.$inferSelect;
export type PaymentApplicationLine = typeof paymentApplicationLines.$inferSelect;
export type NewPaymentApplication = typeof paymentApplications.$inferInsert;
export type NewPaymentApplicationLine = typeof paymentApplicationLines.$inferInsert;
