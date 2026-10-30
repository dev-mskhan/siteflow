// apps/server/src/modules/ai/voice/voice.routes.ts
// Route endpoints for voice audio uploads to AI conversations.

import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import { handleVoiceMessage } from './voice.handler.js';
import { voiceMessageSchemaDoc } from '../docs/ai.api.schemas.js';

export const voiceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addContentTypeParser(
    ['application/octet-stream', /^audio\/.*/, /^video\/.*/],
    { parseAs: 'buffer' },
    (_request, body, done) => {
      done(null, body ?? Buffer.alloc(0));
    },
  );

  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.post(
    '/:organizationId/ai/conversations/:conversationId/voice',
    {
      schema: voiceMessageSchemaDoc,
      preHandler: [requirePermission('ai.runs.create')],
    },
    handleVoiceMessage,
  );
};
