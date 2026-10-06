import {
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { organizations } from './org.schema';
import { projects } from './project.schema';

export const safetyEventTypeEnum = appSchema.enum('safety_event_type', [
  'INCIDENT',
  'NEAR_MISS',
  'UNSAFE_CONDITION',
  'UNSAFE_ACT',
  'FIRST_AID',
]);

export const safetyEventStatusEnum = appSchema.enum('safety_event_status', [
  'REPORTED',
  'UNDER_INVESTIGATION',
  'CORRECTIVE_ACTION_REQUIRED',
  'CORRECTIVE_ACTION_IN_PROGRESS',
  'CLOSED',
]);

export const safetySeverityEnum = appSchema.enum('safety_severity', [
  'LOW',
  'MEDIUM',
  'HIGH',
  'CRITICAL',
  'FATALITY',
]);

export const safetyEvents = appSchema.table(
  'safety_events',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    eventNumber: text('event_number').notNull(),
    eventType: safetyEventTypeEnum('event_type').notNull(),
    title: text('title').notNull(),
    description: text('description').notNull(),
    status: safetyEventStatusEnum('status').notNull().default('REPORTED'),
    severity: safetySeverityEnum('severity').notNull().default('LOW'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull(),
    location: text('location'),
    involvedParties: text('involved_parties'),
    reportedBy: text('reported_by').references(() => users.id, { onDelete: 'set null' }),
    assignedTo: text('assigned_to').references(() => users.id, { onDelete: 'set null' }),
    rootCause: text('root_cause'),
    immediateAction: text('immediate_action'),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('safety_events_project_number_unique').on(t.projectId, t.eventNumber),
    index('safety_events_org_project_idx').on(t.organizationId, t.projectId),
    index('safety_events_project_status_severity_idx').on(t.projectId, t.status, t.severity),
    index('safety_events_assigned_to_idx').on(t.assignedTo),
    index('safety_events_reported_by_idx').on(t.reportedBy),
    index('safety_events_created_by_idx').on(t.createdBy),
  ],
);

export const safetyMeetings = appSchema.table(
  'safety_meetings',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    meetingNumber: text('meeting_number').notNull(),
    meetingType: text('meeting_type').notNull(),
    title: text('title').notNull(),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }).notNull(),
    conductedAt: timestamp('conducted_at', { withTimezone: true }),
    facilitatorId: text('facilitator_id').references(() => users.id, { onDelete: 'set null' }),
    attendeeCount: integer('attendee_count'),
    topicsCovered: text('topics_covered'),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('safety_meetings_project_number_unique').on(t.projectId, t.meetingNumber),
    index('safety_meetings_org_project_idx').on(t.organizationId, t.projectId),
    index('safety_meetings_project_scheduled_idx').on(t.projectId, t.scheduledAt.desc()),
    index('safety_meetings_facilitator_idx').on(t.facilitatorId),
    index('safety_meetings_created_by_idx').on(t.createdBy),
  ],
);

export type SafetyEvent = typeof safetyEvents.$inferSelect;
export type NewSafetyEvent = typeof safetyEvents.$inferInsert;
export type SafetyMeeting = typeof safetyMeetings.$inferSelect;
export type NewSafetyMeeting = typeof safetyMeetings.$inferInsert;
