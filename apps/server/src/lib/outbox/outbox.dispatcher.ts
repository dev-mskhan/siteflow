import type { DomainEventEnvelope } from '@siteflow/shared';

export type EventHandler = (event: DomainEventEnvelope) => Promise<void>;

export interface RegisteredHandler {
  handlerId: string;
  eventName: string;
  handler: EventHandler;
}

export class EventDispatcher {
  register(_eventName: string, _handlerId: string, _handler: EventHandler): never {
    throw new Error('EventDispatcher is unavailable; use the registered PgBoss queue consumers');
  }

  async dispatch(_event: DomainEventEnvelope): Promise<never> {
    throw new Error('EventDispatcher is unavailable; use the registered PgBoss queue consumers');
  }
}

export const eventDispatcher = new EventDispatcher();
