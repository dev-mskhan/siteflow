// packages/database/src/schema/project.schema.ts
import {
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  jsonb,
  uniqueIndex,
  index,
  check,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { appSchema } from './auth.schema';
import { users } from './auth.schema';
import { organizations } from './org.schema';
import { dateFormatEnum, timeFormatEnum, unitSystemEnum } from './org.schema';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const projectStatusEnum = appSchema.enum('project_status', [
  'DRAFT',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
  'ARCHIVED',
]);

export const projectTypeEnum = appSchema.enum('project_type', [
  'COMMERCIAL',
  'RESIDENTIAL',
  'INDUSTRIAL',
  'INFRASTRUCTURE',
  'OTHER',
]);

export const projectRoleEnum = appSchema.enum('project_role', [
  'PROJECT_MANAGER',
  'SITE_SUPERVISOR',
  'PROJECT_MEMBER',
  'FINANCE',
  'PROCUREMENT',
  'SUBCONTRACTOR',
  'CLIENT',
]);

export const projectMemberStatusEnum = appSchema.enum('project_member_status', [
  'ACTIVE',
  'REMOVED',
]);

export const projectPhaseStatusEnum = appSchema.enum('project_phase_status', [
  'ACTIVE',
  'ARCHIVED',
]);

export const taskTypeEnum = appSchema.enum('task_type', ['TASK', 'MILESTONE', 'SUMMARY']);
export const taskStatusEnum = appSchema.enum('task_status', [
  'NOT_STARTED',
  'READY',
  'IN_PROGRESS',
  'BLOCKED',
  'COMPLETED',
  'CANCELLED',
]);
export const taskPriorityEnum = appSchema.enum('task_priority', [
  'LOW',
  'NORMAL',
  'HIGH',
  'CRITICAL',
]);
export const constraintTypeEnum = appSchema.enum('constraint_type', [
  'ASAP',
  'START_NO_EARLIER_THAN',
  'FINISH_NO_LATER_THAN',
]);
export const baselineStatusEnum = appSchema.enum('baseline_status', [
  'DRAFT',
  'ACTIVE',
  'SUPERSEDED',
]);
export const fieldLogStatusEnum = appSchema.enum('field_log_status', [
  'DRAFT',
  'SUBMITTED',
  'LOCKED',
]);
export const issueStatusEnum = appSchema.enum('issue_status', [
  'OPEN',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
]);
export const scheduleSourceTypeEnum = appSchema.enum('schedule_source_type', [
  'USER',
  'ISSUE',
  'RFI',
  'CHANGE_ORDER',
  'MATERIAL_DELAY',
  'WEATHER',
  'SYSTEM_CALCULATION',
]);

// ── Projects ──────────────────────────────────────────────────────────────────




export const projects = appSchema.table(
  'projects',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectNumber: text('project_number').notNull(),
    name: text('name').notNull(),
    description: text('description'),
    status: projectStatusEnum('status').notNull().default('DRAFT'),
    projectType: projectTypeEnum('project_type'),
    contractValue: numeric('contract_value', { precision: 15, scale: 2 }),
    currency: text('currency').notNull(),
    plannedStartDate: date('planned_start_date'),
    plannedEndDate: date('planned_end_date'),
    actualStartDate: date('actual_start_date'),
    actualEndDate: date('actual_end_date'),
    version: integer('version').notNull().default(1),
    scheduleRevision: integer('schedule_revision').notNull().default(1),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('projects_org_idx').on(t.organizationId),
    index('projects_org_status_idx').on(t.organizationId, t.status),
    index('projects_org_created_at_idx').on(t.organizationId, t.createdAt),
    uniqueIndex('projects_org_number_unique').on(t.organizationId, t.projectNumber),
    uniqueIndex('projects_id_org_unique').on(t.id, t.organizationId),
    check('projects_currency_length', sql`char_length(${t.currency}) = 3`),
  ],
);

// ── Project Settings ──────────────────────────────────────────────────────────

export const projectSettings = appSchema.table(
  'project_settings',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    timezone: text('timezone'),
    locale: text('locale'),
    dateFormat: dateFormatEnum('date_format'),
    timeFormat: timeFormatEnum('time_format'),
    unitSystem: unitSystemEnum('unit_system'),
    weekStartsOn: integer('week_starts_on'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    check(
      'project_settings_week_starts_on_range',
      sql`${t.weekStartsOn} IS NULL OR (${t.weekStartsOn} >= 0 AND ${t.weekStartsOn} <= 6)`,
    ),
  ],
);

// ── Project Members ───────────────────────────────────────────────────────────

