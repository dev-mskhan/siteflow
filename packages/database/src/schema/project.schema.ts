// packages/database/src/schema/project.schema.ts
import {
  text,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
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

// ── Enum value types ──────────────────────────────────────────────────────────

export type ProjectStatus = 'DRAFT' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type ProjectType = 'COMMERCIAL' | 'RESIDENTIAL' | 'INDUSTRIAL' | 'INFRASTRUCTURE' | 'OTHER';
export type ProjectRole = 'PROJECT_MANAGER' | 'SITE_SUPERVISOR' | 'PROJECT_MEMBER' | 'FINANCE' | 'PROCUREMENT' | 'SUBCONTRACTOR' | 'CLIENT';
export type ProjectMemberStatus = 'ACTIVE' | 'REMOVED';
export type ProjectPhaseStatus = 'ACTIVE' | 'ARCHIVED';
