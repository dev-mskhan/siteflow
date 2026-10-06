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

export const scheduleOfValues = appSchema.table(
  'schedule_of_values',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id').notNull(),
    currentRevisionNumber: integer('current_revision_number').notNull().default(1),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by').notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    uniqueIndex('schedule_of_values_project_unique').on(t.projectId),
    uniqueIndex('schedule_of_values_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    foreignKey({
      name: 'schedule_of_values_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    index('schedule_of_values_org_project_idx').on(t.organizationId, t.projectId, t.updatedAt.desc()),
    check('schedule_of_values_revision_positive', sql`${t.currentRevisionNumber} > 0`),
    check('schedule_of_values_version_positive', sql`${t.version} > 0`),
  ],
);

export const scheduleOfValueRevisions = appSchema.table(
  'schedule_of_value_revisions',
  {
    id: text('id').primaryKey(),
    scheduleOfValuesId: text('schedule_of_values_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    contractValue: numeric('contract_value', { precision: 15, scale: 2 }).notNull(),
    currencyCode: text('currency_code').notNull(),
    status: text('status').notNull().default('DRAFT'),
    createdBy: text('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'schedule_of_value_revisions_parent_scope_fk',
      columns: [t.scheduleOfValuesId, t.organizationId, t.projectId],
      foreignColumns: [scheduleOfValues.id, scheduleOfValues.organizationId, scheduleOfValues.projectId],
    }).onDelete('restrict'),
    uniqueIndex('schedule_of_value_revisions_number_unique')
      .on(t.scheduleOfValuesId, t.revisionNumber),
    uniqueIndex('schedule_of_value_revisions_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    index('schedule_of_value_revisions_status_idx')
      .on(t.organizationId, t.projectId, t.status, t.revisionNumber),
    check(
      'schedule_of_value_revisions_status_check',
      sql`${t.status} IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED')`,
    ),
    check('schedule_of_value_revisions_value_positive', sql`${t.contractValue} > 0`),
    check('schedule_of_value_revisions_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check('schedule_of_value_revisions_number_positive', sql`${t.revisionNumber} > 0`),
    check(
      'schedule_of_value_revisions_submission_metadata_check',
      sql`${t.status} NOT IN ('PENDING_APPROVAL', 'APPROVED', 'SUPERSEDED') OR (${t.submittedBy} IS NOT NULL AND ${t.submittedAt} IS NOT NULL)`,
    ),
    check(
      'schedule_of_value_revisions_approval_metadata_check',
      sql`${t.status} NOT IN ('APPROVED', 'SUPERSEDED') OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
  ],
);

export const scheduleOfValueLines = appSchema.table(
  'schedule_of_value_lines',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    lineNumber: integer('line_number').notNull(),
    description: text('description').notNull(),
    costCodeId: text('cost_code_id').notNull()
      .references(() => projectCostCodes.id, { onDelete: 'restrict' }),
    phaseId: text('phase_id').references(() => projectPhases.id, { onDelete: 'restrict' }),
    boqLineId: text('boq_line_id'),
    scheduledValue: numeric('scheduled_value', { precision: 15, scale: 2 }).notNull(),
    completedToDate: numeric('completed_to_date', { precision: 15, scale: 2 }).notNull().default('0.00'),
    storedMaterials: numeric('stored_materials', { precision: 15, scale: 2 }).notNull().default('0.00'),
    retainagePercent: numeric('retainage_percent', { precision: 5, scale: 2 }).notNull().default('0.00'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'schedule_of_value_lines_revision_scope_fk',
      columns: [t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [
        scheduleOfValueRevisions.id,
        scheduleOfValueRevisions.organizationId,
        scheduleOfValueRevisions.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('schedule_of_value_lines_number_unique').on(t.revisionId, t.lineNumber),
    index('schedule_of_value_lines_project_code_idx')
      .on(t.organizationId, t.projectId, t.costCodeId),
    index('schedule_of_value_lines_project_phase_idx')
      .on(t.organizationId, t.projectId, t.phaseId),
    check('schedule_of_value_lines_number_positive', sql`${t.lineNumber} > 0`),
    check('schedule_of_value_lines_description_length', sql`char_length(${t.description}) BETWEEN 1 AND 1000`),
    check('schedule_of_value_lines_value_nonnegative', sql`${t.scheduledValue} > 0`),
    check(
      'schedule_of_value_lines_progress_nonnegative',
      sql`${t.completedToDate} >= 0 AND ${t.storedMaterials} >= 0 AND ${t.completedToDate} + ${t.storedMaterials} <= ${t.scheduledValue}`,
    ),
    check('schedule_of_value_lines_retainage_range', sql`${t.retainagePercent} BETWEEN 0 AND 100`),
  ],
);

export type ScheduleOfValues = typeof scheduleOfValues.$inferSelect;
export type ScheduleOfValueRevision = typeof scheduleOfValueRevisions.$inferSelect;
export type ScheduleOfValueLine = typeof scheduleOfValueLines.$inferSelect;
export type NewScheduleOfValueLine = typeof scheduleOfValueLines.$inferInsert;
