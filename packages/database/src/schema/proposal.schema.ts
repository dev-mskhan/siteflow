import { sql } from 'drizzle-orm';
import {
  check,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { projects } from './project.schema';

// ── Tender opportunities ──────────────────────────────────────────────────────
export const tenders = appSchema.table(
  'tenders',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    /** Optional project association when a project already exists for this tender */
    projectId: text('project_id'),
    tenderNumber: integer('tender_number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    clientName: text('client_name').notNull(),
    clientReference: text('client_reference'),
    issuerName: text('issuer_name'),
    status: text('status').notNull().default('OPEN'),
    submissionDeadline: timestamp('submission_deadline', { withTimezone: true }).notNull(),
    submissionTimezone: text('submission_timezone').notNull(),
    requirements: text('requirements'),
    requiredDocuments: jsonb('required_documents'),
    estimatedValue: numeric('estimated_value', { precision: 15, scale: 2 }),
    currencyCode: text('currency_code'),
    notes: text('notes'),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    awardedAt: timestamp('awarded_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('tenders_id_scope_unique').on(t.id, t.organizationId),
    uniqueIndex('tenders_number_unique').on(t.organizationId, t.tenderNumber),
    index('tenders_org_status_deadline_idx').on(t.organizationId, t.status, t.submissionDeadline.desc()),
    index('tenders_org_project_idx').on(t.organizationId, t.projectId),
    check('tenders_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 160`),
    check('tenders_description_length', sql`${t.description} IS NULL OR char_length(${t.description}) <= 5000`),
    check('tenders_client_name_length', sql`char_length(${t.clientName}) BETWEEN 1 AND 200`),
    check('tenders_number_positive', sql`${t.tenderNumber} > 0`),
    check('tenders_version_positive', sql`${t.version} > 0`),
    check('tenders_estimated_value_nonnegative', sql`${t.estimatedValue} IS NULL OR ${t.estimatedValue} >= 0`),
    check('tenders_currency_check', sql`${t.currencyCode} IS NULL OR ${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check('tenders_timezone_length', sql`char_length(${t.submissionTimezone}) BETWEEN 1 AND 100`),
    check(
      'tenders_status_check',
      sql`${t.status} IN ('OPEN', 'SUBMITTED', 'AWARDED', 'LOST', 'WITHDRAWN', 'EXPIRED')`,
    ),
    check(
      'tenders_submitted_metadata_check',
      sql`${t.status} NOT IN ('SUBMITTED','AWARDED','LOST') OR ${t.submittedAt} IS NOT NULL`,
    ),
    check(
      'tenders_awarded_metadata_check',
      sql`${t.status} <> 'AWARDED' OR ${t.awardedAt} IS NOT NULL`,
    ),
  ],
);

// ── Proposals (the commercial document issued to a client) ────────────────────
export const proposals = appSchema.table(
  'proposals',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    tenderId: text('tender_id'),
    proposalNumber: text('proposal_number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: text('status').notNull().default('DRAFT'),
    currentRevisionNumber: integer('current_revision_number').notNull().default(1),
    version: integer('version').notNull().default(1),
    clientName: text('client_name'),
    clientReference: text('client_reference'),
    /** Source estimate reference pinned at creation/update */
    sourceEstimateId: text('source_estimate_id'),
    sourceEstimateRevisionId: text('source_estimate_revision_id'),
    sourceBoqId: text('source_boq_id'),
    sourceBoqRevisionId: text('source_boq_revision_id'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    rejectedBy: text('rejected_by').references(() => users.id, { onDelete: 'restrict' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    issuedBy: text('issued_by').references(() => users.id, { onDelete: 'restrict' }),
    acceptedAt: timestamp('accepted_at', { withTimezone: true }),
    acceptedBy: text('accepted_by').references(() => users.id, { onDelete: 'restrict' }),
    clientResponseEvent: text('client_response_event'),
    clientResponseAt: timestamp('client_response_at', { withTimezone: true }),
    clientSignatoryName: text('client_signatory_name'),
    clientResponseReference: text('client_response_reference'),
    withdrawnAt: timestamp('withdrawn_at', { withTimezone: true }),
    withdrawnBy: text('withdrawn_by').references(() => users.id, { onDelete: 'restrict' }),
    withdrawalReason: text('withdrawal_reason'),
    expiredAt: timestamp('expired_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('proposals_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    uniqueIndex('proposals_number_unique').on(t.organizationId, t.projectId, t.proposalNumber),
    foreignKey({
      name: 'proposals_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    index('proposals_org_project_status_updated_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.updatedAt.desc(),
    ),
    index('proposals_org_tender_idx').on(t.organizationId, t.tenderId),
    index('proposals_org_project_created_idx').on(
      t.organizationId,
      t.projectId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    check('proposals_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 160`),
    check('proposals_description_length', sql`${t.description} IS NULL OR char_length(${t.description}) <= 5000`),
    check('proposals_number_length', sql`char_length(${t.proposalNumber}) BETWEEN 1 AND 64`),
    check('proposals_revision_positive', sql`${t.currentRevisionNumber} > 0`),
    check('proposals_version_positive', sql`${t.version} > 0`),
    check(
      'proposals_status_check',
      sql`${t.status} IN ('DRAFT','PENDING_APPROVAL','APPROVED','ISSUED','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED')`,
    ),
    check(
      'proposals_approval_metadata_check',
      sql`${t.status} NOT IN ('APPROVED','ISSUED','ACCEPTED') OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      'proposals_issued_metadata_check',
      sql`${t.status} NOT IN ('ISSUED','ACCEPTED','REJECTED','WITHDRAWN','EXPIRED') OR (${t.issuedBy} IS NOT NULL AND ${t.issuedAt} IS NOT NULL)`,
    ),
    check(
      'proposals_rejection_metadata_check',
      sql`${t.status} <> 'REJECTED' OR (${t.rejectedBy} IS NOT NULL AND ${t.rejectedAt} IS NOT NULL AND char_length(${t.rejectionReason}) >= 10)`,
    ),
    check(
      'proposals_accepted_metadata_check',
      sql`${t.status} <> 'ACCEPTED' OR (${t.acceptedBy} IS NOT NULL AND ${t.acceptedAt} IS NOT NULL)`,
    ),
    check(
      'proposals_withdrawn_metadata_check',
      sql`${t.status} <> 'WITHDRAWN' OR (${t.withdrawnBy} IS NOT NULL AND ${t.withdrawnAt} IS NOT NULL)`,
    ),
    check(
      'proposals_client_response_check',
      sql`${t.clientResponseEvent} IS NULL OR ${t.clientResponseEvent} IN ('ACCEPTED','REJECTED')`,
    ),
  ],
);

// ── Proposal revisions (immutable snapshot of the commercial document) ────────
export const proposalRevisions = appSchema.table(
  'proposal_revisions',
  {
    id: text('id').primaryKey(),
    proposalId: text('proposal_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    status: text('status').notNull().default('DRAFT'),
    /** Pinned source references at revision time */
    sourceEstimateId: text('source_estimate_id'),
    sourceEstimateRevisionId: text('source_estimate_revision_id'),
    sourceBoqId: text('source_boq_id'),
    sourceBoqRevisionId: text('source_boq_revision_id'),
    currencyCode: text('currency_code').notNull(),
    calculationVersion: text('calculation_version').notNull().default('proposal-v1'),
    taxPercent: numeric('tax_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    taxSource: text('tax_source'),
    overheadPercent: numeric('overhead_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    contingencyPercent: numeric('contingency_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    markupPercent: numeric('markup_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    discountPercent: numeric('discount_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    subtotalAmount: numeric('subtotal_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    scope: text('scope'),
    inclusions: text('inclusions'),
    exclusions: text('exclusions'),
    assumptions: text('assumptions'),
    clarifications: text('clarifications'),
    validUntil: text('valid_until'),
    estimatedDurationDays: integer('estimated_duration_days'),
    scheduleSummary: text('schedule_summary'),
    commercialTerms: jsonb('commercial_terms'),
    deliveryMethod: text('delivery_method').notNull().default('INTERNAL'),
    deliveryNotes: text('delivery_notes'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    submittedBy: text('submitted_by').references(() => users.id, { onDelete: 'restrict' }),
    submittedAt: timestamp('submitted_at', { withTimezone: true }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    issuedBy: text('issued_by').references(() => users.id, { onDelete: 'restrict' }),
    issuedAt: timestamp('issued_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'proposal_revisions_proposal_scope_fk',
      columns: [t.proposalId, t.organizationId, t.projectId],
      foreignColumns: [proposals.id, proposals.organizationId, proposals.projectId],
    }).onDelete('restrict'),
    uniqueIndex('proposal_revisions_number_unique').on(t.proposalId, t.revisionNumber),
    uniqueIndex('proposal_revisions_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    index('proposal_revisions_org_project_status_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.revisionNumber,
    ),
    check('proposal_revisions_number_positive', sql`${t.revisionNumber} > 0`),
    check(
      'proposal_revisions_status_check',
      sql`${t.status} IN ('DRAFT','PENDING_APPROVAL','APPROVED','ISSUED','SUPERSEDED')`,
    ),
    check('proposal_revisions_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check('proposal_revisions_calc_version_length', sql`char_length(${t.calculationVersion}) BETWEEN 1 AND 64`),
    check('proposal_revisions_tax_percent_check', sql`${t.taxPercent} BETWEEN 0 AND 100`),
    check('proposal_revisions_overhead_percent_check', sql`${t.overheadPercent} BETWEEN 0 AND 100`),
    check('proposal_revisions_contingency_percent_check', sql`${t.contingencyPercent} BETWEEN 0 AND 100`),
    check('proposal_revisions_markup_percent_check', sql`${t.markupPercent} BETWEEN 0 AND 100`),
    check('proposal_revisions_discount_percent_check', sql`${t.discountPercent} BETWEEN 0 AND 100`),
    check('proposal_revisions_amounts_nonnegative', sql`${t.subtotalAmount} >= 0 AND ${t.taxAmount} >= 0 AND ${t.totalAmount} >= 0`),
    check(
      'proposal_revisions_tax_source_check',
      sql`${t.taxPercent} = 0 OR (${t.taxSource} IS NOT NULL AND char_length(${t.taxSource}) BETWEEN 1 AND 500)`,
    ),
    check(
      'proposal_revisions_approval_metadata_check',
      sql`${t.status} NOT IN ('APPROVED','ISSUED') OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      'proposal_revisions_issued_metadata_check',
      sql`${t.status} <> 'ISSUED' OR (${t.issuedBy} IS NOT NULL AND ${t.issuedAt} IS NOT NULL)`,
    ),
    check(
      'proposal_revisions_delivery_method_check',
      sql`${t.deliveryMethod} IN ('INTERNAL','EMAIL')`,
    ),
    check(
      'proposal_revisions_valid_until_format',
      sql`${t.validUntil} IS NULL OR ${t.validUntil} ~ '^\d{4}-\d{2}-\d{2}$'`,
    ),
    check(
      'proposal_revisions_duration_positive',
      sql`${t.estimatedDurationDays} IS NULL OR ${t.estimatedDurationDays} > 0`,
    ),
  ],
);

// ── Proposal lines (immutable snapshot per revision) ─────────────────────────
export const proposalLines = appSchema.table(
  'proposal_lines',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull(),
    proposalId: text('proposal_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    sortOrder: integer('sort_order').notNull(),
    itemKey: text('item_key').notNull(),
    sectionKey: text('section_key'),
    description: text('description').notNull(),
    specification: text('specification'),
    unit: text('unit').notNull(),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitRate: numeric('unit_rate', { precision: 15, scale: 2 }).notNull(),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    currencyCode: text('currency_code').notNull(),
    costCodeId: text('cost_code_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'proposal_lines_revision_scope_fk',
      columns: [t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [
        proposalRevisions.id,
        proposalRevisions.organizationId,
        proposalRevisions.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('proposal_lines_id_scope_unique').on(t.id, t.revisionId, t.organizationId, t.projectId),
    uniqueIndex('proposal_lines_key_unique').on(t.revisionId, t.itemKey),
    uniqueIndex('proposal_lines_order_unique').on(t.revisionId, t.sortOrder),
    index('proposal_lines_org_project_revision_idx').on(t.organizationId, t.projectId, t.revisionId),
    check('proposal_lines_sort_positive', sql`${t.sortOrder} > 0`),
    check('proposal_lines_item_key_length', sql`char_length(${t.itemKey}) BETWEEN 1 AND 64`),
    check('proposal_lines_description_length', sql`char_length(${t.description}) BETWEEN 1 AND 500`),
    check('proposal_lines_specification_length', sql`${t.specification} IS NULL OR char_length(${t.specification}) <= 2000`),
    check('proposal_lines_unit_length', sql`char_length(${t.unit}) BETWEEN 1 AND 32`),
    check('proposal_lines_quantity_positive', sql`${t.quantity} > 0`),
    check('proposal_lines_unit_rate_nonnegative', sql`${t.unitRate} >= 0`),
    check('proposal_lines_amount_nonnegative', sql`${t.amount} >= 0`),
    check('proposal_lines_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
  ],
);

// ── Proposal conversion records (durable idempotent project creation) ─────────
export const proposalConversions = appSchema.table(
  'proposal_conversions',
  {
    id: text('id').primaryKey(),
    proposalId: text('proposal_id').notNull(),
    proposalRevisionId: text('proposal_revision_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    /** Unique client-supplied idempotency key (hashed) */
    idempotencyKeyHash: text('idempotency_key_hash').notNull(),
    status: text('status').notNull().default('PENDING'),
    linkedProjectId: text('linked_project_id'),
    failureReason: text('failure_reason'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: 'proposal_conversions_revision_scope_fk',
      columns: [t.proposalRevisionId, t.organizationId, t.projectId],
      foreignColumns: [
        proposalRevisions.id,
        proposalRevisions.organizationId,
        proposalRevisions.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('proposal_conversions_idempotency_unique').on(
      t.organizationId,
      t.projectId,
      t.proposalRevisionId,
      t.idempotencyKeyHash,
    ),
    index('proposal_conversions_org_project_status_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
    ),
    check('proposal_conversions_status_check', sql`${t.status} IN ('PENDING','COMPLETED','FAILED')`),
    check(
      'proposal_conversions_completed_metadata_check',
      sql`${t.status} <> 'COMPLETED' OR (${t.completedAt} IS NOT NULL AND ${t.linkedProjectId} IS NOT NULL)`,
    ),
    check(
      'proposal_conversions_failed_metadata_check',
      sql`${t.status} <> 'FAILED' OR ${t.failureReason} IS NOT NULL`,
    ),
    check('proposal_conversions_key_hash_check', sql`${t.idempotencyKeyHash} ~ '^[a-f0-9]{64}$'`),
  ],
);

// ── Client response events (immutable event log) ──────────────────────────────
export const proposalClientEvents = appSchema.table(
  'proposal_client_events',
  {
    id: text('id').primaryKey(),
    proposalId: text('proposal_id').notNull(),
    proposalRevisionId: text('proposal_revision_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    event: text('event').notNull(),
    clientSignatoryName: text('client_signatory_name'),
    responseReference: text('response_reference'),
    notes: text('notes'),
    recordedBy: text('recorded_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    recordedAt: timestamp('recorded_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'proposal_client_events_revision_scope_fk',
      columns: [t.proposalRevisionId, t.organizationId, t.projectId],
      foreignColumns: [
        proposalRevisions.id,
        proposalRevisions.organizationId,
        proposalRevisions.projectId,
      ],
    }).onDelete('restrict'),
    index('proposal_client_events_org_project_proposal_idx').on(
      t.organizationId,
      t.projectId,
      t.proposalId,
      t.recordedAt.desc(),
    ),
    check(
      'proposal_client_events_event_check',
      sql`${t.event} IN ('ACCEPTED','REJECTED','WITHDRAWN_BY_CLIENT','EXPIRED')`,
    ),
    check(
      'proposal_client_events_notes_length',
      sql`${t.notes} IS NULL OR char_length(${t.notes}) <= 2000`,
    ),
  ],
);

// ── Number sequences (shared for tender + proposal per org) ───────────────────
export const proposalNumberSequences = appSchema.table(
  'proposal_number_sequences',
  {
    organizationId: text('organization_id').notNull(),
    series: text('series').notNull(),
    lastNumber: integer('last_number').notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('proposal_number_sequences_pk').on(t.organizationId, t.series),
    check('proposal_number_sequences_last_number_check', sql`${t.lastNumber} >= 0`),
  ],
);

// ── Inferred types ────────────────────────────────────────────────────────────
export type Tender = typeof tenders.$inferSelect;
export type NewTender = typeof tenders.$inferInsert;
export type Proposal = typeof proposals.$inferSelect;
export type NewProposal = typeof proposals.$inferInsert;
export type ProposalRevision = typeof proposalRevisions.$inferSelect;
export type NewProposalRevision = typeof proposalRevisions.$inferInsert;
export type ProposalLine = typeof proposalLines.$inferSelect;
export type NewProposalLine = typeof proposalLines.$inferInsert;
export type ProposalConversion = typeof proposalConversions.$inferSelect;
export type NewProposalConversion = typeof proposalConversions.$inferInsert;
export type ProposalClientEvent = typeof proposalClientEvents.$inferSelect;
export type NewProposalClientEvent = typeof proposalClientEvents.$inferInsert;
export type ProposalNumberSequence = typeof proposalNumberSequences.$inferSelect;
