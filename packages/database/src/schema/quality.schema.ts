import { sql } from 'drizzle-orm';
import {
  date,
  check,
  index,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { organizations } from './org.schema';
import { projectMembers, projects } from './project.schema';

export const qualityInspectionStatusEnum = appSchema.enum('quality_inspection_status', [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
]);

export const qualityResultEnum = appSchema.enum('quality_result', [
  'PASS',
  'PASS_WITH_CONDITIONS',
  'FAIL',
]);

export const deficiencySeverityEnum = appSchema.enum('deficiency_severity', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
]);

export const deficiencyStatusEnum = appSchema.enum('deficiency_status', [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
  'DISPUTED',
  'CANCELLED',
]);

export const correctiveActionStatusEnum = appSchema.enum('corrective_action_status', [
  'OPEN',
  'IN_PROGRESS',
  'COMPLETED',
  'VERIFIED',
  'CANCELLED',
]);

export const qualityInspections = appSchema.table(
  'quality_inspections',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    inspectionNumber: text('inspection_number').notNull(),
    inspectionType: text('inspection_type').notNull(),
    scheduledDate: date('scheduled_date'),
    performedDate: date('performed_date'),
    inspectorMemberId: text('inspector_member_id')
      .references(() => projectMembers.id, { onDelete: 'set null' }),
    status: qualityInspectionStatusEnum('status').notNull().default('SCHEDULED'),
    result: qualityResultEnum('result'),
    findings: text('findings'),
    location: text('location'),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('quality_inspections_project_number_unique').on(t.projectId, t.inspectionNumber),
    index('quality_inspections_org_project_idx').on(t.organizationId, t.projectId),
    index('quality_inspections_project_status_date_idx').on(t.projectId, t.status, t.scheduledDate),
    index('quality_inspections_inspector_idx').on(t.inspectorMemberId),
    index('quality_inspections_created_by_idx').on(t.createdBy),
  ],
);

export const qualityDeficiencies = appSchema.table(
  'quality_deficiencies',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    inspectionId: text('inspection_id')
      .references(() => qualityInspections.id, { onDelete: 'set null' }),
    deficiencyNumber: text('deficiency_number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    severity: deficiencySeverityEnum('severity').notNull().default('MEDIUM'),
    status: deficiencyStatusEnum('status').notNull().default('OPEN'),
    responsibleMemberId: text('responsible_member_id')
      .references(() => projectMembers.id, { onDelete: 'set null' }),
    dueDate: date('due_date'),
    location: text('location'),
    notes: text('notes'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('quality_deficiencies_project_number_unique').on(t.projectId, t.deficiencyNumber),
    index('quality_deficiencies_org_project_idx').on(t.organizationId, t.projectId),
    index('quality_deficiencies_project_status_created_idx')
      .on(t.projectId, t.status, t.createdAt.desc(), t.id.desc()),
    index('quality_deficiencies_inspection_idx').on(t.inspectionId),
    index('quality_deficiencies_responsible_idx').on(t.responsibleMemberId),
    index('quality_deficiencies_created_by_idx').on(t.createdBy),
  ],
);

export const correctiveActions = appSchema.table(
  'corrective_actions',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    sourceType: text('source_type').notNull(),
    sourceId: text('source_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    status: correctiveActionStatusEnum('status').notNull().default('OPEN'),
    dueDate: date('due_date'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    verifiedBy: text('verified_by').references(() => users.id, { onDelete: 'set null' }),
    verifiedAt: timestamp('verified_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('corrective_actions_org_project_idx').on(t.organizationId, t.projectId),
    index('corrective_actions_project_status_created_idx')
      .on(t.projectId, t.status, t.createdAt.desc(), t.id.desc()),
    index('corrective_actions_source_idx').on(t.sourceType, t.sourceId),
    index('corrective_actions_assigned_to_idx').on(t.assignedTo),
    index('corrective_actions_created_by_idx').on(t.createdBy),
    index('corrective_actions_verified_by_idx').on(t.verifiedBy),
    check(
      'corrective_actions_verified_fields_check',
      sql`(${t.status} = 'VERIFIED' AND ${t.verifiedBy} IS NOT NULL AND ${t.verifiedAt} IS NOT NULL)
        OR ${t.status} <> 'VERIFIED'`,
    ),
  ],
);

export type QualityInspection = typeof qualityInspections.$inferSelect;
export type NewQualityInspection = typeof qualityInspections.$inferInsert;
export type QualityDeficiency = typeof qualityDeficiencies.$inferSelect;
export type NewQualityDeficiency = typeof qualityDeficiencies.$inferInsert;
export type CorrectiveAction = typeof correctiveActions.$inferSelect;
export type NewCorrectiveAction = typeof correctiveActions.$inferInsert;
