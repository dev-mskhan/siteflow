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
import { projectCostCodes, projects } from './project.schema';

export const estimates = appSchema.table(
  'estimates',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    title: text('title').notNull(),
    description: text('description'),
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
    rejectedBy: text('rejected_by').references(() => users.id, { onDelete: 'restrict' }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
    rejectionReason: text('rejection_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('estimates_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    foreignKey({
      name: 'estimates_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    index('estimates_org_project_created_idx').on(
      t.organizationId,
      t.projectId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    index('estimates_org_project_status_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.updatedAt.desc(),
    ),
    check('estimates_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 160`),
    check('estimates_description_length', sql`${t.description} IS NULL OR char_length(${t.description}) <= 5000`),
    check(
      'estimates_status_check',
      sql`${t.status} IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')`,
    ),
    check('estimates_revision_positive', sql`${t.currentRevisionNumber} > 0`),
    check('estimates_version_positive', sql`${t.version} > 0`),
    check(
      'estimates_approval_metadata_check',
      sql`${t.status} <> 'APPROVED' OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      'estimates_rejection_metadata_check',
      sql`${t.status} <> 'REJECTED' OR (${t.rejectedBy} IS NOT NULL AND ${t.rejectedAt} IS NOT NULL AND char_length(${t.rejectionReason}) >= 10)`,
    ),
  ],
);

export const estimateRevisions = appSchema.table(
  'estimate_revisions',
  {
    id: text('id').primaryKey(),
    estimateId: text('estimate_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    status: text('status').notNull().default('DRAFT'),
    currencyCode: text('currency_code').notNull(),
    calculationVersion: text('calculation_version').notNull().default('estimate-v1'),
    overheadPercent: numeric('overhead_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    contingencyPercent: numeric('contingency_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    markupMode: text('markup_mode').notNull().default('NONE'),
    markupPercent: numeric('markup_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    discountPercent: numeric('discount_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    taxPercent: numeric('tax_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    taxSource: text('tax_source'),
    directCostTotal: numeric('direct_cost_total', { precision: 15, scale: 2 }).notNull().default('0'),
    overheadAmount: numeric('overhead_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    contingencyAmount: numeric('contingency_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    markupAmount: numeric('markup_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    discountAmount: numeric('discount_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxableAmount: numeric('taxable_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    taxAmount: numeric('tax_amount', { precision: 15, scale: 2 }).notNull().default('0'),
    totalAmount: numeric('total_amount', { precision: 15, scale: 2 }).notNull().default('0'),
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
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'estimate_revisions_estimate_scope_fk',
      columns: [t.estimateId, t.organizationId, t.projectId],
      foreignColumns: [estimates.id, estimates.organizationId, estimates.projectId],
    }).onDelete('restrict'),
    uniqueIndex('estimate_revisions_number_unique').on(t.estimateId, t.revisionNumber),
    uniqueIndex('estimate_revisions_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    index('estimate_revisions_project_status_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.revisionNumber,
    ),
    check('estimate_revisions_number_positive', sql`${t.revisionNumber} > 0`),
    check(
      'estimate_revisions_status_check',
      sql`${t.status} IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')`,
    ),
    check('estimate_revisions_currency_check', sql`${t.currencyCode} ~ '^[A-Z]{3}$'`),
    check('estimate_revisions_calculation_version_check', sql`char_length(${t.calculationVersion}) BETWEEN 1 AND 64`),
    check('estimate_revisions_overhead_percent_check', sql`${t.overheadPercent} BETWEEN 0 AND 100`),
    check('estimate_revisions_contingency_percent_check', sql`${t.contingencyPercent} BETWEEN 0 AND 100`),
    check('estimate_revisions_markup_mode_check', sql`${t.markupMode} IN ('NONE', 'MARKUP', 'TARGET_MARGIN')`),
    check(
      'estimate_revisions_markup_percent_check',
      sql`${t.markupPercent} >= 0 AND (${t.markupMode} <> 'TARGET_MARGIN' OR ${t.markupPercent} < 100)`,
    ),
    check('estimate_revisions_discount_percent_check', sql`${t.discountPercent} BETWEEN 0 AND 100`),
    check('estimate_revisions_tax_percent_check', sql`${t.taxPercent} BETWEEN 0 AND 100`),
    check(
      'estimate_revisions_tax_source_check',
      sql`${t.taxPercent} = 0 OR (${t.taxSource} IS NOT NULL AND char_length(${t.taxSource}) BETWEEN 1 AND 500)`,
    ),
    check(
      'estimate_revisions_amounts_nonnegative_check',
      sql`${t.directCostTotal} >= 0 AND ${t.overheadAmount} >= 0 AND ${t.contingencyAmount} >= 0 AND ${t.markupAmount} >= 0 AND ${t.discountAmount} >= 0 AND ${t.taxableAmount} >= 0 AND ${t.taxAmount} >= 0 AND ${t.totalAmount} >= 0`,
    ),
    check(
      'estimate_revisions_approval_metadata_check',
      sql`${t.status} <> 'APPROVED' OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      'estimate_revisions_rejection_metadata_check',
      sql`${t.status} <> 'REJECTED' OR (${t.rejectedBy} IS NOT NULL AND ${t.rejectedAt} IS NOT NULL AND char_length(${t.rejectionReason}) >= 10)`,
    ),
  ],
);

export const estimateSections = appSchema.table(
  'estimate_sections',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    sectionNumber: integer('section_number').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'estimate_sections_revision_scope_fk',
      columns: [t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [
        estimateRevisions.id,
        estimateRevisions.organizationId,
        estimateRevisions.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('estimate_sections_id_scope_unique').on(t.id, t.revisionId, t.organizationId, t.projectId),
    uniqueIndex('estimate_sections_number_unique').on(t.revisionId, t.sectionNumber),
    index('estimate_sections_org_project_revision_idx').on(t.organizationId, t.projectId, t.revisionId),
    check('estimate_sections_number_positive', sql`${t.sectionNumber} > 0`),
    check('estimate_sections_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 160`),
    check('estimate_sections_description_length', sql`${t.description} IS NULL OR char_length(${t.description}) <= 2000`),
  ],
);

export const estimateLines = appSchema.table(
  'estimate_lines',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull(),
    sectionId: text('section_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    costCodeId: text('cost_code_id'),
    lineNumber: integer('line_number').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    specification: text('specification'),
    quantity: numeric('quantity', { precision: 15, scale: 3 }).notNull(),
    unit: text('unit').notNull(),
    unitRate: numeric('unit_rate', { precision: 15, scale: 2 }),
    directAmount: numeric('direct_amount', { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'estimate_lines_revision_scope_fk',
      columns: [t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [
        estimateRevisions.id,
        estimateRevisions.organizationId,
        estimateRevisions.projectId,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'estimate_lines_section_scope_fk',
      columns: [t.sectionId, t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [
        estimateSections.id,
        estimateSections.revisionId,
        estimateSections.organizationId,
        estimateSections.projectId,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'estimate_lines_cost_code_scope_fk',
      columns: [t.costCodeId, t.organizationId, t.projectId],
      foreignColumns: [
        projectCostCodes.id,
        projectCostCodes.organizationId,
        projectCostCodes.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('estimate_lines_number_unique').on(t.sectionId, t.lineNumber),
    uniqueIndex('estimate_lines_id_scope_unique').on(
      t.id,
      t.revisionId,
      t.organizationId,
      t.projectId,
    ),
    index('estimate_lines_org_project_cost_code_idx').on(
      t.organizationId,
      t.projectId,
      t.costCodeId,
    ),
    index('estimate_lines_revision_idx').on(t.organizationId, t.projectId, t.revisionId),
    check('estimate_lines_number_positive', sql`${t.lineNumber} > 0`),
    check(
      'estimate_lines_category_check',
      sql`${t.category} IN ('MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER')`,
    ),
    check('estimate_lines_description_length', sql`char_length(${t.description}) BETWEEN 1 AND 500`),
    check('estimate_lines_specification_length', sql`${t.specification} IS NULL OR char_length(${t.specification}) <= 2000`),
    check('estimate_lines_quantity_check', sql`${t.quantity} > 0`),
    check('estimate_lines_unit_length', sql`char_length(${t.unit}) BETWEEN 1 AND 32`),
    check('estimate_lines_unit_rate_check', sql`${t.unitRate} IS NULL OR ${t.unitRate} >= 0`),
    check('estimate_lines_direct_amount_check', sql`${t.directAmount} >= 0`),
  ],
);

export const estimateLineResources = appSchema.table(
  'estimate_line_resources',
  {
    id: text('id').primaryKey(),
    estimateLineId: text('estimate_line_id').notNull(),
    revisionId: text('revision_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    resourceNumber: integer('resource_number').notNull(),
    category: text('category').notNull(),
    description: text('description').notNull(),
    unit: text('unit').notNull(),
    quantityPerLineUnit: numeric('quantity_per_line_unit', { precision: 15, scale: 6 }).notNull(),
    unitRate: numeric('unit_rate', { precision: 15, scale: 2 }).notNull(),
    wastePercent: numeric('waste_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    rateSource: text('rate_source'),
    extendedAmount: numeric('extended_amount', { precision: 15, scale: 2 }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'estimate_line_resources_line_scope_fk',
      columns: [t.estimateLineId, t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [
        estimateLines.id,
        estimateLines.revisionId,
        estimateLines.organizationId,
        estimateLines.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('estimate_line_resources_number_unique').on(t.estimateLineId, t.resourceNumber),
    index('estimate_line_resources_revision_idx').on(t.organizationId, t.projectId, t.revisionId),
    check('estimate_line_resources_number_positive', sql`${t.resourceNumber} > 0`),
    check(
      'estimate_line_resources_category_check',
      sql`${t.category} IN ('MATERIAL', 'LABOR', 'EQUIPMENT', 'SUBCONTRACTOR', 'OTHER')`,
    ),
    check('estimate_line_resources_description_length', sql`char_length(${t.description}) BETWEEN 1 AND 500`),
    check('estimate_line_resources_unit_length', sql`char_length(${t.unit}) BETWEEN 1 AND 32`),
    check('estimate_line_resources_quantity_check', sql`${t.quantityPerLineUnit} > 0`),
    check('estimate_line_resources_rate_check', sql`${t.unitRate} >= 0`),
    check('estimate_line_resources_waste_check', sql`${t.wastePercent} BETWEEN 0 AND 100`),
    check('estimate_line_resources_source_length', sql`${t.rateSource} IS NULL OR char_length(${t.rateSource}) <= 500`),
    check('estimate_line_resources_amount_check', sql`${t.extendedAmount} >= 0`),
  ],
);

export type Estimate = typeof estimates.$inferSelect;
export type NewEstimate = typeof estimates.$inferInsert;
export type EstimateRevision = typeof estimateRevisions.$inferSelect;
export type NewEstimateRevision = typeof estimateRevisions.$inferInsert;
export type EstimateSection = typeof estimateSections.$inferSelect;
export type EstimateLine = typeof estimateLines.$inferSelect;
export type EstimateLineResource = typeof estimateLineResources.$inferSelect;
export type NewEstimateSection = typeof estimateSections.$inferInsert;
export type NewEstimateLine = typeof estimateLines.$inferInsert;
export type NewEstimateLineResource = typeof estimateLineResources.$inferInsert;
