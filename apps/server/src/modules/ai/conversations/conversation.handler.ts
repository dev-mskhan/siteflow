// apps/server/src/modules/ai/conversations/conversation.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { ConversationService } from './conversation.service.js';
import { createSuccessResponse } from '../../../shared/response.js';

const conversationService = new ConversationService();

const createConversationBodySchema = z.object({
  agent: z.string(),
  projectId: z.string().uuid().optional(),
  title: z.string().max(200).optional(),
});

const sendMessageBodySchema = z.object({
  content: z.string().min(1).max(10000),
});

export async function handleCreateConversation(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId } = request.params as { organizationId: string };
  const body = createConversationBodySchema.parse(request.body);
  const userId = request.user!.sub;

  const conversation = await conversationService.createConversation({
    organizationId,
    projectId: body.projectId,
    agent: body.agent,
    title: body.title,
    createdBy: userId,
  });

  return reply.status(201).send(createSuccessResponse({ conversation }));
}

export async function handleListConversations(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId } = request.params as { organizationId: string };
  const query = request.query as { projectId?: string };

  const conversations = await conversationService.listConversations(
    organizationId,
    query.projectId,
  );

  return reply.send(createSuccessResponse({ data: conversations }));
}

export async function handleGetConversation(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, conversationId } = request.params as {
    organizationId: string;
    conversationId: string;
  };

  const conversation = await conversationService.getConversation(conversationId, organizationId);
  if (!conversation) {
    return reply.status(404).send({ error: 'Conversation not found' });
  }

  return reply.send(createSuccessResponse({ conversation }));
}

export async function handleArchiveConversation(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, conversationId } = request.params as {
    organizationId: string;
    conversationId: string;
  };

  await conversationService.archiveConversation(conversationId, organizationId);
  return reply.send(createSuccessResponse({ message: 'Conversation archived' }));
}

export async function handleSendMessage(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, conversationId } = request.params as {
    organizationId: string;
    conversationId: string;
  };
  const body = sendMessageBodySchema.parse(request.body);
  const userId = request.user!.sub;

  const { messageId, runId } = await conversationService.sendMessage({
    organizationId,
    conversationId,
    content: body.content,
    userId,
  });

  return reply.status(202).send(createSuccessResponse({ messageId, runId }));
}

export async function handleListMessages(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { organizationId, conversationId } = request.params as {
    organizationId: string;
    conversationId: string;
  };

  const messages = await conversationService.listMessages(conversationId, organizationId);
  return reply.send(createSuccessResponse({ data: messages }));
}
