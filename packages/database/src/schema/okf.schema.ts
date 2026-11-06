// packages/database/src/schema/okf.schema.ts
//
// OKF (Organizational Knowledge Framework) pages schema
// Learning loop: Agent corrections create DRAFT pages for admin approval

import { pgTable, text, integer, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { organizations } from './org.schema';
import { users } from './auth.schema';

export const okfPages = pgTable('okf_pages', {
  id: text('id').primaryKey(),
  organizationId: text('organization_id').notNull().references(() => organizations.id, { onDelete: 'cascade' }),
  pagePath: text('page_path').notNull(), // e.g., "corrections/cost-code-naming"
  title: text('title').notNull(),
  content: text('content').notNull(), // Markdown
  status: text('status').notNull().$type<'DRAFT' | 'APPROVED' | 'REJECTED' | 'ARCHIVED'>().default('DRAFT'),
  version: integer('version').notNull().default(1),
  source: text('source').notNull().$type<'AGENT_CORRECTION' | 'MANUAL' | 'IMPORTED'>().default('MANUAL'),
  correctionContext: jsonb('correction_context').$type<{
    originalQuestion?: string;
    agentAnswer?: string;
    userCorrection?: string;
    timestamp?: string;
  }>(),
  createdBy: text('created_by').notNull().references(() => users.id),
  approvedBy: text('approved_by').references(() => users.id),
  approvalNotes: text('approval_notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  approvedAt: timestamp('approved_at', { withTimezone: true }),
});

export type OkfPage = typeof okfPages.$inferSelect;
export type NewOkfPage = typeof okfPages.$inferInsert;
