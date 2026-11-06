// packages/database/src/schema/tool-approvals.schema.ts
import { pgTable, varchar, text, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { organizations } from './org.schema';
import { users } from './auth.schema';

export const toolApprovalStatusEnum = pgEnum('tool_approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
]);

export const toolApprovals = pgTable('tool_approvals', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id')
    .references(() => organizations.id, { onDelete: 'cascade' })
    .notNull(),
  toolName: varchar('tool_name', { length: 100 }).notNull(),
  requestedBy: text('requested_by')
    .references(() => users.id, { onDelete: 'cascade' })
    .notNull(),
  requestContext: jsonb('request_context').notNull(), // Agent run context
  toolArgs: jsonb('tool_args').notNull(), // Arguments for the tool
  status: toolApprovalStatusEnum('status').default('PENDING').notNull(),
  approvedBy: text('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
  rejectionReason: text('rejection_reason'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(), // Auto-reject after 24h
});

export type ToolApproval = typeof toolApprovals.$inferSelect;
export type NewToolApproval = typeof toolApprovals.$inferInsert;
