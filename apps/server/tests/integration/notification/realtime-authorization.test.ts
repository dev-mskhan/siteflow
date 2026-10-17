import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { authorizeRealtimeSubscription, authorizeRealtimeDelivery } from '../../../src/modules/notification/realtime/realtime.authorization.js';
import {
  realtimeDeliveryManager,
  RealtimeDeliveryManager,
} from '../../../src/modules/notification/realtime/realtime.delivery.js';
import { createTestApp } from '../../helpers/test-app.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../../helpers/fixtures.js';
import { PlatformLifecycleService } from '../../../src/modules/platform/platform-lifecycle.service.js';
import type { FastifyInstance } from 'fastify';

describe('F.6 Authorized Realtime Delivery & Multi-Tenant Boundary Integration', () => {
  const runId = Math.random().toString(36).substring(7);
  const org1Id = `org1_${runId}`;
  const org2Id = `org2_${runId}`;
  let app: FastifyInstance;
  let organizationId: string;
  let otherOrganizationId: string;
  let token: string;
  let serverUrl: string;
  const activeReaders: ReadableStreamDefaultReader<Uint8Array>[] = [];
  const lifecycleService = new PlatformLifecycleService();

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
    serverUrl = await app.listen({ host: '127.0.0.1', port: 0 });
  }, 30000);

  afterAll(async () => {
    await Promise.all(activeReaders.map((reader) => reader.cancel()));
    await app?.close();
  });

  async function openStream(organizationId: string, accessToken: string) {
    const response = await fetch(
      `${serverUrl}/api/v1/organizations/${organizationId}/notifications/stream`,
      { headers: { authorization: `Bearer ${accessToken}` } },
    );
    expect(response.status).toBe(200);
    expect(response.body).not.toBeNull();
    const reader = response.body!.getReader();
    activeReaders.push(reader);
    const connected = await reader.read();
    expect(new TextDecoder().decode(connected.value)).toContain('"type":"CONNECTED"');
    return reader;
  }

  async function readWithin(
    reader: ReadableStreamDefaultReader<Uint8Array>,
    timeoutMs = 1000,
  ) {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        reader.read(),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error('SSE stream did not close in time')), timeoutMs);
        }),
      ]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  async function expectRevokedAndClosed(reader: ReadableStreamDefaultReader<Uint8Array>) {
    const revoked = await readWithin(reader);
    expect(new TextDecoder().decode(revoked.value)).toContain('event: revoked');
    expect((await readWithin(reader)).done).toBe(true);
  }

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

  it('closes a removed member stream promptly and rejects reconnects', async () => {
    const owner = await createVerifiedUser();
    const { orgId, roleMap } = await createOrgWithAdmin(app, owner.token);
    const member = await createVerifiedUser();
    const membership = await addMemberDirectly(
      orgId,
      member.user.id,
      roleMap.get('Subcontractor')!,
    );
    const reader = await openStream(orgId, member.token);

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/members/${membership.id}`,
      headers: { authorization: `Bearer ${owner.token}` },
    });
    expect(removed.statusCode).toBe(200);
    await expectRevokedAndClosed(reader);

    const reconnect = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/notifications/stream`,
      headers: { authorization: `Bearer ${member.token}` },
    });
    expect([403, 404]).toContain(reconnect.statusCode);
  });

  it('closes every active member stream after organization suspension approval', async () => {
    const owner = await createVerifiedUser();
    const { orgId, roleMap } = await createOrgWithAdmin(app, owner.token);
    const member = await createVerifiedUser();
    await addMemberDirectly(orgId, member.user.id, roleMap.get('Subcontractor')!);
    const ownerReader = await openStream(orgId, owner.token);
    const memberReader = await openStream(orgId, member.token);

    const requester = await createVerifiedUser();
    const approver = await createVerifiedUser();
    const reason = {
      reasonCode: 'SECURITY_INCIDENT' as const,
      reasonNote: 'Realtime suspension integration test',
    };
    const { approvalId } = await lifecycleService.requestOrganizationSuspension(orgId, {
      actorUserId: requester.user.id,
      password: 'password123',
      ...reason,
    });
    await lifecycleService.approveOrganizationSuspension(approvalId, {
      actorUserId: approver.user.id,
      password: 'password123',
      ...reason,
    });

    await Promise.all([
      expectRevokedAndClosed(ownerReader),
      expectRevokedAndClosed(memberReader),
    ]);
    expect(realtimeDeliveryManager.getConnectionCount(orgId)).toBe(0);
  });

  it('closes an account stream after the account is suspended and sessions are revoked', async () => {
    const target = await createVerifiedUser();
    const { orgId } = await createOrgWithAdmin(app, target.token);
    const reader = await openStream(orgId, target.token);
    const operator = await createVerifiedUser();

    await lifecycleService.suspendAccount(target.user.id, {
      actorUserId: operator.user.id,
      password: 'password123',
      reasonCode: 'SECURITY_INCIDENT',
      reasonNote: 'Realtime account suspension integration test',
    });

    await expectRevokedAndClosed(reader);
    expect(realtimeDeliveryManager.getConnectionCount(orgId)).toBe(0);
  });
});
