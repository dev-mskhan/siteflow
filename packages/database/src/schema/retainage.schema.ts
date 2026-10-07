import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  numeric,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { paymentApplicationLines } from './payment-application.schema';
import { projects } from './project.schema';

export const retainageRecords = appSchema.table(
  'retainage_records',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    paymentApplicationLineId: text('payment_application_line_id').notNull(),
    currencyCode: text('currency_code').notNull(),
    retainagePercent: numeric('retainage_percent', { precision: 5, scale: 2 }).notNull(),
    accruedAmount: numeric('accrued_amount', { precision: 15, scale: 2 }).notNull(),
    releasedAmount: numeric('released_amount', { precision: 15, scale: 2 })
      .notNull()
      .default('0.00'),
    remainingAmount: numeric('remaining_amount', { precision: 15, scale: 2 }).notNull(),
    status: text('status').notNull().default('HELD'),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    foreignKey({
      name: 'retainage_records_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'retainage_records_application_line_scope_fk',
      columns: [t.paymentApplicationLineId, t.organizationId, t.projectId],
      foreignColumns: [
        paymentApplicationLines.id,
        paymentApplicationLines.organizationId,
        paymentApplicationLines.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('retainage_records_line_unique').on(t.paymentApplicationLineId),
    uniqueIndex('retainage_records_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    index('retainage_records_project_status_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    index('retainage_records_project_currency_idx').on(
      t.organizationId,
      t.projectId,
      t.currencyCode,
    ),
    check('retainage_records_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check('retainage_records_percent_check', sql`${t.retainagePercent} BETWEEN 0 AND 100`),
    check(
      'retainage_records_amounts_check',
      sql`${t.accruedAmount} > 0 AND ${t.releasedAmount} >= 0 AND ${t.remainingAmount} >= 0 AND ${t.accruedAmount} = ${t.releasedAmount} + ${t.remainingAmount}`,
    ),
    check(
      'retainage_records_status_check',
      sql`${t.status} IN ('HELD', 'PARTIALLY_RELEASED', 'RELEASED')`,
    ),
    check(
      'retainage_records_status_balance_check',
      sql`(${t.status} = 'HELD' AND ${t.releasedAmount} = 0) OR (${t.status} = 'PARTIALLY_RELEASED' AND ${t.releasedAmount} > 0 AND ${t.remainingAmount} > 0) OR (${t.status} = 'RELEASED' AND ${t.remainingAmount} = 0)`,
    ),
    check('retainage_records_version_check', sql`${t.version} > 0`),
  ],
);

export const retainageReleases = appSchema.table(
  'retainage_releases',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    retainageRecordId: text('retainage_record_id').notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    reason: text('reason').notNull(),
    releasedBy: text('released_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    idempotencyReference: text('idempotency_reference').notNull(),
    releasedAt: timestamp('released_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'retainage_releases_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'retainage_releases_record_scope_fk',
      columns: [t.retainageRecordId, t.organizationId, t.projectId],
      foreignColumns: [
        retainageRecords.id,
        retainageRecords.organizationId,
        retainageRecords.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('retainage_releases_idempotency_unique').on(
      t.organizationId,
      t.idempotencyReference,
    ),
    index('retainage_releases_record_created_idx').on(
      t.organizationId,
      t.projectId,
      t.retainageRecordId,
      t.releasedAt,
      t.id,
    ),
    check('retainage_releases_amount_positive', sql`${t.amount} > 0`),
    check('retainage_releases_reason_nonempty', sql`length(trim(${t.reason})) > 0`),
    check(
      'retainage_releases_idempotency_nonempty',
      sql`length(trim(${t.idempotencyReference})) > 0`,
    ),
  ],
);

export type RetainageRecord = typeof retainageRecords.$inferSelect;
export type RetainageRelease = typeof retainageReleases.$inferSelect;
