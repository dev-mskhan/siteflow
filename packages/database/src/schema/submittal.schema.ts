import { date, index, integer, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { organizations } from './org.schema';
import { projectMembers, projects } from './project.schema';

export const submittalStatusEnum = appSchema.enum('submittal_status', [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'REVISE_AND_RESUBMIT',
  'CLOSED',
]);

export const submittalRevisionStatusEnum = appSchema.enum('revision_status', [
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'REVISE_AND_RESUBMIT',
]);

export const submittalResponseEnum = appSchema.enum('submittal_response', [
  'APPROVED',
  'APPROVED_WITH_COMMENTS',
  'REVISE_AND_RESUBMIT',
  'REJECTED',
]);

export const submittals = appSchema.table(
  'submittals',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    submittalNumber: text('submittal_number').notNull(),
    title: text('title').notNull(),
    specReference: text('spec_reference'),
    discipline: text('discipline'),
    responsibleMemberId: text('responsible_member_id')
      .references(() => projectMembers.id, { onDelete: 'set null' }),
    reviewerMemberId: text('reviewer_member_id')
      .references(() => projectMembers.id, { onDelete: 'set null' }),
    status: submittalStatusEnum('status').notNull().default('DRAFT'),
    dueDate: date('due_date'),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('submittals_project_number_unique').on(t.projectId, t.submittalNumber),
    index('submittals_org_project_idx').on(t.organizationId, t.projectId),
    index('submittals_project_status_created_idx')
      .on(t.projectId, t.status, t.createdAt.desc(), t.id.desc()),
    index('submittals_responsible_member_idx').on(t.responsibleMemberId),
    index('submittals_reviewer_member_idx').on(t.reviewerMemberId),
    index('submittals_created_by_idx').on(t.createdBy),
  ],
);

export const submittalRevisions = appSchema.table(
  'submittal_revisions',
  {
    id: text('id').primaryKey(),
    submittalId: text('submittal_id')
      .notNull()
      .references(() => submittals.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    revisionNumber: integer('revision_number').notNull(),
    status: submittalRevisionStatusEnum('status').notNull().default('SUBMITTED'),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'set null' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).defaultNow().notNull(),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }),
    response: submittalResponseEnum('response'),
    responseNotes: text('response_notes'),
  },
  (t) => [
    uniqueIndex('submittal_revisions_number_unique').on(t.submittalId, t.revisionNumber),
    index('submittal_revisions_submittal_idx').on(t.submittalId),
    index('submittal_revisions_org_idx').on(t.organizationId),
    index('submittal_revisions_submitted_by_idx').on(t.submittedBy),
    index('submittal_revisions_reviewed_by_idx').on(t.reviewedBy),
  ],
);

export const submittalRevisionReviews = appSchema.table(
  'submittal_revision_reviews',
  {
    id: text('id').primaryKey(),
    submittalRevisionId: text('submittal_revision_id')
      .notNull()
      .references(() => submittalRevisions.id, { onDelete: 'cascade' }),
    submittalId: text('submittal_id')
      .notNull()
      .references(() => submittals.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    status: submittalRevisionStatusEnum('status').notNull(),
    reviewedBy: text('reviewed_by').references(() => users.id, { onDelete: 'set null' }),
    reviewedAt: timestamp('reviewed_at', { withTimezone: true }).defaultNow().notNull(),
    response: submittalResponseEnum('response').notNull(),
    responseNotes: text('response_notes'),
  },
  (t) => [
    uniqueIndex('submittal_revision_reviews_revision_unique').on(t.submittalRevisionId),
    index('submittal_revision_reviews_submittal_idx').on(t.submittalId, t.organizationId),
    index('submittal_revision_reviews_org_idx').on(t.organizationId),
    index('submittal_revision_reviews_reviewed_by_idx').on(t.reviewedBy),
  ],
);

export type Submittal = typeof submittals.$inferSelect;
export type NewSubmittal = typeof submittals.$inferInsert;
export type SubmittalRevision = typeof submittalRevisions.$inferSelect;
export type NewSubmittalRevision = typeof submittalRevisions.$inferInsert;
export type SubmittalRevisionReview = typeof submittalRevisionReviews.$inferSelect;
