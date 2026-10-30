import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { createSuccessResponse } from '../../shared/response.js';
import { authenticate } from '../auth/auth.middleware.js';
import { NotFoundError } from '../auth/auth.errors.js';
import { organizationContext } from '../rbac/permission.middleware.js';
import { notificationService } from './notification.service.js';
import { preferenceService } from './preferences/preference.service.js';
import { NOTIFICATION_PREFERENCE_OPTIONS } from './preferences/preference.catalog.js';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

const updatePreferenceSchema = z.object({
  eventType: z.string().min(1),
  channel: z.enum(['EMAIL', 'IN_APP', 'REALTIME', 'WHATSAPP']),
  enabled: z.boolean(),
});

export const notificationRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  // ─── Notification List ───────────────────────────────────────────────────────
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

  // ─── Unread Count ────────────────────────────────────────────────────────────
  fastify.get<{ Params: { organizationId: string } }>(
    '/api/v1/organizations/:organizationId/notifications/unread-count',
    async (request, reply) => {
      const unreadCount = await notificationService.getUnreadCount(
        request.orgContext!.organizationId,
        request.orgContext!.userId,
      );
      return reply.send(createSuccessResponse({ unreadCount }));
    },
  );

  // ─── Mark Single Read ────────────────────────────────────────────────────────
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

  // ─── Mark All Read ───────────────────────────────────────────────────────────
  fastify.post<{ Params: { organizationId: string } }>(
    '/api/v1/organizations/:organizationId/notifications/read-all',
    async (request, reply) => {
      const markedCount = await notificationService.markAllRead(
        request.orgContext!.organizationId,
        request.orgContext!.userId,
      );
      return reply.send(createSuccessResponse({ markedCount }));
    },
  );

  // ─── Preferences: Get User Preferences ──────────────────────────────────────
  fastify.get<{ Params: { organizationId: string } }>(
    '/api/v1/organizations/:organizationId/notifications/preferences',
    async (request, reply) => {
      const preferences = await preferenceService.getUserPreferences(
        request.orgContext!.organizationId,
        request.orgContext!.userId,
      );
      return reply.send(
        createSuccessResponse({
          preferences,
          preferenceOptions: NOTIFICATION_PREFERENCE_OPTIONS,
        }),
      );
    },
  );

  // ─── Preferences: Update Preference ─────────────────────────────────────────
  fastify.put<{ Params: { organizationId: string } }>(
    '/api/v1/organizations/:organizationId/notifications/preferences',
    async (request, reply) => {
      const body = updatePreferenceSchema.parse(request.body);
      const preference = await preferenceService.setPreference(
        request.orgContext!.organizationId,
        request.orgContext!.userId,
        body.eventType,
        body.channel,
        body.enabled,
      );
      return reply.send(createSuccessResponse({ preference }));
    },
  );
};
