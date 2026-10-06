import { sql } from 'drizzle-orm';
import {
  check,
  boolean,
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
import { projectBudgetRevisions } from './budget.schema';
import { projectCostCodes, projectPhases, projects, tasks } from './project.schema';

export const changeOrders = appSchema.table(
  'change_orders',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull(),
    changeOrderNumber: text('change_order_number').notNull(),
    title: text('title').notNull(),
    reason: text('reason').notNull(),
    requesterId: text('requester_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: text('status').notNull().default('DRAFT'),
    currencyCode: text('currency_code').notNull(),
    costDelta: numeric('cost_delta', { precision: 15, scale: 2 }).notNull().default('0.00'),
    revenueDelta: numeric('revenue_delta', { precision: 15, scale: 2 }).notNull().default('0.00'),
    scheduleDeltaDays: integer('schedule_delta_days').notNull().default(0),
    clientApprovalRequired: boolean('client_approval_required').notNull().default(false),
    version: integer('version').notNull().default(1),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    clientApprovedBy: text('client_approved_by').references(() => users.id, { onDelete: 'restrict' }),
    clientApprovedAt: timestamp('client_approved_at', { withTimezone: true }),
    rejectedBy: text('rejected_by').references(() => users.id, { onDelete: 'restrict' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    effectedBy: text('effected_by').references(() => users.id, { onDelete: 'restrict' }),
    effectedAt: timestamp('effected_at', { withTimezone: true }),
    effectedBudgetRevisionId: text('effected_budget_revision_id'),
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
      name: 'change_orders_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'change_orders_effected_budget_revision_scope_fk',
      columns: [t.effectedBudgetRevisionId, t.organizationId, t.projectId],
      foreignColumns: [
        projectBudgetRevisions.id,
        projectBudgetRevisions.organizationId,
        projectBudgetRevisions.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('change_orders_project_number_unique').on(t.projectId, t.changeOrderNumber),
    uniqueIndex('change_orders_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    uniqueIndex('change_orders_effected_revision_unique')
      .on(t.effectedBudgetRevisionId)
      .where(sql`${t.effectedBudgetRevisionId} IS NOT NULL`),
    index('change_orders_org_project_status_created_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.createdAt.desc(),
    ),
    check(
      'change_orders_status_check',
      sql`${t.status} IN ('DRAFT', 'SUBMITTED', 'APPROVED', 'PENDING_CLIENT_APPROVAL', 'CLIENT_APPROVED', 'REJECTED', 'EFFECTED', 'VOIDED')`,
    ),
    check('change_orders_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check('change_orders_version_positive', sql`${t.version} > 0`),
    check('change_orders_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 200`),
    check('change_orders_reason_length', sql`char_length(${t.reason}) BETWEEN 1 AND 2000`),
    check(
      'change_orders_approval_metadata_check',
      sql`${t.status} NOT IN ('APPROVED', 'PENDING_CLIENT_APPROVAL', 'CLIENT_APPROVED', 'EFFECTED') OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      'change_orders_client_approval_metadata_check',
      sql`${t.status} NOT IN ('CLIENT_APPROVED', 'EFFECTED') OR NOT ${t.clientApprovalRequired} OR (${t.clientApprovedBy} IS NOT NULL AND ${t.clientApprovedAt} IS NOT NULL)`,
    ),
    check(
      'change_orders_rejection_metadata_check',
      sql`${t.status} <> 'REJECTED' OR (${t.rejectedBy} IS NOT NULL AND ${t.rejectedAt} IS NOT NULL AND ${t.rejectionReason} IS NOT NULL)`,
    ),
    check(
      'change_orders_effect_metadata_check',
      sql`${t.status} <> 'EFFECTED' OR (${t.effectedBy} IS NOT NULL AND ${t.effectedAt} IS NOT NULL AND ${t.effectedBudgetRevisionId} IS NOT NULL)`,
    ),
    check(
      'change_orders_void_metadata_check',
      sql`${t.status} <> 'VOIDED' OR (${t.voidedBy} IS NOT NULL AND ${t.voidedAt} IS NOT NULL)`,
    ),
  ],
);

export const changeOrderLines = appSchema.table(
  'change_order_lines',
  {
    id: text('id').primaryKey(),
    changeOrderId: text('change_order_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    lineNumber: integer('line_number').notNull(),
    description: text('description').notNull(),
    costCodeId: text('cost_code_id')
      .notNull()
      .references(() => projectCostCodes.id, { onDelete: 'restrict' }),
    phaseId: text('phase_id').references(() => projectPhases.id, { onDelete: 'restrict' }),
    taskId: text('task_id').references(() => tasks.id, { onDelete: 'restrict' }),
    documentId: text('document_id').references(() => documents.id, { onDelete: 'restrict' }),
    boqLineId: text('boq_line_id'),
    costDelta: numeric('cost_delta', { precision: 15, scale: 2 }).notNull().default('0.00'),
    revenueDelta: numeric('revenue_delta', { precision: 15, scale: 2 }).notNull().default('0.00'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'change_order_lines_change_order_scope_fk',
      columns: [t.changeOrderId, t.organizationId, t.projectId],
      foreignColumns: [changeOrders.id, changeOrders.organizationId, changeOrders.projectId],
    }).onDelete('restrict'),
    uniqueIndex('change_order_lines_number_unique').on(t.changeOrderId, t.lineNumber),
    index('change_order_lines_org_project_code_idx').on(t.organizationId, t.projectId, t.costCodeId),
    index('change_order_lines_org_project_phase_idx').on(t.organizationId, t.projectId, t.phaseId),
    index('change_order_lines_org_project_task_idx').on(t.organizationId, t.projectId, t.taskId),
    index('change_order_lines_org_project_document_idx').on(t.organizationId, t.projectId, t.documentId),
    check('change_order_lines_number_positive', sql`${t.lineNumber} > 0`),
    check(
      'change_order_lines_description_length',
      sql`char_length(${t.description}) BETWEEN 1 AND 1000`,
    ),
  ],
);

export type ChangeOrder = typeof changeOrders.$inferSelect;
export type NewChangeOrder = typeof changeOrders.$inferInsert;
export type ChangeOrderLine = typeof changeOrderLines.$inferSelect;
export type NewChangeOrderLine = typeof changeOrderLines.$inferInsert;
