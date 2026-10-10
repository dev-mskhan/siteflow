import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { authorizeRealtimeSubscription, authorizeRealtimeDelivery } from '../../../src/modules/notification/realtime/realtime.authorization.js';
import { RealtimeDeliveryManager } from '../../../src/modules/notification/realtime/realtime.delivery.js';
import { createTestApp } from '../../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../../helpers/fixtures.js';
import type { FastifyInstance } from 'fastify';

describe('F.6 Authorized Realtime Delivery & Multi-Tenant Boundary Integration', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const org2Id = `org2_${runId}`;
  let app: FastifyInstance;
  let organizationId: string;
  let otherOrganizationId: string;
  let token: string;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({
      email: `realtime-owner-${runId}@test.dev`,
    });
    token = owner.token;
    organizationId = (await createOrgWithAdmin(
      app,
      token,
      `Realtime Org ${runId}`,
    )).orgId;
    const otherOwner = await createVerifiedUser({
      email: `realtime-other-${runId}@test.dev`,
    });
    otherOrganizationId = (await createOrgWithAdmin(
      app,
      otherOwner.token,
      `Realtime Other Org ${runId}`,
    )).orgId;
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

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

  it('rejects SSE requests without an authenticated server-side identity', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/notifications/stream`,
    });
    expect(response.statusCode).toBe(401);
  });

  it('rejects authenticated callers claiming another organization in the URL', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${otherOrganizationId}/notifications/stream`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect([403, 404]).toContain(response.statusCode);
  });

  it('does not use a wildcard origin for SSE responses', async () => {
    const response = await app.inject({
      method: 'OPTIONS',
      url: `/api/v1/organizations/${organizationId}/notifications/stream`,
      headers: {
        origin: 'https://untrusted.example',
        'access-control-request-method': 'GET',
      },
    });
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
    expect(response.statusCode).toBe(204);
  });
});
