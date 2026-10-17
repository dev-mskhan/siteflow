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

  closeConnectionsForUser(userId: string): number {
    return this.closeMatching((conn) => conn.userId === userId, 'user_revoked');
  }

  closeConnectionsForOrganization(organizationId: string): number {
    return this.closeMatching((conn) => conn.organizationId === organizationId, 'org_revoked');
  }

  private closeMatching(match: (conn: SSEConnection) => boolean, reason: string): number {
    let closed = 0;
    for (const conn of [...this.connections.values()]) {
      if (!match(conn)) continue;
      try {
        conn.reply.raw.write(`event: revoked\ndata: ${JSON.stringify({ reason })}\n\n`);
      } catch {
        // Socket may already be gone; the removal below still applies.
      }
      try {
        conn.reply.raw.end();
      } catch {
        // Already ended.
      }
      this.removeConnection(conn.connectionId);
      closed++;
    }
    if (closed > 0) {
      logger.info({ reason, closed }, 'Realtime SSE connections closed by revocation');
    }
    return closed;
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

  broadcastToUser(userId: string, organizationId: string, eventData: Record<string, unknown>): number {
    let sentCount = 0;
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;
    for (const conn of this.connections.values()) {
      if (conn.userId !== userId || !authorizeRealtimeDelivery(conn.organizationId, organizationId)) continue;
      try {
        conn.reply.raw.write(payload);
        sentCount += 1;
      } catch (err: unknown) {
        logger.error(
          { connectionId: conn.connectionId, err: err instanceof Error ? err.message : String(err) },
          'Failed to write SSE payload',
        );
        this.removeConnection(conn.connectionId);
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
