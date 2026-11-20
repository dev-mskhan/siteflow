// apps/server/src/modules/invitation/invitation.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import {
  handleCreateInvitation,
  handleListInvitations,
  handleCancelInvitation,
  handleResendInvitation,
  handleAcceptInvitation,
} from './invitation.handler.js';
import {
  createInvitationSchemaDoc,
  listInvitationsSchemaDoc,
  cancelInvitationSchemaDoc,
  resendInvitationSchemaDoc,
  acceptInvitationSchemaDoc,
} from './docs/invitation.schemas.js';

export const invitationRoutes: FastifyPluginAsync = async (fastify) => {
  // Public/authenticated acceptance endpoint — token as URL path parameter
  fastify.post(
    '/invitations/:token/accept',
    {
      schema: acceptInvitationSchemaDoc,
      preHandler: [authenticate],
      config: {
        // Tight rate limit: 10 attempts per 15 min per IP.
        // Tokens are unguessable but leaked links deserve limited attempts.
        rateLimit: { max: 10, timeWindow: '15 minutes' },
      },
      onSend: (_request, reply, _payload, done) => {
        // Prevent the invitation page from sending the token as a Referer to any
        // resource loaded after the redirect.
        reply.header('Referrer-Policy', 'no-referrer');
        done();
      },
    },
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
    scopedRoutes.post(
      '/organizations/:organizationId/invitations/:id/resend',
      { schema: resendInvitationSchemaDoc, preHandler: [requirePermission('member:invite')] },
      handleResendInvitation,
    );
  });
};
