import { describe, expect, it } from 'vitest';
import { EventDispatcher } from '../../../src/lib/outbox/outbox.dispatcher.js';

describe('F.3 generic dispatcher availability fence', () => {
  it('rejects registration instead of claiming in-memory idempotent delivery', () => {
    const dispatcher = new EventDispatcher();
    expect(() => dispatcher.register('TaskCompleted', 'handler', async () => {})).toThrow(
      /unavailable/i,
    );
  });

  it('rejects dispatch until a durable consumer contract is registered', async () => {
    const dispatcher = new EventDispatcher();
    await expect(dispatcher.dispatch({} as never)).rejects.toThrow(/unavailable/i);
  });
});
