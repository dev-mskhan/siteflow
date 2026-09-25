// apps/server/src/modules/organization/sequences/sequences.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import {
  handleListSequences,
  handleGetSequence,
  handleUpdateSequence,
} from './sequences.handler.js';
import {
  listSequencesSchemaDoc,
  getSequenceSchemaDoc,
  updateSequenceSchemaDoc,
} from './docs/sequences.schemas.js';

export const sequenceRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/document-sequences',
    { schema: listSequencesSchemaDoc, preHandler: [requirePermission('settings:read')] },
    handleListSequences,
  );

  fastify.get(
    '/:organizationId/document-sequences/:type',
    { schema: getSequenceSchemaDoc, preHandler: [requirePermission('settings:read')] },
    handleGetSequence,
  );

  fastify.patch(
    '/:organizationId/document-sequences/:type',
    { schema: updateSequenceSchemaDoc, preHandler: [requirePermission('settings:update')] },
    handleUpdateSequence,
  );
};
