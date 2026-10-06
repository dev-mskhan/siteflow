import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
  date,
  index,
  integer,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { appSchema, users } from './auth.schema';
import { organizations } from './org.schema';
import { projects, tasks } from './project.schema';

export const documentCategoryEnum = appSchema.enum('document_category', [
  'DRAWING',
  'SPECIFICATION',
  'PERMIT',
  'CERTIFICATE',
  'REPORT',
  'PHOTO',
  'VIDEO',
  'CONTRACT',
  'INVOICE',
  'OTHER',
]);

export const documentStatusEnum = appSchema.enum('document_status', [
  'PENDING_UPLOAD',
  'ACTIVE',
  'SUPERSEDED',
  'ARCHIVED',
  'DELETED',
]);

export const documentAccessEnum = appSchema.enum('document_access', [
  'PROJECT_MEMBERS',
  'PROJECT_MANAGERS_ONLY',
  'ADMIN_ONLY',
]);

export const documentProcessingStatusEnum = appSchema.enum('document_processing_status', [
  'NOT_STARTED',
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
]);

export const documents = appSchema.table(
  'documents',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    projectId: text('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    category: documentCategoryEnum('category').notNull(),
    title: text('title').notNull(),
    description: text('description'),
    status: documentStatusEnum('status').notNull().default('PENDING_UPLOAD'),
    processingStatus: documentProcessingStatusEnum('processing_status')
      .notNull()
      .default('NOT_STARTED'),
    processingError: text('processing_error'),
    currentVersion: integer('current_version').notNull().default(1),
    uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    contentType: text('content_type').notNull(),
    checksum: text('checksum'),
    storageKey: text('storage_key'),
    accessPolicy: documentAccessEnum('access_policy').notNull().default('PROJECT_MEMBERS'),
    expiryDate: date('expiry_date'),
    expiresNotified: boolean('expires_notified').notNull().default(false),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('documents_org_project_idx').on(t.organizationId, t.projectId),
    index('documents_project_category_status_idx').on(t.projectId, t.category, t.status),
    index('documents_project_status_idx').on(t.projectId, t.status),
    index('documents_project_created_idx').on(t.projectId, t.createdAt.desc(), t.id.desc()),
    index('documents_expiry_partial_idx')
      .on(t.expiryDate, t.expiresNotified)
      .where(sql`${t.status} = 'ACTIVE'`),
    index('documents_uploaded_by_idx').on(t.uploadedBy),
    uniqueIndex('documents_storage_key_unique').on(t.storageKey),
    check('documents_file_size_positive', sql`${t.fileSize} > 0`),
    check('documents_title_length', sql`char_length(${t.title}) <= 500`),
  ],
);

export const documentVersions = appSchema.table(
  'document_versions',
  {
    id: text('id').primaryKey(),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    versionNumber: integer('version_number').notNull(),
    uploadedBy: text('uploaded_by').references(() => users.id, { onDelete: 'set null' }),
    fileName: text('file_name').notNull(),
    fileSize: bigint('file_size', { mode: 'number' }).notNull(),
    contentType: text('content_type').notNull(),
    checksum: text('checksum'),
    storageKey: text('storage_key').notNull(),
    notes: text('notes'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('document_versions_doc_number_unique').on(t.documentId, t.versionNumber),
    uniqueIndex('document_versions_storage_key_unique').on(t.storageKey),
    index('document_versions_doc_idx').on(t.documentId),
    index('document_versions_org_idx').on(t.organizationId),
    index('document_versions_uploaded_by_idx').on(t.uploadedBy),
    check('document_versions_file_size_positive', sql`${t.fileSize} > 0`),
    check('document_versions_number_positive', sql`${t.versionNumber} > 0`),
  ],
);

export const documentEntityLinks = appSchema.table(
  'document_entity_links',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    entityType: text('entity_type').notNull(),
    entityId: text('entity_id').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('document_entity_links_unique').on(t.documentId, t.entityType, t.entityId),
    index('document_entity_links_entity_idx').on(t.entityType, t.entityId),
    index('document_entity_links_doc_idx').on(t.documentId),
    index('document_entity_links_org_idx').on(t.organizationId),
    index('document_entity_links_created_by_idx').on(t.createdBy),
  ],
);

export const documentAccessLogs = appSchema.table(
  'document_access_logs',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'restrict' }),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    accessedBy: text('accessed_by')
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    accessType: text('access_type').notNull(),
    ipAddress: text('ip_address'),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('document_access_logs_doc_idx').on(t.documentId, t.occurredAt.desc()),
    index('document_access_logs_org_idx').on(t.organizationId),
    index('document_access_logs_accessed_by_idx').on(t.accessedBy),
    check(
      'document_access_logs_access_type_valid',
      sql`${t.accessType} IN ('DOWNLOAD', 'UPLOAD_COMPLETE', 'VERSION_CREATED')`,
    ),
  ],
);

export const taskDocumentLinks = appSchema.table(
  'task_document_links',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id').notNull(),
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    documentId: text('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('task_doc_unique').on(t.taskId, t.documentId),
    index('task_doc_links_task_idx').on(t.taskId),
    index('task_doc_links_document_idx').on(t.documentId),
  ],
);

export type Document = typeof documents.$inferSelect;
export type NewDocument = typeof documents.$inferInsert;
export type DocumentVersion = typeof documentVersions.$inferSelect;
export type NewDocumentVersion = typeof documentVersions.$inferInsert;
export type DocumentEntityLink = typeof documentEntityLinks.$inferSelect;
export type NewDocumentEntityLink = typeof documentEntityLinks.$inferInsert;
export type DocumentAccessLog = typeof documentAccessLogs.$inferSelect;
export type NewDocumentAccessLog = typeof documentAccessLogs.$inferInsert;
export type TaskDocumentLink = typeof taskDocumentLinks.$inferSelect;
export type NewTaskDocumentLink = typeof taskDocumentLinks.$inferInsert;