export const projectMembers = appSchema.table(
  'project_members',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: projectRoleEnum('role').notNull(),
    status: projectMemberStatusEnum('status').notNull().default('ACTIVE'),
    addedBy: text('added_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('project_members_project_user_unique').on(t.projectId, t.userId),
    index('project_members_org_user_idx').on(t.organizationId, t.userId),
    index('project_members_project_status_idx').on(t.projectId, t.status),
  ],
);

// ── Project Phases ────────────────────────────────────────────────────────────

export const projectPhases = appSchema.table(
  'project_phases',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    name: text('name').notNull(),
    description: text('description'),
    status: projectPhaseStatusEnum('status').notNull().default('ACTIVE'),
    sortOrder: integer('sort_order').notNull().default(0),
    startsAt: date('starts_at'),
    endsAt: date('ends_at'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('project_phases_project_sort_idx').on(t.projectId, t.sortOrder),
    index('project_phases_org_project_idx').on(t.organizationId, t.projectId),
  ],
);

// ── Project Cost Codes ────────────────────────────────────────────────────────

export const projectCostCodes = appSchema.table(
  'project_cost_codes',
  {
    id: text('id').primaryKey(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    code: text('code').notNull(),
    description: text('description'),
    isActive: boolean('is_active').notNull().default(true),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('project_cost_codes_project_code_unique').on(t.projectId, t.code),
    index('project_cost_codes_org_project_idx').on(t.organizationId, t.projectId),
    index('project_cost_codes_project_active_idx').on(t.projectId, t.isActive),
  ],
);

// ── Tasks ─────────────────────────────────────────────────────────────────────

export const tasks = appSchema.table(
  'tasks',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    phaseId: text('phase_id').references(() => projectPhases.id, { onDelete: 'set null' }),
    parentTaskId: text('parent_task_id'),
    taskCode: text('task_code').notNull(),
    externalReference: text('external_reference'),
    name: text('name').notNull(),
    description: text('description'),
    taskType: taskTypeEnum('task_type').notNull().default('TASK'),
    status: taskStatusEnum('status').notNull().default('NOT_STARTED'),
    priority: taskPriorityEnum('priority').notNull().default('NORMAL'),
    constraintType: constraintTypeEnum('constraint_type').notNull().default('ASAP'),
    constraintDate: date('constraint_date'),
    assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    subcontractorId: text('subcontractor_id'),

    // Operational forecast dates
    currentStartDate: date('current_start_date'),
    currentFinishDate: date('current_finish_date'),
    currentDurationDays: integer('current_duration_days').notNull().default(1),

    // Historical field facts
    actualStartDate: date('actual_start_date'),
    actualFinishDate: date('actual_finish_date'),

    // Calculated schedule metrics
    floatDays: integer('float_days'),
    isCritical: boolean('is_critical').notNull().default(false),

    progressPercent: integer('progress_percent').notNull().default(0),
    position: integer('position').notNull().default(0),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('tasks_project_code_unique').on(t.projectId, t.taskCode),
    uniqueIndex('tasks_id_org_unique').on(t.id, t.organizationId),
    index('tasks_project_idx').on(t.projectId),
    index('tasks_org_project_idx').on(t.organizationId, t.projectId),
    index('tasks_project_parent_idx').on(t.projectId, t.parentTaskId),
    index('tasks_project_status_idx').on(t.projectId, t.status),
    index('tasks_project_type_idx').on(t.projectId, t.taskType),
    index('tasks_project_critical_idx').on(t.projectId, t.isCritical),
    check('tasks_progress_percent_range', sql`${t.progressPercent} >= 0 AND ${t.progressPercent} <= 100`),
  ],
);

// ── Task Document Links ───────────────────────────────────────────────────────

export const taskDocumentLinks = appSchema.table(
  'task_document_links',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    documentId: text('document_id').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('task_doc_unique').on(t.taskId, t.documentId),
    index('task_doc_links_task_idx').on(t.taskId),
  ],
);

// ── Project Calendars ─────────────────────────────────────────────────────────

export type WorkDaysConfig = {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
};

export const projectCalendars = appSchema.table(
  'project_calendars',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull().default('Standard Construction Calendar'),
    timezone: text('timezone').notNull().default('UTC'),
    workDays: jsonb('work_days').$type<WorkDaysConfig>().notNull(),
    hoursPerDay: numeric('hours_per_day', { precision: 4, scale: 2 }).notNull().default('8.00'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('project_calendars_org_idx').on(t.organizationId),
  ],
);

