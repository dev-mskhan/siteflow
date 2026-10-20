// apps/server/src/modules/ai/conversations/conversation.repository.ts
import { eq, and, desc, asc, lt } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  agentConversations,
  agentMessages,
  type AgentConversation,
  type NewAgentConversation,
  type AgentMessage,
  type NewAgentMessage,
} from '@siteflow/database/schema';

export interface ListConversationsOptions {
  organizationId: string;
  projectId?: string;
  createdBy?: string;
  limit?: number;
  cursor?: string;
}

export class ConversationRepository {
  private get db() {
    return getDb();
  }

  // ── Conversation CRUD ────────────────────────────────────────────────────────

  async createConversation(data: Omit<NewAgentConversation, 'id'>): Promise<AgentConversation> {
    const result = await this.db
      .insert(agentConversations)
      .values({ id: generateId(), ...data })
      .returning();
    return result[0]!;
  }

  async findById(id: string, organizationId: string): Promise<AgentConversation | undefined> {
    const result = await this.db
      .select()
      .from(agentConversations)
      .where(and(eq(agentConversations.id, id), eq(agentConversations.organizationId, organizationId)))
      .limit(1);
    return result[0];
  }

  async list(opts: ListConversationsOptions): Promise<AgentConversation[]> {
    const { organizationId, projectId, createdBy, limit = 20, cursor } = opts;
    const conditions = [eq(agentConversations.organizationId, organizationId)];

    if (projectId) conditions.push(eq(agentConversations.projectId, projectId));
    if (createdBy) conditions.push(eq(agentConversations.createdBy, createdBy));
    if (cursor) conditions.push(lt(agentConversations.createdAt, new Date(cursor)));

    return this.db
      .select()
      .from(agentConversations)
      .where(and(...conditions))
      .orderBy(desc(agentConversations.createdAt))
      .limit(Math.min(limit, 100));
  }

  async archive(id: string, organizationId: string): Promise<void> {
    await this.db
      .update(agentConversations)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(and(eq(agentConversations.id, id), eq(agentConversations.organizationId, organizationId)));
  }

  // ── Message CRUD ─────────────────────────────────────────────────────────────

  async createMessage(data: Omit<NewAgentMessage, 'id'>): Promise<AgentMessage> {
    const result = await this.db
      .insert(agentMessages)
      .values({ id: generateId(), ...data })
      .returning();
    return result[0]!;
  }

  async listMessages(conversationId: string, organizationId: string, limit = 50): Promise<AgentMessage[]> {
    return this.db
      .select()
      .from(agentMessages)
      .where(and(eq(agentMessages.conversationId, conversationId), eq(agentMessages.organizationId, organizationId)))
      .orderBy(asc(agentMessages.createdAt))
      .limit(Math.min(limit, 100));
  }

  /** Fetches recent N messages in chronological order for LangGraph context window */
  async getRecentHistory(conversationId: string, organizationId: string, limit = 20): Promise<AgentMessage[]> {
    const recentDescending = await this.db
      .select()
      .from(agentMessages)
      .where(and(eq(agentMessages.conversationId, conversationId), eq(agentMessages.organizationId, organizationId)))
      .orderBy(desc(agentMessages.createdAt))
      .limit(limit);

    return recentDescending.reverse();
  }

  async setMessageRunId(messageId: string, runId: string): Promise<void> {
    await this.db
      .update(agentMessages)
      .set({ runId })
      .where(eq(agentMessages.id, messageId));
  }
}
