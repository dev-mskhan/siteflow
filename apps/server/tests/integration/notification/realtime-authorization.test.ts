import { describe, it, expect } from 'vitest';
import { authorizeRealtimeSubscription, authorizeRealtimeDelivery } from '../../../src/modules/notification/realtime/realtime.authorization.js';
import { RealtimeDeliveryManager } from '../../../src/modules/notification/realtime/realtime.delivery.js';

describe('F.6 Authorized Realtime Delivery & Multi-Tenant Boundary Integration', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const org2Id = `org2_${runId}`;

  it('authorizes subscription for same organization and forbids cross-tenant access', () => {
    const sameTenant = authorizeRealtimeSubscription(org1Id, org1Id);
    expect(sameTenant.authorized).toBe(true);

    const crossTenant = authorizeRealtimeSubscription(org1Id, org2Id);
    expect(crossTenant.authorized).toBe(false);
    expect(crossTenant.reason).toContain('cross-tenant');
  });

  it('verifies tenant delivery authorization logic', () => {
    expect(authorizeRealtimeDelivery(org1Id, org1Id)).toBe(true);
    expect(authorizeRealtimeDelivery(org1Id, org2Id)).toBe(false);
    expect(authorizeRealtimeDelivery('', org1Id)).toBe(false);
  });

  it('isolates realtime broadcast events to matching tenant connections only', () => {
    const manager = new RealtimeDeliveryManager();
    const writtenEvents1: string[] = [];
    const writtenEvents2: string[] = [];

    const mockReply1: any = {
      raw: {
        write: (msg: string) => writtenEvents1.push(msg),
        on: () => {},
      },
    };

    const mockReply2: any = {
      raw: {
        write: (msg: string) => writtenEvents2.push(msg),
        on: () => {},
      },
    };

    manager.addConnection({
      connectionId: `conn1_${runId}`,
      userId: `usr1_${runId}`,
      organizationId: org1Id,
      reply: mockReply1,
    });

    manager.addConnection({
      connectionId: `conn2_${runId}`,
      userId: `usr2_${runId}`,
      organizationId: org2Id,
      reply: mockReply2,
    });

    const sent = manager.broadcastToTenant(org1Id, { eventType: 'TaskCompleted', taskId: 't1' });

    expect(sent).toBe(1);
    expect(writtenEvents1.length).toBe(1);
    expect(writtenEvents1[0]).toContain('TaskCompleted');
    expect(writtenEvents2.length).toBe(0); // Org 2 connection received 0 events
  });
});
