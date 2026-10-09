// packages/database/src/schema/report-export.schema.ts
// F.17B — Report export lifecycle records.
// Stores requester, organization/project scope, report type, filter snapshot, format, state, and expiry.

import { pgSchema, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';

const appSchema = pgSchema('app');

export const reportExportStatusEnum = appSchema.enum('report_export_status', [
  'PENDING',
  'PROCESSING',
  'READY',
  'FAILED',
  'EXPIRED',
]);

export const reportExportFormatEnum = appSchema.enum('report_export_format', [
  'csv',
]);

export const reportExports = appSchema.table(
  'report_exports',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id'), // null for org-level reports (portfolio)
    requestedBy: text('requested_by').notNull(), // userId
    reportType: text('report_type').notNull(),
    format: reportExportFormatEnum('format').notNull().default('csv'),
    filterSnapshot: jsonb('filter_snapshot').notNull().default({}), // normalized filter at time of request
    status: reportExportStatusEnum('status').notNull().default('PENDING'),
    objectKey: text('object_key'), // server-generated MinIO key — never exposed to client
    lastError: text('last_error'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(), // configurable, default +24h
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull(),
  },
  (t) => [
    index('report_exports_org_idx').on(t.organizationId),
    index('report_exports_org_user_idx').on(t.organizationId, t.requestedBy),
    index('report_exports_status_idx').on(t.organizationId, t.status),
    index('report_exports_expires_idx').on(t.expiresAt),
  ],
);

export type ReportExportRecord = typeof reportExports.$inferSelect;
export type NewReportExportRecord = typeof reportExports.$inferInsert;
