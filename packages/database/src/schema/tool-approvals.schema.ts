// packages/database/src/schema/tool-approvals.schema.ts
import { pgTable, uuid, varchar, text, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './org.schema.js';
import { users } from './auth.schema.js';

export const toolApprovalStatusEnum = pgEnum('tool_approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const toolApprovals = pgTable('tool_approvals', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  toolName: varchar('tool_name', { length: 100 }).notNull(),
  requestedBy: uuid('requested_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  requestContext: jsonb('request_context').notNull(), // Agent run context
  toolArgs: jsonb('tool_args').notNull(), // Arguments for the tool
  status: toolApprovalStatusEnum('status').default('PENDING').notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // Auto-reject after 24h
});

export type ToolApproval = typeof toolApprovals.$inferSelect;
export type NewToolApproval = typeof toolApprovals.$inferInsert;
