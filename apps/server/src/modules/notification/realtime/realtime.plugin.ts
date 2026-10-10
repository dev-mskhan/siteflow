import type { FastifyInstance } from 'fastify';
import { authorizeRealtimeSubscription } from './realtime.authorization.js';
import { realtimeDeliveryManager } from './realtime.delivery.js';
import { generateId } from '../../../lib/id.js';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext } from '../../rbac/permission.middleware.js';

export async function realtimePlugin(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { organizationId: string } }>(
    '/api/v1/organizations/:organizationId/notifications/stream',
    {
      preHandler: [authenticate, organizationContext],
    },
    async (request, reply) => {
      const { organizationId } = request.params;
      const authResult = authorizeRealtimeSubscription(
        request.orgContext?.organizationId ?? '',
        organizationId,
      );

      if (!authResult.authorized) {
        return reply.status(403).send({ error: authResult.reason });
      }

      // Configure SSE Headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.flushHeaders();

      const connectionId = generateId();
      realtimeDeliveryManager.addConnection({
        connectionId,
        userId: request.orgContext!.userId,
        organizationId: request.orgContext!.organizationId,
        reply,
      });

      // Send initial connection event
      reply.raw.write(
        `data: ${JSON.stringify({
          type: 'CONNECTED',
          connectionId,
          organizationId: request.orgContext!.organizationId,
        })}\n\n`,
      );
    },
  );
}
