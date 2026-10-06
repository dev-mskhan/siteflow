import { sql } from 'drizzle-orm';
import { boolean, date, index, text, timestamp } from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { organizations } from './org.schema';
import { projectMembers, projects } from './project.schema';

export const permitStatusEnum = appSchema.enum('permit_status', [
  'PENDING',
  'APPLIED',
  'ISSUED',
  'ACTIVE',
  'EXPIRED',
  'REVOKED',
  'CANCELLED',
]);

export const complianceInspectionStatusEnum = appSchema.enum('compliance_inspection_status', [
  'SCHEDULED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
]);

export const complianceInspectionResultEnum = appSchema.enum('compliance_inspection_result', [
  'PASS',
  'PASS_WITH_CONDITIONS',
  'FAIL',
  'INCONCLUSIVE',
]);

export const complianceStatusEnum = appSchema.enum('compliance_status', [
  'PENDING',
  'ACTIVE',
  'EXPIRING_SOON',
  'EXPIRED',
  'CANCELLED',
  'VERIFIED',
]);

export const permits = appSchema.table(
  'permits',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    permitType: text('permit_type').notNull(),
    referenceNumber: text('reference_number'),
    issuingAuthority: text('issuing_authority'),
    responsibleMemberId: text('responsible_member_id')
      .references(() => projectMembers.id, { onDelete: 'set null' }),
    status: permitStatusEnum('status').notNull().default('PENDING'),
    issueDate: date('issue_date'),
    effectiveDate: date('effective_date'),
    expiryDate: date('expiry_date'),
    expiresNotified: boolean('expires_notified').notNull().default(false),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('permits_org_project_idx').on(t.organizationId, t.projectId),
    index('permits_project_status_expiry_idx').on(t.projectId, t.status, t.expiryDate),
    index('permits_expiry_partial_idx')
      .on(t.expiryDate, t.expiresNotified)
      .where(sql`${t.status} IN ('ISSUED', 'ACTIVE')`),
    index('permits_responsible_member_idx').on(t.responsibleMemberId),
    index('permits_created_by_idx').on(t.createdBy),
  ],
);

export const complianceInspections = appSchema.table(
  'compliance_inspections',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    permitId: text('permit_id').references(() => permits.id, { onDelete: 'set null' }),
    inspectionType: text('inspection_type').notNull(),
    scheduledDate: date('scheduled_date'),
    performedDate: date('performed_date'),
    inspectorName: text('inspector_name'),
    responsibleMemberId: text('responsible_member_id')
      .references(() => projectMembers.id, { onDelete: 'set null' }),
    status: complianceInspectionStatusEnum('status').notNull().default('SCHEDULED'),
    result: complianceInspectionResultEnum('result'),
    findings: text('findings'),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('compliance_inspections_org_project_idx').on(t.organizationId, t.projectId),
    index('compliance_inspections_project_status_idx').on(t.projectId, t.status),
    index('compliance_inspections_permit_idx').on(t.permitId),
    index('compliance_inspections_responsible_member_idx').on(t.responsibleMemberId),
    index('compliance_inspections_created_by_idx').on(t.createdBy),
  ],
);

export const complianceRecords = appSchema.table(
  'compliance_records',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    requirementType: text('requirement_type').notNull(),
    subjectType: text('subject_type'),
    subjectId: text('subject_id'),
    responsibleMemberId: text('responsible_member_id')
      .references(() => projectMembers.id, { onDelete: 'set null' }),
    status: complianceStatusEnum('status').notNull().default('PENDING'),
    effectiveDate: date('effective_date'),
    expiryDate: date('expiry_date'),
    expiresNotified: boolean('expires_notified').notNull().default(false),
    verificationRef: text('verification_ref'),
    notes: text('notes'),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('compliance_records_org_project_idx').on(t.organizationId, t.projectId),
    index('compliance_records_project_status_idx').on(t.projectId, t.status),
    index('compliance_records_expiry_partial_idx')
      .on(t.expiryDate, t.expiresNotified)
      .where(sql`${t.status} = 'ACTIVE'`),
    index('compliance_records_responsible_member_idx').on(t.responsibleMemberId),
    index('compliance_records_created_by_idx').on(t.createdBy),
    index('compliance_records_subject_idx').on(t.subjectType, t.subjectId),
  ],
);

export type Permit = typeof permits.$inferSelect;
export type NewPermit = typeof permits.$inferInsert;
export type ComplianceInspection = typeof complianceInspections.$inferSelect;
export type NewComplianceInspection = typeof complianceInspections.$inferInsert;
export type ComplianceRecord = typeof complianceRecords.$inferSelect;
export type NewComplianceRecord = typeof complianceRecords.$inferInsert;
