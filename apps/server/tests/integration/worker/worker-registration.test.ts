import { describe, expect, it, vi } from 'vitest';
import type PgBoss from 'pg-boss';
import { registerWorkers } from '../../../src/worker-registration.js';

describe('worker registration availability boundary', () => {
  it('registers supported consumers without advertising dormant reminder or notification delivery', async () => {
    const work = vi.fn(async () => undefined);
    const schedule = vi.fn(async () => undefined);
    const boss = { work, schedule } as unknown as PgBoss;

    await registerWorkers(boss);

    const registeredQueues = work.mock.calls.map(([queue]) => queue);
    const scheduledQueues = schedule.mock.calls.map(([queue]) => queue);

    expect(registeredQueues).toEqual(
      expect.arrayContaining([
        'auth:send-email-verification',
        'auth:send-password-reset',
        'org:send-invitation-email',
        'reporting:export:generate',
      ]),
    );
    expect(scheduledQueues).toEqual(
      expect.arrayContaining([
        'auth:cleanup-expired-sessions',
        'org:expire-invitations',
        'reporting:export:cleanup',
      ]),
    );

    const dormantDeliveryNames = /operations-reminder|notification:.*email|notification:.*preference/i;
    expect(registeredQueues.filter((queue) => dormantDeliveryNames.test(queue))).toEqual([]);
    expect(scheduledQueues.filter((queue) => dormantDeliveryNames.test(queue))).toEqual([]);
  });
});
