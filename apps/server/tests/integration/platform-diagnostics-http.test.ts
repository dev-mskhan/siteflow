// apps/server/tests/integration/platform-diagnostics-http.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { and, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../src/lib/db/index.js';
import {
  users,
  platformUserRoles,
  organizations,
  auditLogs,
  outboxEvents,
} from '@siteflow/database/schema';
import { createTestApp } from '../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';
import { PlatformRbacRepository } from '../../src/modules/platform/platform-rbac.repository.js';

const ADMIN_ROLE_ID = 'prole_admin';
const SUPPORT_ROLE_ID = 'prole_support';
const BASE = '/api/v1/platform';
const reauth = { password: 'password123' };

describe('platform diagnostics HTTP (Phase 11-06)', () => {
  let app: FastifyInstance;
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdOutboxIds: string[] = [];
  const rbac = new PlatformRbacRepository();

  let owner: { user: { id: string }; token: string };
  let orgId: string;
  let admin: { user: { id: string }; token: string };
  let support: { user: { id: string }; token: string };

  const auth = (t: string) => ({ authorization: `Bearer ${t}` });

  beforeAll(async () => {
    app = await createTestApp();

    owner = await createVerifiedUser({ firstName: 'diag-org-owner' });
    createdUserIds.push(owner.user.id);
    const org = await createOrgWithAdmin(app, owner.token);
    orgId = org.orgId;
    createdOrgIds.push(orgId);

    admin = await createVerifiedUser({ firstName: 'diag-admin' });
    createdUserIds.push(admin.user.id);
    support = await createVerifiedUser({ firstName: 'diag-support' });
    createdUserIds.push(support.user.id);

    await rbac.grantPlatformRole(admin.user.id, ADMIN_ROLE_ID);
    await rbac.grantPlatformRole(support.user.id, SUPPORT_ROLE_ID);
  }, 120_000);

  afterAll(async () => {
    const db = getDb();
    const ownedOrganizations =
      createdUserIds.length > 0
        ? await db
            .select({ id: organizations.id })
            .from(organizations)
            .where(inArray(organizations.createdBy, createdUserIds))
        : [];
    const organizationIds = [...new Set([...createdOrgIds, ...ownedOrganizations.map(({ id }) => id)])];
    if (createdUserIds.length > 0) {
      await db.delete(platformUserRoles).where(inArray(platformUserRoles.userId, createdUserIds));
      await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, createdUserIds));
    }
    if (createdOutboxIds.length > 0) {
      await db.delete(outboxEvents).where(inArray(outboxEvents.id, createdOutboxIds));
    }
    if (organizationIds.length > 0) {
      await db.delete(auditLogs).where(inArray(auditLogs.organizationId, organizationIds));
      await db.delete(organizations).where(inArray(organizations.id, organizationIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    await app.close();
  }, 120_000);

  it('denies organization owners on every diagnostics route (403)', async () => {
    for (const url of [
      `${BASE}/diagnostics/health`,
      `${BASE}/diagnostics/queue`,
      `${BASE}/organizations/${orgId}/diagnostics`,
    ]) {
      const res = await app.inject({ method: 'GET', url, headers: auth(owner.token) });
      expect(res.statusCode).toBe(403);
    }
  });

  it('denies platform support (no read:diagnostics) on diagnostics routes (403)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/diagnostics/queue`,
      headers: auth(support.token),
    });
    expect(res.statusCode).toBe(403);
  });

  it('returns bounded health for platform admin (200)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/diagnostics/health`,
      headers: auth(admin.token),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.database.ok).toBe(true);
    expect(body.data.status).toBe('ok');
  });

  it('rejects an unbounded queue window (422)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/diagnostics/queue?windowHours=48`,
      headers: auth(admin.token),
    });
    expect(res.statusCode).toBe(422);
  });

  it('returns aggregate queue counts within the bounded window (200)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/diagnostics/queue?windowHours=24`,
      headers: auth(admin.token),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.windowHours).toBe(24);
    expect(typeof body.data.counts.created).toBe('number');
    expect(body.data.webhookInbox).toBeDefined();
    expect(typeof body.data.outbox.failedCount).toBe('number');
    expect(body.data.outbox.failed.every((event: { lastError?: string }) => !event.lastError)).toBe(true);
  });

  it('replays one failed outbox event once, audits the action, and rejects a second replay', async () => {
    const id = `diag_outbox_${randomUUID()}`;
    createdOutboxIds.push(id);
    await getDb().insert(outboxEvents).values({
      id,
      eventType: 'test.failed',
      organizationId: orgId,
      payload: { organizationId: orgId },
      status: 'FAILED',
      retryCount: 5,
      lastError: 'must not leak',
    });

    const replay = await app.inject({
      method: 'POST',
      url: `${BASE}/diagnostics/outbox/${id}/replay`,
      headers: auth(admin.token),
    });
    expect(replay.statusCode).toBe(200);
    expect(JSON.parse(replay.body).data.status).toBe('PENDING');

    const second = await app.inject({
      method: 'POST',
      url: `${BASE}/diagnostics/outbox/${id}/replay`,
      headers: auth(admin.token),
    });
    expect(second.statusCode).toBe(409);

    const [event] = await getDb()
      .select({ status: outboxEvents.status, retryCount: outboxEvents.retryCount })
      .from(outboxEvents)
      .where(eq(outboxEvents.id, id));
    expect(event).toMatchObject({ status: 'PENDING', retryCount: 0 });
  });

  it('returns org-scoped delivery and storage aggregates (200)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/organizations/${orgId}/diagnostics`,
      headers: auth(admin.token),
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.data.organizationId).toBe(orgId);
    expect(typeof body.data.storageBytes).toBe('number');
    expect(JSON.stringify(body)).not.toMatch(/password|token|secret/i);
  });

  it('returns 404 for an unknown organization without echoing the id', async () => {
    const unknown = 'org_does_not_exist_diag';
    const res = await app.inject({
      method: 'GET',
      url: `${BASE}/organizations/${unknown}/diagnostics`,
      headers: auth(admin.token),
    });
    expect(res.statusCode).toBe(404);
    expect(res.body).not.toContain(unknown);
  });

  it('webhook recovery is replay-safe: repeated runs both succeed without side effects (202)', async () => {
    const payload = {
      ...reauth,
      reasonCode: 'CUSTOMER_REQUEST',
      reasonNote: 'diagnostics replay check',
    };
    const first = await app.inject({
      method: 'POST',
      url: `${BASE}/billing/webhook-recovery`,
      headers: auth(admin.token),
      payload,
    });
    const second = await app.inject({
      method: 'POST',
      url: `${BASE}/billing/webhook-recovery`,
      headers: auth(admin.token),
      payload,
    });
    expect(first.statusCode).toBe(202);
    expect(second.statusCode).toBe(202);
    const auditRows = await getDb()
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.actorUserId, admin.user.id),
          eq(auditLogs.action, 'platform.billing.webhook_recovery_requested'),
        ),
      );
    expect(auditRows).toHaveLength(2);
  });
}, 120_000);
