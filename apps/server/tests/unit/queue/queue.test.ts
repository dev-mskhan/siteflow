import { describe, expect, it } from 'vitest';
import { getDeadLetterQueueOptions, getQueueOptions, QUEUE_RETRY_SETTINGS } from '../../../src/lib/queue/queue.js';

describe('queue retry defaults', () => {
  it('applies bounded retry, backoff, expiration, and a queue-specific DLQ', () => {
    expect(getQueueOptions('billing:stripe-webhook-recovery')).toEqual({
      name: 'billing:stripe-webhook-recovery',
      ...QUEUE_RETRY_SETTINGS,
      deadLetter: 'billing:stripe-webhook-recovery.dlq',
    });
  });

  it('keeps dead-letter queues from recursively dead-lettering', () => {
    expect(getDeadLetterQueueOptions('billing:stripe-webhook-recovery')).toEqual({
      name: 'billing:stripe-webhook-recovery.dlq',
      retryLimit: 0,
      expireInSeconds: QUEUE_RETRY_SETTINGS.expireInSeconds,
    });
  });
});
