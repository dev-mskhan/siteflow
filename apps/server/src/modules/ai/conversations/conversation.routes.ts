// apps/server/src/modules/ai/conversations/conversation.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import {
  handleCreateConversation,
  handleListConversations,
  handleGetConversation,
  handleArchiveConversation,
  handleSendMessage,
  handleListMessages,
} from './conversation.handler.js';

export const conversationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  // Conversations
  fastify.post(
    '/:organizationId/ai/conversations',
    { preHandler: [requirePermission('ai.runs.create')] },
    handleCreateConversation,
  );

  fastify.get(
    '/:organizationId/ai/conversations',
    { preHandler: [requirePermission('ai.runs.read')] },
    handleListConversations,
  );

  fastify.get(
    '/:organizationId/ai/conversations/:conversationId',
    { preHandler: [requirePermission('ai.runs.read')] },
    handleGetConversation,
  );

  fastify.delete(
    '/:organizationId/ai/conversations/:conversationId',
    { preHandler: [requirePermission('ai.runs.create')] },
    handleArchiveConversation,
  );

  // Messages
  fastify.post(
    '/:organizationId/ai/conversations/:conversationId/messages',
    { preHandler: [requirePermission('ai.runs.create')] },
    handleSendMessage,
  );

  fastify.get(
    '/:organizationId/ai/conversations/:conversationId/messages',
    { preHandler: [requirePermission('ai.runs.read')] },
    handleListMessages,
  );
};
