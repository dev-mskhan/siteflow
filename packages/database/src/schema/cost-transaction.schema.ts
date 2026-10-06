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
import { documents } from './documents.schema';
import { organizations } from './org.schema';
import { projectCostCodes, projectPhases, projects, tasks } from './project.schema';

export const costTransactions = appSchema.table(
  'cost_transactions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull(),
    costCodeId: text('cost_code_id')
      .notNull()
      .references(() => projectCostCodes.id, { onDelete: 'restrict' }),
    phaseId: text('phase_id').references(() => projectPhases.id, { onDelete: 'restrict' }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'restrict' }),
    documentId: text('document_id').references(() => documents.id, { onDelete: 'restrict' }),
    sourceType: text('source_type').notNull().default('MANUAL'),
    sourceId: text('source_id'),
    transactionDate: date('transaction_date').notNull(),
    postingDate: date('posting_date'),
    description: text('description').notNull(),
    quantity: numeric('quantity', { precision: 15, scale: 3 }),
    unit: text('unit'),
    unitCost: numeric('unit_cost', { precision: 15, scale: 2 }),
    subtotal: numeric('subtotal', { precision: 15, scale: 2 }).notNull(),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0.00'),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull(),
    currencyCode: text('currency_code').notNull(),
    status: text('status').notNull().default('DRAFT'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    postedBy: text('posted_by').references(() => users.id, { onDelete: 'restrict' }),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    voidedBy: text('voided_by').references(() => users.id, { onDelete: 'restrict' }),
    voidedAt: timestamp('voided_at', { withTimezone: true }),
    version: integer('version').notNull().default(1),
    reversalOfId: text('reversal_of_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'cost_transactions_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'cost_transactions_reversal_scope_fk',
      columns: [t.reversalOfId],
      foreignColumns: [t.id],
    }).onDelete('restrict'),
    uniqueIndex('cost_transactions_source_unique')
      .on(t.organizationId, t.projectId, t.sourceType, t.sourceId)
      .where(sql`${t.sourceId} IS NOT NULL`),
    uniqueIndex('cost_transactions_reversal_unique')
      .on(t.reversalOfId)
      .where(sql`${t.reversalOfId} IS NOT NULL`),
    index('cost_transactions_org_project_created_idx').on(
      t.organizationId,
      t.projectId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    index('cost_transactions_org_project_cost_code_idx').on(
      t.organizationId,
      t.projectId,
      t.costCodeId,
      t.createdAt.desc(),
    ),
    index('cost_transactions_org_project_status_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.createdAt.desc(),
    ),
    index('cost_transactions_phase_idx').on(t.organizationId, t.projectId, t.phaseId),
    index('cost_transactions_task_idx').on(t.organizationId, t.projectId, t.taskId),
    index('cost_transactions_document_idx').on(t.organizationId, t.projectId, t.documentId),
    check(
      'cost_transactions_source_type_check',
      sql`${t.sourceType} IN ('MANUAL', 'DOCUMENT', 'TASK', 'PHASE', 'VOID_REVERSAL')`,
    ),
    check(
      'cost_transactions_source_pair_check',
      sql`(${t.sourceType} = 'MANUAL' AND (${t.sourceId} IS NULL OR char_length(${t.sourceId}) > 0)) OR (${t.sourceType} IN ('DOCUMENT', 'TASK', 'PHASE') AND ${t.sourceId} IS NOT NULL) OR (${t.sourceType} = 'VOID_REVERSAL' AND ${t.sourceId} IS NULL)`,
    ),
    check('cost_transactions_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check(
      'cost_transactions_status_check',
      sql`${t.status} IN ('DRAFT', 'POSTED', 'VOIDED')`,
    ),
    check('cost_transactions_description_length', sql`char_length(${t.description}) BETWEEN 1 AND 1000`),
    check(
      'cost_transactions_quantity_unit_check',
      sql`(${t.quantity} IS NULL AND ${t.unit} IS NULL AND ${t.unitCost} IS NULL) OR (${t.quantity} > 0 AND ${t.unit} IS NOT NULL AND char_length(${t.unit}) BETWEEN 1 AND 64 AND ${t.unitCost} >= 0)`,
    ),
    check(
      'cost_transactions_amounts_check',
      sql`(${t.sourceType} = 'VOID_REVERSAL' AND ${t.subtotal} <= 0 AND ${t.taxAmount} <= 0 AND ${t.totalAmount} <= 0) OR (${t.sourceType} <> 'VOID_REVERSAL' AND ${t.subtotal} >= 0 AND ${t.taxAmount} >= 0 AND ${t.totalAmount} >= 0)`,
    ),
    check(
      'cost_transactions_total_check',
      sql`${t.totalAmount} = ${t.subtotal} + ${t.taxAmount}`,
    ),
    check('cost_transactions_version_positive', sql`${t.version} > 0`),
    check(
      'cost_transactions_post_metadata_check',
      sql`${t.status} NOT IN ('POSTED', 'VOIDED') OR (${t.postedBy} IS NOT NULL AND ${t.postedAt} IS NOT NULL AND ${t.postingDate} IS NOT NULL)`,
    ),
    check(
      'cost_transactions_void_metadata_check',
      sql`${t.status} <> 'VOIDED' OR (${t.voidedBy} IS NOT NULL AND ${t.voidedAt} IS NOT NULL)`,
    ),
    check(
      'cost_transactions_reversal_check',
      sql`(${t.sourceType} = 'VOID_REVERSAL' AND ${t.reversalOfId} IS NOT NULL AND ${t.status} = 'POSTED') OR (${t.sourceType} <> 'VOID_REVERSAL' AND ${t.reversalOfId} IS NULL)`,
    ),
  ],
);

export type CostTransaction = typeof costTransactions.$inferSelect;
export type NewCostTransaction = typeof costTransactions.$inferInsert;
