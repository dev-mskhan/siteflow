// apps/server/tests/unit/outbox/outbox.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutboxService, writeOutboxEvent } from '../../../src/lib/outbox/outbox.service.js';

vi.mock('../../../src/lib/queue/queue.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/lib/queue/queue.js')>();
  return {
    ...actual,
    sendJob: vi.fn(),
  };
});

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
        token: 'tok1',
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
          organizationId: null,
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
      expect(sendJob).toHaveBeenCalledWith(
        'auth:send-email-verification',
        { ...mockEvents[0].payload, outboxEventId: 'evt_1' },
        {
          singletonKey: 'evt_1',
          singletonSeconds: 86400,
        },
      );
      expect(mockDbInstance.update).toHaveBeenCalled();
    });

    it('should process audit-only events without publishing jobs', async () => {
      const mockEvents = [
        {
          id: 'evt_suspension_requested',
          eventType: 'platform.organization.suspension_requested',
          payload: {
            organizationId: 'org_1',
            approvalId: 'approval_1',
            actorUserId: 'user_1',
            reasonCode: 'policy',
          },
          organizationId: 'org_1',
          status: 'PENDING',
          retryCount: 0,
        },
        {
          id: 'evt_recovery_requested',
          eventType: 'platform.billing.webhook_recovery_requested',
          payload: { actorUserId: 'user_1', reasonCode: 'recovery', processedCount: 1 },
          organizationId: null,
          status: 'PENDING',
          retryCount: 0,
        },
        {
          id: 'evt_support_grant_requested',
          eventType: 'platform.support_grant.requested',
          payload: { organizationId: 'org_1', grantId: 'grant_1' },
          organizationId: 'org_1',
          status: 'PENDING',
          retryCount: 0,
        },
        {
          id: 'evt_support_grant_approved',
          eventType: 'platform.support_grant.approved',
          payload: { organizationId: 'org_1', grantId: 'grant_2' },
          organizationId: 'org_1',
          status: 'PENDING',
          retryCount: 0,
        },
        {
          id: 'evt_support_grant_revoked',
          eventType: 'platform.support_grant.revoked',
          payload: { organizationId: 'org_1', grantId: 'grant_3' },
          organizationId: 'org_1',
          status: 'PENDING',
          retryCount: 0,
        },
        {
          id: 'evt_support_grant_used',
          eventType: 'platform.support_grant.used',
          payload: { organizationId: 'org_1', grantId: 'grant_4' },
          organizationId: 'org_1',
          status: 'PENDING',
          retryCount: 0,
        },
        {
          id: 'evt_support_grant_use_denied',
          eventType: 'platform.support_grant.use_denied',
          payload: { organizationId: 'org_1', grantId: 'grant_5' },
          organizationId: 'org_1',
          status: 'PENDING',
          retryCount: 0,
        },
      ];
      const set = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
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
        update: vi.fn().mockReturnValue({ set }),
      };

      const service = new OutboxService();
      vi.spyOn(service as any, 'db', 'get').mockReturnValue(mockDbInstance);

      const count = await service.publishPendingEvents();

      expect(count).toBe(7);
      expect(sendJob).not.toHaveBeenCalled();
      expect(set).toHaveBeenCalledTimes(7);
      expect(set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'PROCESSED', lastError: null }),
      );
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
