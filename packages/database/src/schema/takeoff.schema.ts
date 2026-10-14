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
import { documents, documentVersions } from './documents.schema';
import { boqItems } from './boq.schema';

export const takeoffSheets = appSchema.table(
  'takeoff_sheets',
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
    uniqueIndex('takeoff_sheets_id_scope_unique').on(t.id, t.organizationId, t.projectId),
    foreignKey({
      name: 'takeoff_sheets_project_org_fk',
      columns: [t.projectId, t.organizationId],
      foreignColumns: [projects.id, projects.organizationId],
    }).onDelete('restrict'),
    index('takeoff_sheets_org_project_created_idx').on(
      t.organizationId,
      t.projectId,
      t.createdAt.desc(),
      t.id.desc(),
    ),
    index('takeoff_sheets_org_project_status_idx').on(
      t.organizationId,
      t.projectId,
      t.status,
      t.updatedAt.desc(),
    ),
    check('takeoff_sheets_title_length', sql`char_length(${t.title}) BETWEEN 1 AND 160`),
    check(
      'takeoff_sheets_description_length',
      sql`${t.description} IS NULL OR char_length(${t.description}) <= 2000`,
    ),
    check(
      'takeoff_sheets_status_check',
      sql`${t.status} IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')`,
    ),
    check('takeoff_sheets_revision_positive', sql`${t.currentRevisionNumber} > 0`),
    check('takeoff_sheets_version_positive', sql`${t.version} > 0`),
    check(
      'takeoff_sheets_approval_metadata_check',
      sql`${t.status} <> 'APPROVED' OR (${t.approvedBy} IS NOT NULL AND ${t.approvedAt} IS NOT NULL)`,
    ),
    check(
      'takeoff_sheets_rejection_metadata_check',
      sql`${t.status} <> 'REJECTED' OR (${t.rejectedBy} IS NOT NULL AND ${t.rejectedAt} IS NOT NULL AND char_length(${t.rejectionReason}) >= 10)`,
    ),
  ],
);

export const takeoffSheetRevisions = appSchema.table(
  'takeoff_sheet_revisions',
  {
    id: text('id').primaryKey(),
    sheetId: text('sheet_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    revisionNumber: integer('revision_number').notNull(),
    status: text('status').notNull().default('DRAFT'),
    calculationVersion: text('calculation_version').notNull().default('takeoff-v1'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'takeoff_sheet_revisions_sheet_scope_fk',
      columns: [t.sheetId, t.organizationId, t.projectId],
      foreignColumns: [takeoffSheets.id, takeoffSheets.organizationId, takeoffSheets.projectId],
    }).onDelete('restrict'),
    uniqueIndex('takeoff_sheet_revisions_id_scope_unique').on(
      t.id,
      t.sheetId,
      t.organizationId,
      t.projectId,
    ),
    uniqueIndex('takeoff_sheet_revisions_sheet_number_unique').on(t.sheetId, t.revisionNumber),
    index('takeoff_sheet_revisions_org_project_idx').on(t.organizationId, t.projectId),
    check('takeoff_sheet_revisions_number_positive', sql`${t.revisionNumber} > 0`),
    check(
      'takeoff_sheet_revisions_status_check',
      sql`${t.status} IN ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED')`,
    ),
  ],
);

export const takeoffSources = appSchema.table(
  'takeoff_sources',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull(),
    sheetId: text('sheet_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'restrict' }),
    documentVersionId: text('document_version_id')
      .notNull()
      .references(() => documentVersions.id, { onDelete: 'restrict' }),
    pageReference: text('page_reference').notNull(),
    regionLabel: text('region_label'),
    createdBy: text('created_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'takeoff_sources_revision_scope_fk',
      columns: [t.revisionId, t.sheetId, t.organizationId, t.projectId],
      foreignColumns: [
        takeoffSheetRevisions.id,
        takeoffSheetRevisions.sheetId,
        takeoffSheetRevisions.organizationId,
        takeoffSheetRevisions.projectId,
      ],
    }).onDelete('restrict'),
    uniqueIndex('takeoff_sources_id_scope_unique').on(t.id, t.revisionId, t.organizationId, t.projectId),
    uniqueIndex('takeoff_sources_revision_version_page_unique').on(
      t.revisionId,
      t.documentVersionId,
      t.pageReference,
    ),
    index('takeoff_sources_document_version_idx').on(t.documentVersionId),
    index('takeoff_sources_org_project_idx').on(t.organizationId, t.projectId),
    check('takeoff_sources_page_length', sql`char_length(${t.pageReference}) BETWEEN 1 AND 64`),
    check(
      'takeoff_sources_region_length',
      sql`${t.regionLabel} IS NULL OR char_length(${t.regionLabel}) <= 200`,
    ),
  ],
);

