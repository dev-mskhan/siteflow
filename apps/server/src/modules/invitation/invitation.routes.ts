// apps/server/src/modules/invitation/invitation.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import {
  handleCreateInvitation,
  handleListInvitations,
  handleCancelInvitation,
  handleAcceptInvitation,
} from './invitation.handler.js';
import {
  createInvitationSchemaDoc,
  listInvitationsSchemaDoc,
  cancelInvitationSchemaDoc,
  acceptInvitationSchemaDoc,
} from './docs/invitation.schemas.js';

export const invitationRoutes: FastifyPluginAsync = async (fastify) => {
  // Public/authenticated acceptance endpoint
  fastify.post(
    '/invitations/:token/accept',
    { schema: acceptInvitationSchemaDoc, preHandler: [authenticate] },
    handleAcceptInvitation,
  );

  // Org-scoped invitation management routes
  fastify.register(async (scopedRoutes) => {
    scopedRoutes.addHook('preHandler', authenticate);
    scopedRoutes.addHook('preHandler', organizationContext);

    scopedRoutes.post(
      '/organizations/:organizationId/invitations',
      { schema: createInvitationSchemaDoc, preHandler: [requirePermission('member:invite')] },
      handleCreateInvitation,
    );
    scopedRoutes.get(
      '/organizations/:organizationId/invitations',
      { schema: listInvitationsSchemaDoc, preHandler: [requirePermission('member:read')] },
      handleListInvitations,
    );
    scopedRoutes.delete(
      '/organizations/:organizationId/invitations/:id',
      { schema: cancelInvitationSchemaDoc, preHandler: [requirePermission('invitation:cancel')] },
      handleCancelInvitation,
    );
  });
};
