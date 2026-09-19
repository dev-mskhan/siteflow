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

export interface OutboxPollerOptions {
  minIntervalMs?: number;
  maxIntervalMs?: number;
  backoffMultiplier?: number;
}

export class OutboxService {
  private pollerTimeout: NodeJS.Timeout | null = null;
  private isPolling = false;

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
        await sendJob(event.eventType, event.payload as Record<string, unknown>);

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
   * Starts an adaptive background poller loop to sweep pending outbox events.
   * Dynamically adjusts polling interval between minIntervalMs and maxIntervalMs
   * based on table activity to prevent hammering PostgreSQL when idle.
   */
  startPoller(options?: number | OutboxPollerOptions): void {
    if (this.isPolling) {
      logger.warn('Outbox poller is already running');
      return;
    }

    const config: Required<OutboxPollerOptions> = {
      minIntervalMs: typeof options === 'number' ? options : options?.minIntervalMs ?? 1000,
      maxIntervalMs: typeof options === 'number' ? Math.max(options, 10000) : options?.maxIntervalMs ?? 10000,
      backoffMultiplier: typeof options === 'number' ? 1.5 : options?.backoffMultiplier ?? 1.5,
    };

    this.isPolling = true;
    let currentInterval = config.minIntervalMs;

    logger.info(
      { minIntervalMs: config.minIntervalMs, maxIntervalMs: config.maxIntervalMs },
      'Outbox processor ready (adaptive poller started)',
    );

    const poll = async () => {
      if (!this.isPolling) return;

      try {
        const count = await this.publishPendingEvents();

        if (count > 0) {
          // Reset to min interval immediately when work was done
          currentInterval = config.minIntervalMs;
        } else {
          // Exponentially back off up to maxIntervalMs when idle
          currentInterval = Math.min(Math.round(currentInterval * config.backoffMultiplier), config.maxIntervalMs);
        }
      } catch (err) {
        logger.error({ err }, 'Unhandled exception in outbox poller sweep');
        currentInterval = Math.min(Math.round(currentInterval * config.backoffMultiplier), config.maxIntervalMs);
      }

      if (this.isPolling) {
        this.pollerTimeout = setTimeout(poll, currentInterval);
      }
    };

    // Schedule first poll asynchronously
    this.pollerTimeout = setTimeout(poll, 0);
  }

  /**
   * Stops the background poller loop cleanly.
   */
  stopPoller(): void {
    if (!this.isPolling) return;
    this.isPolling = false;
    if (this.pollerTimeout) {
      clearTimeout(this.pollerTimeout);
      this.pollerTimeout = null;
    }
    logger.info('Outbox poller loop stopped');
  }
}

export const outboxService = new OutboxService();
