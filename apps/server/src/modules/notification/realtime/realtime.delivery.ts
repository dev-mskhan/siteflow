import { randomUUID } from 'node:crypto';
import type { Redis } from 'ioredis';
import { type FastifyReply } from 'fastify';
import { authorizeRealtimeDelivery } from './realtime.authorization.js';
import { createLogger } from '@siteflow/observability/server';
import { ensureRedisConnected } from '../../../lib/redis/redis.js';

const logger = createLogger({ name: 'realtime-delivery' });

export const REALTIME_REDIS_CHANNEL = 'siteflow:realtime:events';

export interface SSEConnection {
  connectionId: string;
  userId: string;
  organizationId: string;
  reply: FastifyReply;
}

export type RealtimePubSubMessage =
  | {
      action: 'BROADCAST_TENANT';
      sourceInstanceId: string;
      organizationId: string;
      eventData: Record<string, unknown>;
    }
  | {
      action: 'BROADCAST_USER';
      sourceInstanceId: string;
      organizationId: string;
      userId: string;
      eventData: Record<string, unknown>;
    }
  | {
      action: 'CLOSE_USER';
      sourceInstanceId: string;
      userId: string;
    }
  | {
      action: 'CLOSE_ORG';
      sourceInstanceId: string;
      organizationId: string;
    };

export class RealtimeDeliveryManager {
  readonly instanceId: string = randomUUID();
  private connections: Map<string, SSEConnection> = new Map();
  private subscriber: Redis | null = null;

  addConnection(conn: SSEConnection): void {
    this.connections.set(conn.connectionId, conn);
    logger.info(
      { connectionId: conn.connectionId, organizationId: conn.organizationId, userId: conn.userId },
      'Realtime SSE connection established',
    );

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
    const closed = this.closeMatching((conn) => conn.userId === userId, 'user_revoked');
    void this.publishToRedis({
      action: 'CLOSE_USER',
      sourceInstanceId: this.instanceId,
      userId,
    });
    return closed;
  }

  closeConnectionsForOrganization(organizationId: string): number {
    const closed = this.closeMatching((conn) => conn.organizationId === organizationId, 'org_revoked');
    void this.publishToRedis({
      action: 'CLOSE_ORG',
      sourceInstanceId: this.instanceId,
      organizationId,
    });
    return closed;
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
    const sentCount = this.deliverLocalTenant(organizationId, eventData);
    void this.publishToRedis({
      action: 'BROADCAST_TENANT',
      sourceInstanceId: this.instanceId,
      organizationId,
      eventData,
    });
    return sentCount;
  }

  broadcastToUser(userId: string, organizationId: string, eventData: Record<string, unknown>): number {
    const sentCount = this.deliverLocalUser(userId, organizationId, eventData);
    void this.publishToRedis({
      action: 'BROADCAST_USER',
      sourceInstanceId: this.instanceId,
      organizationId,
      userId,
      eventData,
    });
    return sentCount;
  }

  private deliverLocalTenant(organizationId: string, eventData: Record<string, unknown>): number {
    let sentCount = 0;
    const payload = `data: ${JSON.stringify(eventData)}\n\n`;

    for (const conn of this.connections.values()) {
      if (authorizeRealtimeDelivery(conn.organizationId, organizationId)) {
        try {
          conn.reply.raw.write(payload);
          sentCount++;
        } catch (err: unknown) {
          logger.error(
            { connectionId: conn.connectionId, err: err instanceof Error ? err.message : String(err) },
            'Failed to write SSE payload',
          );
          this.removeConnection(conn.connectionId);
        }
      }
    }

    return sentCount;
  }

  private deliverLocalUser(userId: string, organizationId: string, eventData: Record<string, unknown>): number {
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

  async startSubscriber(): Promise<void> {
    if (this.subscriber) return;
    try {
      const redis = await ensureRedisConnected();
      this.subscriber = redis.duplicate();
      this.subscriber.on('message', (channel, message) => {
        if (channel !== REALTIME_REDIS_CHANNEL) return;
        this.handleRedisMessage(message);
      });
      await this.subscriber.subscribe(REALTIME_REDIS_CHANNEL);
      logger.info({ instanceId: this.instanceId }, 'Realtime delivery manager subscribed to Redis channel');
    } catch (err: unknown) {
      logger.warn({ err }, 'Failed to start Realtime Redis subscriber — operating in single-process mode');
    }
  }

  async stopSubscriber(): Promise<void> {
    if (!this.subscriber) return;
    try {
      await this.subscriber.unsubscribe(REALTIME_REDIS_CHANNEL);
      await this.subscriber.quit();
    } catch {
      // ignore on shutdown
    } finally {
      this.subscriber = null;
    }
  }

  private handleRedisMessage(raw: string): void {
    try {
      const msg = JSON.parse(raw) as RealtimePubSubMessage;
      if (msg.sourceInstanceId === this.instanceId) {
        return; // Ignore echo from this process instance
      }
      switch (msg.action) {
        case 'BROADCAST_TENANT':
          this.deliverLocalTenant(msg.organizationId, msg.eventData);
          break;
        case 'BROADCAST_USER':
          this.deliverLocalUser(msg.userId, msg.organizationId, msg.eventData);
          break;
        case 'CLOSE_USER':
          this.closeMatching((conn) => conn.userId === msg.userId, 'user_revoked');
          break;
        case 'CLOSE_ORG':
          this.closeMatching((conn) => conn.organizationId === msg.organizationId, 'org_revoked');
          break;
      }
    } catch (err) {
      logger.error({ err }, 'Failed to handle incoming Redis realtime message');
    }
  }

  private async publishToRedis(msg: RealtimePubSubMessage): Promise<void> {
    try {
      const redis = await ensureRedisConnected();
      await redis.publish(REALTIME_REDIS_CHANNEL, JSON.stringify(msg));
    } catch (err: unknown) {
      logger.warn(
        { err: err instanceof Error ? err.message : String(err), action: msg.action },
        'Failed to publish realtime event to Redis',
      );
    }
  }
}

export const realtimeDeliveryManager = new RealtimeDeliveryManager();
