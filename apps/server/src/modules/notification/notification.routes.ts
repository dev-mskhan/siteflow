import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createSuccessResponse } from '../../shared/response.js';
import { authenticate } from '../auth/auth.middleware.js';
import { NotFoundError } from '../auth/auth.errors.js';
import { organizationContext } from '../rbac/permission.middleware.js';
import { notificationService } from './notification.service.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  fastify.get<{ Params: { organizationId: string }; Querystring: { limit?: number } }>(
    '/api/v1/organizations/:organizationId/notifications',
    async (request, reply) => {
      const { limit } = listQuerySchema.parse(request.query);
      const notifications = await notificationService.getRecipientNotifications(
        request.orgContext!.organizationId,
        request.orgContext!.userId,
        limit,
      );
      return reply.send(createSuccessResponse({ notifications }));
    },
  );

  fastify.patch<{ Params: { organizationId: string; notificationId: string } }>(
    '/api/v1/organizations/:organizationId/notifications/:notificationId/read',
    async (request, reply) => {
      const notification = await notificationService.markRead(
        request.orgContext!.organizationId,
        request.orgContext!.userId,
        request.params.notificationId,
      );
      if (!notification) throw new NotFoundError('Notification not found');
      return reply.send(createSuccessResponse({ notification }));
    },
  );
};