export const takeoffMeasurements = appSchema.table(
  'takeoff_measurements',
  {
    id: text('id').primaryKey(),
    revisionId: text('revision_id').notNull(),
    sheetId: text('sheet_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    lineNumber: integer('line_number').notNull(),
    stableKey: text('stable_key').notNull(),
    description: text('description').notNull(),
    dimension: text('dimension').notNull(),
    unit: text('unit').notNull(),
    measurementMode: text('measurement_mode').notNull(),
    sourceId: text('source_id'),
    formulaText: text('formula_text'),
    manualQuantity: numeric('manual_quantity', { precision: 15, scale: 3 }),
    grossQuantity: numeric('gross_quantity', { precision: 15, scale: 3 }).notNull().default('0'),
    deductionQuantity: numeric('deduction_quantity', { precision: 15, scale: 3 }).notNull().default('0'),
    wastePercent: numeric('waste_percent', { precision: 7, scale: 4 }).notNull().default('0'),
    resultQuantity: numeric('result_quantity', { precision: 15, scale: 3 }).notNull().default('0'),
    boqItemId: text('boq_item_id').references(() => boqItems.id, { onDelete: 'restrict' }),
    costCodeId: text('cost_code_id'),
    notes: text('notes'),
    calculationVersion: text('calculation_version').notNull().default('takeoff-v1'),
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
    foreignKey({
      name: 'takeoff_measurements_revision_scope_fk',
      columns: [t.revisionId, t.sheetId, t.organizationId, t.projectId],
      foreignColumns: [
        takeoffSheetRevisions.id,
        takeoffSheetRevisions.sheetId,
        takeoffSheetRevisions.organizationId,
        takeoffSheetRevisions.projectId,
      ],
    }).onDelete('restrict'),
    foreignKey({
      name: 'takeoff_measurements_source_scope_fk',
      columns: [t.sourceId, t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [takeoffSources.id, takeoffSources.revisionId, takeoffSources.organizationId, takeoffSources.projectId],
    }).onDelete('restrict'),
    foreignKey({
      name: 'takeoff_measurements_cost_code_scope_fk',
      columns: [t.costCodeId, t.organizationId, t.projectId],
      foreignColumns: [projectCostCodes.id, projectCostCodes.organizationId, projectCostCodes.projectId],
    }).onDelete('restrict'),
    uniqueIndex('takeoff_measurements_id_scope_unique').on(t.id, t.revisionId, t.organizationId, t.projectId),
    uniqueIndex('takeoff_measurements_revision_line_unique').on(t.revisionId, t.lineNumber),
    uniqueIndex('takeoff_measurements_revision_key_unique').on(t.revisionId, t.stableKey),
    index('takeoff_measurements_sheet_order_idx').on(t.sheetId, t.lineNumber),
    index('takeoff_measurements_revision_boq_idx').on(t.revisionId, t.boqItemId),
    index('takeoff_measurements_revision_cost_code_idx').on(t.revisionId, t.costCodeId),
    check(
      'takeoff_measurements_dimension_check',
      sql`${t.dimension} IN ('LENGTH', 'AREA', 'VOLUME', 'COUNT')`,
    ),
    check(
      'takeoff_measurements_mode_check',
      sql`${t.measurementMode} IN ('MANUAL', 'FORMULA')`,
    ),
    check(
      'takeoff_measurements_mode_input_check',
      sql`(${t.measurementMode} = 'MANUAL' AND ${t.manualQuantity} IS NOT NULL AND ${t.formulaText} IS NULL)
        OR (${t.measurementMode} = 'FORMULA' AND ${t.formulaText} IS NOT NULL AND ${t.manualQuantity} IS NULL)`,
    ),
    check('takeoff_measurements_gross_nonnegative', sql`${t.grossQuantity} >= 0`),
    check('takeoff_measurements_deduction_nonnegative', sql`${t.deductionQuantity} >= 0`),
    check('takeoff_measurements_result_nonnegative', sql`${t.resultQuantity} >= 0`),
    check(
      'takeoff_measurements_waste_range',
      sql`${t.wastePercent} >= 0 AND ${t.wastePercent} <= 100`,
    ),
    check('takeoff_measurements_line_positive', sql`${t.lineNumber} > 0`),
    check('takeoff_measurements_description_length', sql`char_length(${t.description}) BETWEEN 1 AND 500`),
  ],
);

export const takeoffMeasurementInputs = appSchema.table(
  'takeoff_measurement_inputs',
  {
    id: text('id').primaryKey(),
    measurementId: text('measurement_id').notNull(),
    revisionId: text('revision_id').notNull(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    variableName: text('variable_name').notNull(),
    value: numeric('value', { precision: 18, scale: 6 }).notNull(),
    unit: text('unit').notNull(),
    dimension: text('dimension').notNull(),
    position: integer('position').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    foreignKey({
      name: 'takeoff_measurement_inputs_measurement_scope_fk',
      columns: [t.measurementId, t.revisionId, t.organizationId, t.projectId],
      foreignColumns: [
        takeoffMeasurements.id,
        takeoffMeasurements.revisionId,
        takeoffMeasurements.organizationId,
        takeoffMeasurements.projectId,
      ],
    }).onDelete('cascade'),
    uniqueIndex('takeoff_measurement_inputs_name_unique').on(t.measurementId, t.variableName),
    index('takeoff_measurement_inputs_revision_idx').on(t.revisionId),
    check(
      'takeoff_measurement_inputs_dimension_check',
      sql`${t.dimension} IN ('LENGTH', 'AREA', 'VOLUME', 'COUNT')`,
    ),
    check('takeoff_measurement_inputs_position_positive', sql`${t.position} > 0`),
  ],
);
