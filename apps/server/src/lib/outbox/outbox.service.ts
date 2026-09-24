// apps/server/src/lib/outbox/outbox.service.ts
import { eq, and, or, lt, sql } from 'drizzle-orm';
import pg from 'pg';
import { getDb } from '../db/index.js';
import { generateId } from '../id.js';
import { outboxEvents, type OutboxEvent } from '@siteflow/database/schema';
import { sendJob } from '../queue/queue.js';
import { serverEnv } from '../../config/env.js';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'outbox-service' });

export const MAX_OUTBOX_RETRIES = 5;

/**
 * Writes an outbox event within an existing database transaction (`tx`).
 * This guarantees atomic creation of domain records and outbox events,
 * and emits a PostgreSQL NOTIFY signal upon transaction commit.
 */
export async function writeOutboxEvent(
  tx: any,
  eventType: string,
  payload: Record<string, any>,
  organizationId?: string,
): Promise<OutboxEvent> {
  const orgId = organizationId ?? (payload['organizationId'] as string | undefined) ?? null;
  logger.debug({ eventType, organizationId: orgId }, 'Writing outbox event to transaction');
  const result = await tx
    .insert(outboxEvents)
    .values({
      id: generateId(),
      eventType,
      payload,
      organizationId: orgId,
      status: 'PENDING',
      retryCount: 0,
    })
    .returning();

  if (typeof tx.execute === 'function') {
    try {
      await tx.execute(sql`NOTIFY siteflow_outbox`);
    } catch (err) {
      logger.warn({ err }, 'Failed to emit NOTIFY siteflow_outbox signal in transaction');
    }
  }

  return result[0];
}

export interface OutboxPollerOptions {
  minIntervalMs?: number;
  maxIntervalMs?: number;
  backoffMultiplier?: number;
  connectionString?: string;
  enableListener?: boolean;
}

export class OutboxService {
  private pollerTimeout: NodeJS.Timeout | null = null;
  private isPolling = false;
  private listenerClient: pg.Client | null = null;

  private get db() {
    return getDb();
  }

  /**
   * Fetches and dispatches pending or failed retryable outbox events to the queue
   * using FOR UPDATE SKIP LOCKED for concurrent worker safety and FIFO processing.
   */
  async publishPendingEvents(batchSize = 100): Promise<number> {
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
      .orderBy(outboxEvents.createdAt)
      .limit(batchSize)
      .for('update', { skipLocked: true });

    if (pendingEvents.length === 0) {
      return 0;
    }

    logger.info({ count: pendingEvents.length }, 'Processing pending outbox events batch');
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
   * Initializes a dedicated PostgreSQL LISTEN subscriber connection to wake up immediately
   * whenever an outbox event is committed to PostgreSQL.
   */
  async startListener(connectionString?: string): Promise<void> {
    const connStr = connectionString ?? serverEnv.DATABASE_URL;
    if (!connStr || this.listenerClient) return;

    try {
      const client = new pg.Client({ connectionString: connStr });
      await client.connect();
      await client.query('LISTEN siteflow_outbox');
      client.on('notification', async (msg) => {
        if (msg.channel === 'siteflow_outbox') {
          logger.debug('Received siteflow_outbox NOTIFY signal, running immediate outbox sweep');
          await this.publishPendingEvents();
        }
      });
      client.on('error', (err) => {
        logger.error({ err }, 'Outbox LISTEN connection error');
        this.listenerClient = null;
      });
      this.listenerClient = client;
      logger.info('Outbox LISTEN listener active on channel "siteflow_outbox"');
    } catch (err) {
      logger.error({ err }, 'Failed to initialize outbox LISTEN connection; fallback poller remains active');
    }
  }

  /**
   * Starts LISTEN/NOTIFY subscriber and adaptive fallback background poller loop.
   * LISTEN/NOTIFY acts as primary real-time trigger; polling acts as safety net fallback (30-60s).
   */
  startPoller(options?: number | OutboxPollerOptions): void {
    if (this.isPolling) {
      logger.warn('Outbox poller is already running');
      return;
    }

    const opts = typeof options === 'number' ? { minIntervalMs: options } : options;
    const config: Required<Omit<OutboxPollerOptions, 'connectionString'>> = {
      minIntervalMs: opts?.minIntervalMs ?? 30000,
      maxIntervalMs: opts?.maxIntervalMs ?? 60000,
      backoffMultiplier: opts?.backoffMultiplier ?? 1.5,
      enableListener: opts?.enableListener ?? true,
    };

    this.isPolling = true;
    let currentInterval = config.minIntervalMs;

    if (config.enableListener) {
      this.startListener(opts?.connectionString).catch((err) => {
        logger.error({ err }, 'Error starting outbox listener');
      });
    }

    logger.info(
      { minIntervalMs: config.minIntervalMs, maxIntervalMs: config.maxIntervalMs, enableListener: config.enableListener },
      'Outbox processor ready (LISTEN/NOTIFY active with fallback poller)',
    );

    const poll = async () => {
      if (!this.isPolling) return;

      try {
        const count = await this.publishPendingEvents();

        if (count > 0) {
          currentInterval = config.minIntervalMs;
        } else {
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
   * Stops the background poller loop and LISTEN connection cleanly.
   */
  async stopPoller(): Promise<void> {
    if (this.listenerClient) {
      try {
        await this.listenerClient.end();
      } catch {}
      this.listenerClient = null;
    }

    if (!this.isPolling) return;
    this.isPolling = false;
    if (this.pollerTimeout) {
      clearTimeout(this.pollerTimeout);
      this.pollerTimeout = null;
    }
    logger.info('Outbox poller and LISTEN subscriber stopped cleanly');
  }
}

export const outboxService = new OutboxService();
