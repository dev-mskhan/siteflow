// apps/server/src/modules/ai/memory/memory.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import {
  handleListMemory,
  handleGetMemory,
  handleSetMemory,
  handleDeleteMemory,
  handleClearMemory,
} from './memory.handler.js';
import {
  listMemorySchemaDoc,
  getMemorySchemaDoc,
  setMemorySchemaDoc,
  deleteMemorySchemaDoc,
} from './memory.schemas.js';

export const memoryRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/ai/memory',
    {
      schema: listMemorySchemaDoc,
      preHandler: [requirePermission('ai.memory.read')],
    },
    handleListMemory,
  );

  fastify.get(
    '/:organizationId/ai/memory/:key',
    {
      schema: getMemorySchemaDoc,
      preHandler: [requirePermission('ai.memory.read')],
    },
    handleGetMemory,
  );

  fastify.put(
    '/:organizationId/ai/memory/:key',
    {
      schema: setMemorySchemaDoc,
      preHandler: [requirePermission('ai.memory.manage')],
    },
    handleSetMemory,
  );

  fastify.delete(
    '/:organizationId/ai/memory/:key',
    {
      schema: deleteMemorySchemaDoc,
      preHandler: [requirePermission('ai.memory.manage')],
    },
    handleDeleteMemory,
  );

  fastify.delete(
    '/:organizationId/ai/memory',
    {
      schema: deleteMemorySchemaDoc,
      preHandler: [requirePermission('ai.memory.manage')],
    },
    handleClearMemory,
  );
};
