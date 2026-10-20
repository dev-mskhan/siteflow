// packages/database/src/schema/ai-chat.schema.ts
// AI chat persistence layer — conversations and multi-turn message history.
// All tables are tenant-scoped (organizationId mandatory).

import { index, text, timestamp } from 'drizzle-orm/pg-core';
import { appSchema } from './auth.schema.js';

// ── agent_conversations ───────────────────────────────────────────────────────
// Multi-turn thread between a user and an agent.
// One conversation spans many messages and agent runs.

export const agentConversations = appSchema.table(
  'agent_conversations',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id'),
    createdBy: text('created_by').notNull(),
    agent: text('agent').notNull(),
    title: text('title'),
    archivedAt: timestamp('archived_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('agent_conversations_org_idx').on(t.organizationId, t.createdAt.desc()),
    index('agent_conversations_user_idx').on(t.createdBy),
    index('agent_conversations_project_idx').on(t.projectId),
  ],
);

// ── agent_messages ────────────────────────────────────────────────────────────
// Individual message within a conversation.
// role: 'user' | 'assistant' | 'system'
// channel: 'chat' | 'voice'

export const agentMessages = appSchema.table(
  'agent_messages',
  {
    id: text('id').primaryKey(),
    conversationId: text('conversation_id').notNull(),
    organizationId: text('organization_id').notNull(),
    role: text('role').notNull(),
    channel: text('channel').notNull(),
    content: text('content').notNull(),
    runId: text('run_id'), // null for user messages prior to run execution
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('agent_messages_conv_idx').on(t.conversationId, t.createdAt),
    index('agent_messages_run_idx').on(t.runId),
  ],
);

export type AgentConversation = typeof agentConversations.$inferSelect;
export type NewAgentConversation = typeof agentConversations.$inferInsert;

export type AgentMessage = typeof agentMessages.$inferSelect;
export type NewAgentMessage = typeof agentMessages.$inferInsert;
