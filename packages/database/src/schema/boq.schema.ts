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
import { projectCostCodes, projects } from './project.schema';

export const boqs = appSchema.table(
  'boqs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    boqNumber: integer('boq_number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    currencyCode: text('currency_code').notNull(),
    status: text('status').notNull().default('DRAFT'),
    currentRevisionNumber: integer('current_revision_number').notNull().default(1),
    version: integer('version').notNull().default(1),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('boqs_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    uniqueIndex('boqs_number_unique').on(t.organizationId, t.projectId, t.boqNumber),
    foreignKey({
      name: 'boqs_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    index('boqs_org_project_status_idx').on(t.organizationId, t.projectId, t.status, t.updatedAt.desc()),
    check('boqs_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 160`),
    check('boqs_description_length', sql`${t.description} IS NULL OR char_length(${t.description}) <= 2000`),
    check('boqs_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check('boqs_number_positive', sql`${t.boqNumber} > 0`),
    check('boqs_revision_positive', sql`${t.currentRevisionNumber} > 0`),
    check('boqs_version_positive', sql`${t.version} > 0`),
    check(
      'boqs_status_check',
      sql`${t.status} IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'LOCKED')`,
    ),
  ],
);

export const boqRevisions = appSchema.table(
  'boq_revisions',
  {
    id: text('id').primaryKey(),
    boqId: text('boq_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    status: text('status').notNull().default('DRAFT'),
    sourceImportRunId: text('source_import_run_id'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    approvedBy: text('approved_by').references(() => users.id, { onDelete: 'restrict' }),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    lockedBy: text('locked_by').references(() => users.id, { onDelete: 'restrict' }),
    lockedAt: timestamp('locked_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'boq_revisions_boq_scope_fk',
      columns: [t.boqId, t.organizationId, t.projectId],
      foreignColumns: [boqs.id, boqs.organizationId, boqs.projectId],
    }).onDelete('restrict'),
    uniqueIndex('boq_revisions_number_unique').on(t.boqId, t.revisionNumber),
    uniqueIndex('boq_revisions_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    index('boq_revisions_org_project_status_idx').on(t.organizationId, t.projectId, t.status),
    check('boq_revisions_number_positive', sql`${t.revisionNumber} > 0`),
    check(
      'boq_revisions_status_check',
      sql`${t.status} IN ('DRAFT', 'IN_REVIEW', 'APPROVED', 'LOCKED', 'SUPERSEDED')`,
    ),
    check(
      'boq_revisions_approval_metadata_check',
      sql`${t.status} NOT IN ('APPROVED', 'LOCKED', 'SUPERSEDED') OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      'boq_revisions_lock_metadata_check',
      sql`${t.status} <> 'LOCKED' OR (${t.lockedBy} IS NOT NULL AND ${t.lockedAt} IS NOT NULL)`,
    ),
  ],
);

export const boqSections = appSchema.table(
  'boq_sections',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    sectionKey: text('section_key').notNull(),
    parentSectionId: text('parent_section_id'),
    sortOrder: integer('sort_order').notNull(),
    depth: integer('depth').notNull().default(0),
    title: text('title').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'boq_sections_revision_scope_fk',
      columns: [t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [boqRevisions.id, boqRevisions.organizationId, boqRevisions.projectId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'boq_sections_parent_scope_fk',
      columns: [t.parentSectionId, t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [t.id, t.revisionId, t.organizationId, t.projectId],
    }).onDelete('restrict'),
    uniqueIndex('boq_sections_id_scope_unique').on(t.id, t.revisionId, t.organizationId, t.projectId),
    uniqueIndex('boq_sections_key_unique').on(t.revisionId, t.sectionKey),
    uniqueIndex('boq_sections_order_unique').on(t.revisionId, t.sortOrder),
    index('boq_sections_org_project_revision_idx').on(t.organizationId, t.projectId, t.revisionId),
    check('boq_sections_key_length', sql`char_length(${t.sectionKey}) BETWEEN 1 AND 64`),
    check('boq_sections_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 160`),
    check('boq_sections_order_positive', sql`${t.sortOrder} > 0`),
    check('boq_sections_depth_range', sql`${t.depth} BETWEEN 0 AND 5`),
  ],
);

export const boqItems = appSchema.table(
  'boq_items',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull(),
    sectionId: text('section_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    itemKey: text('item_key').notNull(),
    sortOrder: integer('sort_order').notNull(),
    description: text('description').notNull(),
    specification: text('specification'),
    unit: text('unit').notNull(),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unitRate: numeric('unit_rate', { precision: 15, scale: 2 }),
    amount: numeric('amount', { precision: 15, scale: 2 }).notNull(),
    currencyCode: text('currency_code').notNull(),
    costCodeId: text('cost_code_id'),
    provenance: jsonb('provenance'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'boq_items_section_scope_fk',
      columns: [t.sectionId, t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [
        boqSections.id,
        boqSections.revisionId,
        boqSections.organizationId,
        boqSections.projectId,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'boq_items_cost_code_scope_fk',
      columns: [t.costCodeId, t.organizationId, t.projectId],
      foreignColumns: [projectCostCodes.id, projectCostCodes.organizationId, projectCostCodes.projectId],
    }).onDelete('restrict'),
    uniqueIndex('boq_items_key_unique').on(t.revisionId, t.itemKey),
    uniqueIndex('boq_items_order_unique').on(t.revisionId, t.sortOrder),
    uniqueIndex('boq_items_id_scope_unique').on(t.id, t.revisionId, t.organizationId, t.projectId),
    index('boq_items_org_project_cost_code_idx').on(t.organizationId, t.projectId, t.costCodeId),
    index('boq_items_section_order_idx').on(t.sectionId, t.sortOrder),
    check('boq_items_key_length', sql`char_length(${t.itemKey}) BETWEEN 1 AND 64`),
    check('boq_items_description_length', sql`char_length(${t.description}) BETWEEN 1 AND 500`),
    check('boq_items_specification_length', sql`${t.specification} IS NULL OR char_length(${t.specification}) <= 2000`),
    check('boq_items_unit_length', sql`char_length(${t.unit}) BETWEEN 1 AND 32`),
    check('boq_items_order_positive', sql`${t.sortOrder} > 0`),
    check('boq_items_quantity_positive', sql`${t.quantity} > 0`),
    check('boq_items_unit_rate_nonnegative', sql`${t.unitRate} IS NULL OR ${t.unitRate} >= 0`),
    check('boq_items_amount_nonnegative', sql`${t.amount} >= 0`),
    check('boq_items_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
  ],
);

export const boqMappings = appSchema.table(
  'boq_mappings',
  {
    id: text('id').primaryKey(),
    itemId: text('item_id').notNull(),
    revisionId: text('revision_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    targetType: text('target_type').notNull(),
    costCodeId: text('cost_code_id'),
    status: text('status').notNull().default('ACTIVE'),
    reason: text('reason'),
    mappedBy: text('mapped_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    mappedAt: timestamp('mapped_at', { withTimezone: true }).defaultNow().notNull(),
    supersededBy: text('superseded_by').references(() => users.id, { onDelete: 'restrict' }),
    supersededAt: timestamp('superseded_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: 'boq_mappings_item_scope_fk',
      columns: [t.itemId, t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [boqItems.id, boqItems.revisionId, boqItems.organizationId, boqItems.projectId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'boq_mappings_cost_code_scope_fk',
      columns: [t.costCodeId, t.organizationId, t.projectId],
      foreignColumns: [projectCostCodes.id, projectCostCodes.organizationId, projectCostCodes.projectId],
    }).onDelete('restrict'),
    uniqueIndex('boq_mappings_active_target_unique')
      .on(t.itemId, t.targetType)
      .where(sql`${t.status} = 'ACTIVE'`),
    index('boq_mappings_org_project_cost_code_idx').on(t.organizationId, t.projectId, t.costCodeId),
    check('boq_mappings_target_type_check', sql`${t.targetType} IN ('COST_CODE')`),
    check('boq_mappings_status_check', sql`${t.status} IN ('ACTIVE', 'SUPERSEDED')`),
    check(
      'boq_mappings_target_presence_check',
      sql`(${t.targetType} = 'COST_CODE' AND ${t.costCodeId} IS NOT NULL)`,
    ),
    check('boq_mappings_reason_length', sql`${t.reason} IS NULL OR char_length(${t.reason}) <= 500`),
    check(
      'boq_mappings_superseded_metadata_check',
      sql`${t.status} <> 'SUPERSEDED' OR (${t.supersededBy} IS NOT NULL AND ${t.supersededAt} IS NOT NULL)`,
    ),
  ],
);

export const boqImportRuns = appSchema.table(
  'boq_import_runs',
  {
    id: text('id').primaryKey(),
    boqId: text('boq_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    status: text('status').notNull().default('PREVIEWED'),
    sourceFileName: text('source_file_name').notNull(),
    sourceFileSha256: text('source_file_sha256').notNull(),
    sourceByteSize: integer('source_byte_size').notNull(),
    rowCount: integer('row_count').notNull().default(0),
    idempotencyKeyHash: text('idempotency_key_hash').notNull(),
    errorSummary: jsonb('error_summary'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    committedAt: timestamp('committed_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: 'boq_import_runs_boq_scope_fk',
      columns: [t.boqId, t.organizationId, t.projectId],
      foreignColumns: [boqs.id, boqs.organizationId, boqs.projectId],
    }).onDelete('restrict'),
    uniqueIndex('boq_import_runs_idempotency_unique').on(
      t.organizationId,
      t.projectId,
      t.boqId,
      t.idempotencyKeyHash,
    ),
    index('boq_import_runs_org_project_status_idx').on(t.organizationId, t.projectId, t.status, t.createdAt.desc()),
    check('boq_import_runs_status_check', sql`${t.status} IN ('PREVIEWED', 'COMMITTED', 'REJECTED')`),
    check(
      'boq_import_runs_committed_metadata_check',
      sql`${t.status} <> 'COMMITTED' OR ${t.committedAt} IS NOT NULL`,
    ),
    check('boq_import_runs_file_name_length', sql`char_length(${t.sourceFileName}) BETWEEN 1 AND 255`),
    check('boq_import_runs_sha256_check', sql`${t.sourceFileSha256} ~ '^[a-f0-9]{64}$'`),
    check('boq_import_runs_byte_size_check', sql`${t.sourceByteSize} BETWEEN 1 AND 2097152`),
    check('boq_import_runs_row_count_check', sql`${t.rowCount} BETWEEN 0 AND 2000`),
    check('boq_import_runs_key_hash_check', sql`${t.idempotencyKeyHash} ~ '^[a-f0-9]{64}$'`),
  ],
);

export const boqTransferRecords = appSchema.table(
  'boq_transfer_records',
  {
    id: text('id').primaryKey(),
    boqId: text('boq_id').notNull(),
    boqRevisionId: text('boq_revision_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    operation: text('operation').notNull().default('BUDGET_TRANSFER'),
    status: text('status').notNull().default('PREVIEWED'),
    idempotencyKeyHash: text('idempotency_key_hash').notNull(),
    budgetId: text('budget_id'),
    budgetRevisionId: text('budget_revision_id'),
    lineCount: integer('line_count').notNull().default(0),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    resultSummary: jsonb('result_summary'),
    failureReason: text('failure_reason'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (t) => [
    foreignKey({
      name: 'boq_transfer_records_revision_scope_fk',
      columns: [t.boqRevisionId, t.organizationId, t.projectId],
      foreignColumns: [boqRevisions.id, boqRevisions.organizationId, boqRevisions.projectId],
    }).onDelete('restrict'),
    uniqueIndex('boq_transfer_records_operation_unique').on(
      t.organizationId,
      t.projectId,
      t.boqRevisionId,
      t.operation,
    ),
    uniqueIndex('boq_transfer_records_idempotency_unique').on(
      t.organizationId,
      t.projectId,
      t.boqRevisionId,
      t.operation,
      t.idempotencyKeyHash,
    ),
    index('boq_transfer_records_org_project_status_idx').on(t.organizationId, t.projectId, t.status),
    check('boq_transfer_records_operation_check', sql`${t.operation} IN ('BUDGET_TRANSFER')`),
    check('boq_transfer_records_status_check', sql`${t.status} IN ('PREVIEWED', 'COMPLETED', 'FAILED')`),
    check(
      'boq_transfer_records_completed_metadata_check',
      sql`${t.status} <> 'COMPLETED' OR (${t.completedAt} IS NOT NULL AND ${t.budgetId} IS NOT NULL AND ${t.budgetRevisionId} IS NOT NULL)`,
    ),
    check('boq_transfer_records_line_count_check', sql`${t.lineCount} >= 0`),
    check('boq_transfer_records_total_check', sql`${t.totalAmount} >= 0`),
    check('boq_transfer_records_key_hash_check', sql`${t.idempotencyKeyHash} ~ '^[a-f0-9]{64}$'`),
  ],
);

export type Boq = typeof boqs.$inferSelect;
export type NewBoq = typeof boqs.$inferInsert;
export type BoqRevision = typeof boqRevisions.$inferSelect;
export type NewBoqRevision = typeof boqRevisions.$inferInsert;
export type BoqSection = typeof boqSections.$inferSelect;
export type NewBoqSection = typeof boqSections.$inferInsert;
export type BoqItem = typeof boqItems.$inferSelect;
export type NewBoqItem = typeof boqItems.$inferInsert;
export type BoqMapping = typeof boqMappings.$inferSelect;
export type BoqImportRun = typeof boqImportRuns.$inferSelect;
export type BoqTransferRecord = typeof boqTransferRecords.$inferSelect;