export const calendarExceptions = appSchema.table(
  'calendar_exceptions',
  {
    id: text('id').primaryKey(),
    calendarId: text('calendar_id')
      .notNull()
      .references(() => projectCalendars.id, { onDelete: 'cascade' }),
    exceptionDate: date('exception_date').notNull(),
    isWorkingDay: boolean('is_working_day').notNull(),
    name: text('name').notNull(),
  },
  (t) => [
    uniqueIndex('cal_exc_date_unique').on(t.calendarId, t.exceptionDate),
    index('cal_exc_calendar_idx').on(t.calendarId),
  ],
);

// ── Task Dependencies ─────────────────────────────────────────────────────────

export const dependencyTypeEnum = appSchema.enum('dependency_type', ['FS', 'SS', 'FF', 'SF']);

export const taskDependencies = appSchema.table(
  'task_dependencies',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    predecessorId: text('predecessor_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    dependencyType: dependencyTypeEnum('dependency_type').notNull().default('FS'),
    lagDays: integer('lag_days').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('task_dependencies_unique').on(t.taskId, t.predecessorId),
    index('task_dependencies_project_idx').on(t.projectId),
    index('task_dependencies_predecessor_idx').on(t.predecessorId),
    check('task_dep_no_self_ref', sql`${t.taskId} != ${t.predecessorId}`),
  ],
);

// ── Schedule Baselines (Immutable Snapshots) ─────────────────────────────────

export const scheduleBaselines = appSchema.table(
  'schedule_baselines',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    status: baselineStatusEnum('status').notNull().default('DRAFT'),
    activatedAt: timestamp('activated_at', { withTimezone: true }),
    activatedBy: text('activated_by').references(() => users.id, { onDelete: 'set null' }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('schedule_baselines_project_idx').on(t.projectId),
    index('schedule_baselines_org_project_idx').on(t.organizationId, t.projectId),
    index('schedule_baselines_status_idx').on(t.projectId, t.status),
  ],
);

export const scheduleBaselineTasks = appSchema.table(
  'schedule_baseline_tasks',
  {
    id: text('id').primaryKey(),
    baselineId: text('baseline_id')
      .notNull()
      .references(() => scheduleBaselines.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    baselineStartDate: date('baseline_start_date').notNull(),
    baselineFinishDate: date('baseline_finish_date').notNull(),
    baselineDurationDays: integer('baseline_duration_days').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('baseline_task_unique').on(t.baselineId, t.taskId),
    index('schedule_baseline_tasks_baseline_idx').on(t.baselineId),
  ],
);

// ── Daily Field Logs (Field Reality Recording) ───────────────────────────────

export const dailyFieldLogs = appSchema.table(
  'daily_field_logs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    logDate: date('log_date').notNull(),
    supervisorId: text('supervisor_id')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    status: fieldLogStatusEnum('status').notNull().default('DRAFT'),
    notes: text('notes'),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    lockedBy: text('locked_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('daily_field_logs_date_unique').on(t.projectId, t.logDate),
    index('daily_field_logs_project_idx').on(t.projectId),
    index('daily_field_logs_org_project_idx').on(t.organizationId, t.projectId),
    index('daily_field_logs_supervisor_idx').on(t.supervisorId),
  ],
);

export const fieldLogTaskEntries = appSchema.table(
  'field_log_task_entries',
  {
    id: text('id').primaryKey(),
    logId: text('log_id')
      .notNull()
      .references(() => dailyFieldLogs.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    completionPctRecorded: integer('completion_pct_recorded').notNull(),
    quantityCompleted: numeric('quantity_completed', { precision: 10, scale: 2 }),
    unit: text('unit'),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('field_log_task_entries_unique').on(t.logId, t.taskId),
    index('field_log_task_entries_log_idx').on(t.logId),
    index('field_log_task_entries_task_idx').on(t.taskId),
  ],
);

// ── Issues (Exceptions & Business Impact Reporting - Chunk 3.7) ───────────────

export const issues = appSchema.table(
  'issues',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    description: text('description'),
    status: issueStatusEnum('status').notNull().default('OPEN'),
    reportedImpactDays: integer('reported_impact_days').notNull().default(0),
    approvedImpactDays: integer('approved_impact_days').notNull().default(0),
    assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('issues_project_idx').on(t.projectId),
    index('issues_org_project_idx').on(t.organizationId, t.projectId),
    index('issues_status_idx').on(t.projectId, t.status),
  ],
);

// ── Schedule Changes (Audit Trail & Change History - Chunk 3.8) ─────────────

export const scheduleChanges = appSchema.table(
  'schedule_changes',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    sourceType: scheduleSourceTypeEnum('source_type').notNull(),
    sourceId: text('source_id'),
    oldStartDate: date('old_start_date'),
    oldFinishDate: date('old_finish_date'),
    newStartDate: date('new_start_date'),
    newFinishDate: date('new_finish_date'),
    reason: text('reason'),
    actorUserId: text('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('schedule_changes_project_idx').on(t.projectId),
    index('schedule_changes_task_idx').on(t.taskId),
    index('schedule_changes_source_idx').on(t.sourceType, t.sourceId),
  ],
);

// ── Project Schedule Metrics (Read Models & Summary - Chunk 3.9) ────────────

export const projectScheduleMetrics = appSchema.table(
  'project_schedule_metrics',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id')
      .notNull()
      .unique()
      .references(() => projects.id, { onDelete: 'cascade' }),
    totalTasks: integer('total_tasks').notNull().default(0),
    completedTasks: integer('completed_tasks').notNull().default(0),
    criticalTaskCount: integer('critical_task_count').notNull().default(0),
    scheduleRevision: integer('schedule_revision').notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('project_schedule_metrics_org_idx').on(t.organizationId),
  ],
);

