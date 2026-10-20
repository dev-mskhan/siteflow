// apps/server/src/modules/ai/conversations/conversation.service.ts
import { trace } from '@opentelemetry/api';
import { withSpan } from '@siteflow/observability/server';
import { ConversationRepository } from './conversation.repository.js';
import { AgentRunService } from '../runs/agent-run.service.js';
import { getAgent } from '../core/agent-registry.js';
import { guardInput } from '../guardrails/input-guard.js';
import type { AgentConversation, AgentMessage } from '@siteflow/database/schema';

const tracer = trace.getTracer('ai-conversation-service');

export interface CreateConversationInput {
  organizationId: string;
  projectId?: string;
  agent: string;
  title?: string;
  createdBy: string;
}

export interface SendMessageInput {
  organizationId: string;
  conversationId: string;
  content: string;
  userId: string;
}

export class ConversationService {
  constructor(
    private repo = new ConversationRepository(),
    private runService = new AgentRunService(),
  ) {}

  async createConversation(input: CreateConversationInput): Promise<AgentConversation> {
    return withSpan(tracer, 'ai.conversation.create', async () => {
      const manifest = getAgent(input.agent);
      if (!manifest) throw new Error(`Unknown agent: ${input.agent}`);
      if (!manifest.supportedChannels.includes('chat')) {
        throw new Error(`Agent "${input.agent}" does not support chat channel`);
      }

      return this.repo.createConversation({
        organizationId: input.organizationId,
        projectId: input.projectId ?? null,
        agent: input.agent,
        title: input.title ?? 'New Conversation',
        createdBy: input.createdBy,
      });
    });
  }

  async getConversation(id: string, organizationId: string): Promise<AgentConversation | undefined> {
    return this.repo.findById(id, organizationId);
  }

  async listConversations(organizationId: string, projectId?: string, createdBy?: string): Promise<AgentConversation[]> {
    return this.repo.list({ organizationId, projectId, createdBy });
  }

  async archiveConversation(id: string, organizationId: string): Promise<void> {
    const conv = await this.repo.findById(id, organizationId);
    if (!conv) throw new Error('Conversation not found');
    await this.repo.archive(id, organizationId);
  }

  async sendMessage(input: SendMessageInput): Promise<{ messageId: string; runId: string }> {
    return withSpan(tracer, 'ai.conversation.sendMessage', async () => {
      const conv = await this.repo.findById(input.conversationId, input.organizationId);
      if (!conv) throw new Error('Conversation not found');
      if (conv.archivedAt) throw new Error('Conversation is archived and cannot receive messages');

      // 1. Guard user message text (flag + wrap)
      guardInput(input.content, 'UNTRUSTED');

      // 2. Persist user message
      const userMessage = await this.repo.createMessage({
        conversationId: input.conversationId,
        organizationId: input.organizationId,
        role: 'user',
        channel: 'chat',
        content: input.content,
      });

      // 3. Start agent run for this message
      const { runId } = await this.runService.startRun({
        organizationId: input.organizationId,
        projectId: conv.projectId ?? undefined,
        agent: conv.agent as any,
        input: {
          question: input.content,
          conversationId: input.conversationId,
        },
        createdBy: input.userId,
        trigger: 'USER',
      });

      // 4. Associate runId with user message
      await this.repo.setMessageRunId(userMessage.id, runId);

      return { messageId: userMessage.id, runId };
    });
  }

  async listMessages(conversationId: string, organizationId: string): Promise<AgentMessage[]> {
    return this.repo.listMessages(conversationId, organizationId);
  }

  async saveAssistantReply(
    conversationId: string,
    organizationId: string,
    content: string,
    runId: string,
    channel: 'chat' | 'voice' = 'chat',
  ): Promise<AgentMessage> {
    return this.repo.createMessage({
      conversationId,
      organizationId,
      role: 'assistant',
      channel,
      content,
      runId,
    });
  }
}
