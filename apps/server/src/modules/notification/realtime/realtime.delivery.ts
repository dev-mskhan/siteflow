import { type FastifyReply } from 'fastify';
import { authorizeRealtimeDelivery } from './realtime.authorization.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'realtime-delivery' });

export interface SSEConnection {
  connectionId: string;
  userId: string;
  organizationId: string;
  reply: FastifyReply;
}

export class RealtimeDeliveryManager {
  private connections: Map<string, SSEConnection> = new Map();

  addConnection(conn: SSEConnection): void {
    this.connections.set(conn.connectionId, conn);
    logger.info({ connectionId: conn.connectionId, organizationId: conn.organizationId, userId: conn.userId }, 'Realtime SSE connection established');

    // Clean up when connection closes
    conn.reply.raw.on('close', () => {
      this.removeConnection(conn.connectionId);
    });
  }

  removeConnection(connectionId: string): void {
    if (this.connections.has(connectionId)) {
      this.connections.delete(connectionId);
      logger.info({ connectionId }, 'Realtime SSE connection closed');
    }
  }

  broadcastToTenant(organizationId: string, eventData: Record<string, unknown>): number {
    let sentCount = 0;
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;

    for (const conn of this.connections.values()) {
      if (authorizeRealtimeDelivery(conn.organizationId, organizationId)) {
        try {
          conn.reply.raw.write(payload);
          sentCount++;
        } catch (err: any) {
          logger.error({ connectionId: conn.connectionId, err: err?.message }, 'Failed to write SSE payload');
          this.removeConnection(conn.connectionId);
        }
      }
    }

    return sentCount;
  }

  getConnectionCount(organizationId?: string): number {
    if (!organizationId) return this.connections.size;
    let count = 0;
    for (const conn of this.connections.values()) {
      if (conn.organizationId === organizationId) count++;
    }
    return count;
  }
}

export const realtimeDeliveryManager = new RealtimeDeliveryManager();
