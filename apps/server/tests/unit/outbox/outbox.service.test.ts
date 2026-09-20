// apps/server/tests/unit/outbox/outbox.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxService, writeOutboxEvent } from '../../../src/lib/outbox/outbox.service.js';

vi.mock('../../../src/lib/queue/queue.js', () => ({
  sendJob: vi.fn(),
}));

import { sendJob } from '../../../src/lib/queue/queue.js';

describe('OutboxService (Unit)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('writeOutboxEvent()', () => {
    it('should insert outbox event and emit NOTIFY signal in transaction client', async () => {
      const mockTx = {
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([
              {
                id: 'evt_123',
                eventType: 'auth:send-email-verification',
                payload: { userId: 'usr_1', email: 'test@example.com' },
                status: 'PENDING',
              },
            ]),
          }),
        }),
        execute: vi.fn().mockResolvedValue([]),
      };

      const result = await writeOutboxEvent(mockTx, 'auth:send-email-verification', {
        userId: 'usr_1',
        email: 'test@example.com',
      });

      expect(result.id).toBe('evt_123');
      expect(mockTx.insert).toHaveBeenCalled();
      expect(mockTx.execute).toHaveBeenCalled();
    });
  });

  describe('publishPendingEvents()', () => {
    it('should dispatch pending events to queue using SKIP LOCKED batching and mark them PROCESSED', async () => {
      const mockEvents = [
        {
          id: 'evt_1',
          eventType: 'auth:send-email-verification',
          payload: { userId: 'usr_1', email: 'user1@example.com', token: 'tok1' },
          status: 'PENDING',
          retryCount: 0,
        },
      ];

      const mockDbInstance = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockReturnValue({
                limit: vi.fn().mockReturnValue({
                  for: vi.fn().mockResolvedValue(mockEvents),
                }),
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ id: 'evt_1' }]),
          }),
        }),
      };

      (sendJob as any).mockResolvedValue('job_id_99');

      const service = new OutboxService();
      vi.spyOn(service as any, 'db', 'get').mockReturnValue(mockDbInstance);

      const count = await service.publishPendingEvents();

      expect(count).toBe(1);
      expect(sendJob).toHaveBeenCalledWith('auth:send-email-verification', mockEvents[0].payload);
      expect(mockDbInstance.update).toHaveBeenCalled();
    });
  });

  describe('startPoller() and stopPoller()', () => {
    it('should start and stop the poller loop cleanly', async () => {
      vi.useFakeTimers();
      const service = new OutboxService();
      vi.spyOn(service, 'publishPendingEvents').mockResolvedValue(0);
      vi.spyOn(service, 'startListener').mockResolvedValue();

      service.startPoller({ minIntervalMs: 1000, maxIntervalMs: 5000, backoffMultiplier: 2.0, enableListener: false });
      expect((service as any).isPolling).toBe(true);

      // Fast-forward initial async poll
      await vi.advanceTimersByTimeAsync(10);
      expect(service.publishPendingEvents).toHaveBeenCalledTimes(1);

      await service.stopPoller();
      expect((service as any).isPolling).toBe(false);
      vi.useRealTimers();
    });
  });
});
