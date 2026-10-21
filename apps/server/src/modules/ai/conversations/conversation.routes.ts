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
import {
  createConversationSchemaDoc,
  listConversationsSchemaDoc,
  getConversationSchemaDoc,
  archiveConversationSchemaDoc,
  sendMessageSchemaDoc,
  listMessagesSchemaDoc,
} from '../docs/ai.api.schemas.js';

export const conversationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  // Conversations
  fastify.post(
    '/:organizationId/ai/conversations',
    {
      schema: createConversationSchemaDoc,
      preHandler: [requirePermission('ai.runs.create')],
    },
    handleCreateConversation,
  );

  fastify.get(
    '/:organizationId/ai/conversations',
    {
      schema: listConversationsSchemaDoc,
      preHandler: [requirePermission('ai.runs.read')],
    },
    handleListConversations,
  );

  fastify.get(
    '/:organizationId/ai/conversations/:conversationId',
    {
      schema: getConversationSchemaDoc,
      preHandler: [requirePermission('ai.runs.read')],
    },
    handleGetConversation,
  );

  fastify.delete(
    '/:organizationId/ai/conversations/:conversationId',
    {
      schema: archiveConversationSchemaDoc,
      preHandler: [requirePermission('ai.runs.create')],
    },
    handleArchiveConversation,
  );

  // Messages
  fastify.post(
    '/:organizationId/ai/conversations/:conversationId/messages',
    {
      schema: sendMessageSchemaDoc,
      preHandler: [requirePermission('ai.runs.create')],
    },
    handleSendMessage,
  );

  fastify.get(
    '/:organizationId/ai/conversations/:conversationId/messages',
    {
      schema: listMessagesSchemaDoc,
      preHandler: [requirePermission('ai.runs.read')],
    },
    handleListMessages,
  );
};
