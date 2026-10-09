import { createLogger } from '@siteflow/observability/server';
import { type DomainEventEnvelope } from '@siteflow/shared';

const logger = createLogger({ name: 'event-dispatcher' });

export type EventHandler = (event: DomainEventEnvelope) => Promise<void>;

export interface RegisteredHandler {
  handlerId: string;
  eventName: string;
  handler: EventHandler;
}

export class EventDispatcher {
  private handlers: Map<string, RegisteredHandler[]> = new Map();
  private processedExecutions: Set<string> = new Set();

  /**
   * Registers an independent consumer handler for a domain event.
   */
  register(eventName: string, handlerId: string, handler: EventHandler): void {
    const existing = this.handlers.get(eventName) ?? [];
    if (existing.some((h) => h.handlerId === handlerId)) {
      logger.warn({ eventName, handlerId }, 'Handler already registered; skipping duplicate registration');
      return;
    }
    existing.push({ handlerId, eventName, handler });
    this.handlers.set(eventName, existing);
    logger.info({ eventName, handlerId }, 'Registered domain event handler');
  }

  /**
   * Dispatches a versioned event to all registered consumer handlers with failure isolation & idempotency.
   */
  async dispatch(event: DomainEventEnvelope): Promise<{ succeeded: string[]; failed: string[] }> {
    if (!event.organizationId) {
      throw new Error('Cannot dispatch event without organizationId tenant context');
    }

    const registered = this.handlers.get(event.name) ?? [];
    const succeeded: string[] = [];
    const failed: string[] = [];

    for (const { handlerId, handler } of registered) {
      const executionKey = `${handlerId}:${event.id}`;
      if (this.processedExecutions.has(executionKey)) {
        logger.debug({ handlerId, eventId: event.id, eventName: event.name }, 'Skipping replayed event handler execution (idempotent)');
        succeeded.push(handlerId);
        continue;
      }

      try {
        logger.debug(
          { handlerId, eventId: event.id, eventName: event.name, organizationId: event.organizationId, correlationId: event.correlationId },
          'Executing event handler',
        );
        await handler(event);
        this.processedExecutions.add(executionKey);
        succeeded.push(handlerId);
      } catch (err: any) {
        logger.error(
          { handlerId, eventId: event.id, eventName: event.name, organizationId: event.organizationId, err: err?.message || err },
          'Event handler execution failed (isolated)',
        );
        failed.push(handlerId);
      }
    }

    return { succeeded, failed };
  }

  /**
   * Clears in-memory processed execution set (for testing).
   */
  clearProcessedHistory(): void {
    this.processedExecutions.clear();
  }
}

export const eventDispatcher = new EventDispatcher();
