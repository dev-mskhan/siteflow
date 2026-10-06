import { sql } from 'drizzle-orm';
import { date, index, integer, numeric, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { organizations } from './org.schema';
import { projects, tasks } from './project.schema';

export const rfiStatusEnum = appSchema.enum('rfi_status', [
  'DRAFT',
  'OPEN',
  'UNDER_REVIEW',
  'ANSWERED',
  'CLOSED',
  'CANCELLED',
]);

export const rfiPriorityEnum = appSchema.enum('rfi_priority', [
  'LOW',
  'NORMAL',
  'HIGH',
  'URGENT',
]);

export const rfis = appSchema.table(
  'rfis',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    rfiNumber: text('rfi_number').notNull(),
    title: text('title').notNull(),
    question: text('question').notNull(),
    discipline: text('discipline'),
    status: rfiStatusEnum('status').notNull().default('DRAFT'),
    priority: rfiPriorityEnum('priority').notNull().default('NORMAL'),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'set null' }),
    recipientName: text('recipient_name'),
    dueDate: date('due_date'),
    response: text('response'),
    respondedBy: text('responded_by').references(() => users.id, { onDelete: 'set null' }),
    respondedAt: timestamp('responded_at', { withTimezone: true }),
    scheduleImpactDays: integer('schedule_impact_days').notNull().default(0),
    costImpact: numeric('cost_impact', { precision: 15, scale: 2 }),
    linkedTaskId: text('linked_task_id').references(() => tasks.id, { onDelete: 'set null' }),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('rfis_project_number_unique').on(t.projectId, t.rfiNumber),
    index('rfis_org_project_idx').on(t.organizationId, t.projectId),
    index('rfis_project_status_created_idx').on(t.projectId, t.status, t.createdAt.desc(), t.id.desc()),
    index('rfis_project_priority_created_idx').on(t.projectId, t.priority, t.createdAt.desc(), t.id.desc()),
    index('rfis_task_idx').on(t.linkedTaskId).where(sql`${t.linkedTaskId} IS NOT NULL`),
    index('rfis_created_by_idx').on(t.createdBy),
    index('rfis_submitted_by_idx').on(t.submittedBy),
    index('rfis_responded_by_idx').on(t.respondedBy),
  ],
);

export type Rfi = typeof rfis.$inferSelect;
export type NewRfi = typeof rfis.$inferInsert;
