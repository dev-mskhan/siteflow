import type { FastifyInstance } from 'fastify';
import { authorizeRealtimeSubscription } from './realtime.authorization.js';
import { realtimeDeliveryManager } from './realtime.delivery.js';
import { generateId } from '../../../lib/id.js';
import { authenticate } from '../../auth/auth.middleware.js';
import { organizationContext } from '../../rbac/permission.middleware.js';

export async function realtimePlugin(app: FastifyInstance): Promise<void> {
  await realtimeDeliveryManager.startSubscriber();

  app.addHook('onClose', async () => {
    await realtimeDeliveryManager.stopSubscriber();
  });

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

      // Hijack response for manual SSE lifecycle management
      reply.hijack();

      // Configure SSE Headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache, no-transform');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('X-Accel-Buffering', 'no');
      reply.raw.flushHeaders();

      const connectionId = generateId();
      realtimeDeliveryManager.addConnection({
        connectionId,
        userId: request.orgContext!.userId,
        organizationId: request.orgContext!.organizationId,
        reply,
      });

      // Keepalive heartbeat to prevent idle proxy or client socket termination
      const heartbeatTimer = setInterval(() => {
        try {
          reply.raw.write(': ping\n\n');
        } catch {
          clearInterval(heartbeatTimer);
        }
      }, 15000);

      reply.raw.on('close', () => {
        clearInterval(heartbeatTimer);
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
