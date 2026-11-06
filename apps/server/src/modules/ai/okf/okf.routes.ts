// apps/server/src/modules/ai/okf/okf.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../../rbac/permission.middleware.js';
import {
  handleListPages,
  handleGetPage,
  handleApprovePage,
  handleRejectPage,
  handleDeletePage,
} from './okf.handler.js';
import {
  listPagesSchemaDoc,
  getPageSchemaDoc,
  approvePageSchemaDoc,
  rejectPageSchemaDoc,
  deletePageSchemaDoc,
} from './okf.schemas.js';

export const okfRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get(
    '/:organizationId/okf/pages',
    {
      schema: listPagesSchemaDoc,
      preHandler: [requirePermission('okf:read')],
    },
    handleListPages,
  );

  fastify.get(
    '/:organizationId/okf/pages/:pageId',
    {
      schema: getPageSchemaDoc,
      preHandler: [requirePermission('okf:read')],
    },
    handleGetPage,
  );

  fastify.post(
    '/:organizationId/okf/pages/:pageId/approve',
    {
      schema: approvePageSchemaDoc,
      preHandler: [requirePermission('okf:approve')],
    },
    handleApprovePage,
  );

  fastify.post(
    '/:organizationId/okf/pages/:pageId/reject',
    {
      schema: rejectPageSchemaDoc,
      preHandler: [requirePermission('okf:approve')],
    },
    handleRejectPage,
  );

  fastify.delete(
    '/:organizationId/okf/pages/:pageId',
    {
      schema: deletePageSchemaDoc,
      preHandler: [requirePermission('okf:approve')],
    },
    handleDeletePage,
  );
};