// ── TypeScript Types ──────────────────────────────────────────────────────────

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;

export type ProjectSettings = typeof projectSettings.$inferSelect;
export type NewProjectSettings = typeof projectSettings.$inferInsert;

export type ProjectMember = typeof projectMembers.$inferSelect;
export type NewProjectMember = typeof projectMembers.$inferInsert;

export type ProjectPhase = typeof projectPhases.$inferSelect;
export type NewProjectPhase = typeof projectPhases.$inferInsert;

export type ProjectCostCode = typeof projectCostCodes.$inferSelect;
export type NewProjectCostCode = typeof projectCostCodes.$inferInsert;

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;

export type TaskDocumentLink = typeof taskDocumentLinks.$inferSelect;
export type NewTaskDocumentLink = typeof taskDocumentLinks.$inferInsert;

export type ProjectCalendar = typeof projectCalendars.$inferSelect;
export type NewProjectCalendar = typeof projectCalendars.$inferInsert;

export type CalendarException = typeof calendarExceptions.$inferSelect;
export type NewCalendarException = typeof calendarExceptions.$inferInsert;

export type TaskDependency = typeof taskDependencies.$inferSelect;
export type NewTaskDependency = typeof taskDependencies.$inferInsert;

export type ScheduleBaseline = typeof scheduleBaselines.$inferSelect;
export type NewScheduleBaseline = typeof scheduleBaselines.$inferInsert;

export type ScheduleBaselineTask = typeof scheduleBaselineTasks.$inferSelect;
export type NewScheduleBaselineTask = typeof scheduleBaselineTasks.$inferInsert;

export type DailyFieldLog = typeof dailyFieldLogs.$inferSelect;
export type NewDailyFieldLog = typeof dailyFieldLogs.$inferInsert;

export type FieldLogTaskEntry = typeof fieldLogTaskEntries.$inferSelect;
export type NewFieldLogTaskEntry = typeof fieldLogTaskEntries.$inferInsert;

export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;

export type ScheduleChange = typeof scheduleChanges.$inferSelect;
export type NewScheduleChange = typeof scheduleChanges.$inferInsert;

export type ProjectScheduleMetrics = typeof projectScheduleMetrics.$inferSelect;
export type NewProjectScheduleMetrics = typeof projectScheduleMetrics.$inferInsert;

// ── Enum value types ──────────────────────────────────────────────────────────

export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type ProjectType = 'COMMERCIAL' | 'RESIDENTIAL' | 'INDUSTRIAL' | 'INFRASTRUCTURE' | 'OTHER';
export type ProjectRole = 'PROJECT_MANAGER' | 'SITE_SUPERVISOR' | 'PROJECT_MEMBER' | 'FINANCE' | 'PROCUREMENT' | 'SUBCONTRACTOR' | 'CLIENT';
export type ProjectMemberStatus = 'ACTIVE' | 'REMOVED';
export type ProjectPhaseStatus = 'ACTIVE' | 'ARCHIVED';

export type TaskType = 'TASK' | 'MILESTONE' | 'SUMMARY';
export type TaskStatus = 'NOT_STARTED' | 'READY' | 'IN_PROGRESS' | 'BLOCKED' | 'COMPLETED' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL';
export type ConstraintType = 'ASAP' | 'START_NO_EARLIER_THAN' | 'FINISH_NO_LATER_THAN';
export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';
export type BaselineStatus = 'DRAFT' | 'ACTIVE' | 'SUPERSEDED';
export type FieldLogStatus = 'DRAFT' | 'SUBMITTED' | 'LOCKED';
export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
export type ScheduleSourceType = 'USER' | 'ISSUE' | 'RFI' | 'CHANGE_ORDER' | 'MATERIAL_DELAY' | 'WEATHER' | 'SYSTEM_CALCULATION';





