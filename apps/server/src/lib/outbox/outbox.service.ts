// apps/server/src/lib/outbox/outbox.service.ts
import { eq, and, or, lt } from 'drizzle-orm';
import { getDb } from '../db/index.js';
import { outboxEvents, type OutboxEvent } from '@siteflow/database/schema';
import { sendJob } from '../queue/queue.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'outbox-service' });

export const MAX_OUTBOX_RETRIES = 5;

/**
 * Writes an outbox event within an existing database transaction (`tx`).
 * This guarantees atomic creation of domain records and outbox events.
 */
export async function writeOutboxEvent(
  tx: any,
  eventType: string,
  payload: Record<string, any>,
): Promise<OutboxEvent> {
  logger.debug({ eventType }, 'Writing outbox event to transaction');
  const result = await tx
    .insert(outboxEvents)
    .values({
      eventType,
      payload,
      status: 'PENDING',
      retryCount: 0,
    })
    .returning();
  return result[0];
}

export class OutboxService {
  private get db() {
    return getDb();
  }

  /**
   * Fetches and dispatches pending or failed retryable outbox events to the queue.
   */
  async publishPendingEvents(batchSize = 50): Promise<number> {
    const pendingEvents = await this.db
      .select()
      .from(outboxEvents)
      .where(
        or(
          eq(outboxEvents.status, 'PENDING'),
          and(
            eq(outboxEvents.status, 'FAILED'),
            lt(outboxEvents.retryCount, MAX_OUTBOX_RETRIES),
          ),
        ),
      )
      .limit(batchSize);

    if (pendingEvents.length === 0) {
      return 0;
    }

    logger.info({ count: pendingEvents.length }, 'Processing pending outbox events');
    let processedCount = 0;

    for (const event of pendingEvents) {
      try {
        // Dispatch outbox event payload to queue worker
        await sendJob(event.eventType as any, event.payload as any);

        // Mark as PROCESSED on success
        await this.db
          .update(outboxEvents)
          .set({
            status: 'PROCESSED',
            processedAt: new Date(),
            updatedAt: new Date(),
            lastError: null,
          })
          .where(eq(outboxEvents.id, event.id));

        processedCount++;
        logger.debug({ eventId: event.id, eventType: event.eventType }, 'Outbox event dispatched successfully');
      } catch (err: any) {
        const nextRetryCount = event.retryCount + 1;
        const nextStatus = nextRetryCount >= MAX_OUTBOX_RETRIES ? 'FAILED' : 'PENDING';
        const errorMessage = err?.message || String(err);

        logger.error(
          { eventId: event.id, eventType: event.eventType, retryCount: nextRetryCount, err },
          'Failed to dispatch outbox event to queue',
        );

        await this.db
          .update(outboxEvents)
          .set({
            status: nextStatus as any,
            retryCount: nextRetryCount,
            lastError: errorMessage,
            updatedAt: new Date(),
          })
          .where(eq(outboxEvents.id, event.id));
      }
    }

    return processedCount;
  }

  /**
   * Starts a background poller interval to periodically sweep pending outbox events.
   */
  startPoller(intervalMs = 10000): NodeJS.Timeout {
    logger.info({ intervalMs }, 'Starting outbox poller loop');
    return setInterval(async () => {
      try {
        await this.publishPendingEvents();
      } catch (err) {
        logger.error({ err }, 'Unhandled exception in outbox poller sweep');
      }
    }, intervalMs);
  }
}

export const outboxService = new OutboxService();
