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
import { organizations } from './org.schema';
import { projectCostCodes, projectPhases, projects } from './project.schema';

export const projectBudgets = appSchema.table(
  'project_budgets',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull(),
    currencyCode: text('currency_code').notNull(),
    status: text('status').notNull().default('DRAFT'),
    currentRevisionNumber: integer('current_revision_number').notNull().default(1),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('project_budgets_project_unique').on(t.projectId),
    uniqueIndex('project_budgets_id_org_project_unique').on(t.id, t.organizationId, t.projectId),
    foreignKey({
      name: 'project_budgets_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    index('project_budgets_org_project_status_idx').on(t.organizationId, t.projectId, t.status),
    check(
      'project_budgets_status_check',
      sql`${t.status} IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED', 'CLOSED')`,
    ),
    check('project_budgets_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check('project_budgets_revision_positive', sql`${t.currentRevisionNumber} > 0`),
    check('project_budgets_version_positive', sql`${t.version} > 0`),
    check(
      'project_budgets_approval_metadata_check',
      sql`(${t.status} NOT IN ('APPROVED', 'SUPERSEDED', 'CLOSED')) OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check('project_budgets_closed_metadata_check', sql`${t.status} <> 'CLOSED' OR ${t.closedAt} IS NOT NULL`),
  ],
);

export const projectBudgetRevisions = appSchema.table(
  'project_budget_revisions',
  {
    id: text('id').primaryKey(),
    budgetId: text('budget_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    status: text('status').notNull().default('DRAFT'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'project_budget_revisions_budget_scope_fk',
      columns: [t.budgetId, t.organizationId, t.projectId],
      foreignColumns: [projectBudgets.id, projectBudgets.organizationId, projectBudgets.projectId],
    }).onDelete('restrict'),
    uniqueIndex('project_budget_revisions_number_unique').on(t.budgetId, t.revisionNumber),
    uniqueIndex('project_budget_revisions_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    index('project_budget_revisions_project_status_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.revisionNumber,
    ),
    check(
      'project_budget_revisions_status_check',
      sql`${t.status} IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED', 'CLOSED')`,
    ),
    check('project_budget_revisions_number_positive', sql`${t.revisionNumber} > 0`),
    check(
      'project_budget_revisions_approval_metadata_check',
      sql`${t.status} NOT IN ('APPROVED', 'SUPERSEDED', 'CLOSED') OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
  ],
);

export const projectBudgetLines = appSchema.table(
  'project_budget_lines',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    costCodeId: text('cost_code_id')
      .notNull()
      .references(() => projectCostCodes.id, { onDelete: 'restrict' }),
    phaseId: text('phase_id').references(() => projectPhases.id, { onDelete: 'restrict' }),
    lineNumber: integer('line_number').notNull(),
    description: text('description'),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'project_budget_lines_revision_scope_fk',
      columns: [t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [
        projectBudgetRevisions.id,
        projectBudgetRevisions.organizationId,
        projectBudgetRevisions.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('project_budget_lines_revision_line_unique').on(t.revisionId, t.lineNumber),
    index('project_budget_lines_org_project_cost_code_idx').on(
      t.organizationId,
      t.projectId,
      t.costCodeId,
    ),
    index('project_budget_lines_org_project_phase_idx').on(t.organizationId, t.projectId, t.phaseId),
    check('project_budget_lines_line_number_positive', sql`${t.lineNumber} > 0`),
    check('project_budget_lines_amount_nonnegative', sql`${t.amount} >= 0`),
  ],
);

export type ProjectBudget = typeof projectBudgets.$inferSelect;
export type NewProjectBudget = typeof projectBudgets.$inferInsert;
export type ProjectBudgetRevision = typeof projectBudgetRevisions.$inferSelect;
export type NewProjectBudgetRevision = typeof projectBudgetRevisions.$inferInsert;
export type ProjectBudgetLine = typeof projectBudgetLines.$inferSelect;
export type NewProjectBudgetLine = typeof projectBudgetLines.$inferInsert;
