import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { authorizeRealtimeSubscription } from './realtime.authorization.js';
import { realtimeDeliveryManager } from './realtime.delivery.js';
import { generateId } from '../../../lib/id.js';

export async function realtimePlugin(app: FastifyInstance): Promise<void> {
  app.get(
    '/api/v1/organizations/:organizationId/notifications/stream',
    async (request: FastifyRequest<{ Params: { organizationId: string } }>, reply: FastifyReply) => {
      const { organizationId } = request.params;
      const user = (request as any).user;

      const userOrgId = user?.organizationId ?? organizationId; // Validate tenant
      const authResult = authorizeRealtimeSubscription(userOrgId, organizationId);

      if (!authResult.authorized) {
        return reply.status(403).send({ error: authResult.reason });
      }

      // Configure SSE Headers
      reply.raw.setHeader('Content-Type', 'text/event-stream');
      reply.raw.setHeader('Cache-Control', 'no-cache');
      reply.raw.setHeader('Connection', 'keep-alive');
      reply.raw.setHeader('Access-Control-Allow-Origin', '*');
      reply.raw.flushHeaders();

      const connectionId = generateId();
      realtimeDeliveryManager.addConnection({
        connectionId,
        userId: user?.id ?? 'anonymous',
        organizationId,
        reply,
      });

      // Send initial connection event
      reply.raw.write(`data: ${JSON.stringify({ type: 'CONNECTED', connectionId, organizationId })}\n\n`);
    },
  );
}
