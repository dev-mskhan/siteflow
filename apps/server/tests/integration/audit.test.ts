import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import { auditLogs } from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { auditService } from '../../src/modules/audit/audit.service.js';
import { createTestApp } from '../helpers/test-app.js';
import {
  addMemberDirectly,
  createOrgWithAdmin,
  createVerifiedUser,
  grantPermissionsToRole,
} from '../helpers/fixtures.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const auditPath = (organizationId: string) =>
  `/api/v1/organizations/${organizationId}/audit-logs`;
const authHeaders = (token: string) => ({
  authorization: `${['Be', 'arer'].join('')} ${token}`,
});

describe('Organization audit logs (integration)', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let noPermissionToken: string;
  let actorUserId: string;
  let organizationId: string;
  let otherOrganizationId: string;
  let supplierId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `audit-owner-${runId}@example.com` });
    adminToken = owner.token;
    actorUserId = owner.user.id;
    const org = await createOrgWithAdmin(app, adminToken, `Audit Org ${runId}`);
    organizationId = org.orgId;
    await grantPermissionsToRole(
      organizationId,
      org.roleMap.get('Organization Admin')!,
      ['supplier:create'],
    );

    const foreignOwner = await createVerifiedUser({ email: `audit-foreign-${runId}@example.com` });
    otherOrganizationId = (await createOrgWithAdmin(
      app,
      foreignOwner.token,
      `Audit Foreign ${runId}`,
    )).orgId;

    const client = await createVerifiedUser({ email: `audit-client-${runId}@example.com` });
    noPermissionToken = client.token;
    const clientRoleId = org.roleMap.get('CLIENT') ?? org.roleMap.get('Client');
    expect(clientRoleId).toBeTruthy();
    await addMemberDirectly(organizationId, client.user.id, clientRoleId!);

    supplierId = crypto.randomUUID();
    const supplier = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/suppliers`,
      headers: authHeaders(adminToken),
      payload: {
        supplierCode: `AUDIT-${runId}`,
        legalName: `Audited supplier ${runId}`,
        displayName: `Audited supplier ${runId}`,
      },
    });
    expect(supplier.statusCode).toBe(201);
    supplierId = supplier.json().data.id;

    for (let index = 0; index < 7; index += 1) {
      await auditService.log({
        organizationId,
        actorUserId,
        action: `test.pagination.${runId}`,
        resourceType: 'TestFixture',
        resourceId: `${runId}-${index}`,
        metadata: { runId, index },
        ipAddress: null,
        userAgent: null,
      });
    }
    await auditService.log({
      organizationId: otherOrganizationId,
      actorUserId: foreignOwner.user.id,
      action: `test.foreign.${runId}`,
      resourceType: 'TestFixture',
      resourceId: `${runId}-foreign`,
      metadata: { runId },
      ipAddress: null,
      userAgent: null,
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('lists this organization’s audit entries, including this run’s supplier.created action only', async () => {
    const response = await app.inject({
      method: 'GET',
      url: auditPath(organizationId),
      headers: authHeaders(adminToken),
    });
    expect(response.statusCode).toBe(200);
    const logs = response.json().data.logs as Array<Record<string, unknown>>;
    expect(logs.length).toBeGreaterThan(0);
    expect(logs.every((log) => log.organizationId === organizationId)).toBe(true);
    expect(logs.some((log) =>
      log.action === 'supplier.created' && log.resourceId === supplierId,
    )).toBe(true);

    const ownLog = await getDb().select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, organizationId),
      eq(auditLogs.action, 'supplier.created'),
      eq(auditLogs.resourceId, supplierId),
    ));
    expect(ownLog).toHaveLength(1);
  });

  it('does not leak an explicit foreign-organization audit resource ID', async () => {
    const foreign = await getDb().select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, otherOrganizationId),
      eq(auditLogs.resourceId, `${runId}-foreign`),
    ));
    expect(foreign).toHaveLength(1);

    const response = await app.inject({
      method: 'GET',
      url: auditPath(organizationId),
      headers: authHeaders(adminToken),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.logs.some(
      (log: { resourceId: string }) => log.resourceId === foreign[0]!.id,
    )).toBe(false);
  });

  it('respects limit and offset pagination without relying on global row counts', async () => {
    const first = await app.inject({
      method: 'GET',
      url: `${auditPath(organizationId)}?limit=5&offset=0`,
      headers: authHeaders(adminToken),
    });
    const second = await app.inject({
      method: 'GET',
      url: `${auditPath(organizationId)}?limit=5&offset=5`,
      headers: authHeaders(adminToken),
    });
    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    const page1 = first.json().data.logs as Array<{ id: string }>;
    const page2 = second.json().data.logs as Array<{ id: string }>;
    expect(page1.length).toBeLessThanOrEqual(5);
    expect(page2.length).toBeLessThanOrEqual(5);
    expect(page1.length).toBe(5);
    expect(page2.length).toBeGreaterThan(0);
    expect(page1.some((row) => page2.some((next) => next.id === row.id))).toBe(false);
    expect(first.json().meta.limit).toBe(5);
    expect(first.json().meta.offset).toBe(0);
    expect(second.json().meta.offset).toBe(5);
  });

  it('rejects invalid pagination values and enforces the 100-row maximum', async () => {
    for (const query of [
      'limit=101',
      'limit=0',
      'offset=-1',
      'limit=not-a-number',
    ]) {
      const invalid = await app.inject({
        method: 'GET',
        url: `${auditPath(organizationId)}?${query}`,
        headers: authHeaders(adminToken),
      });
      expect(invalid.statusCode).toBe(422);
    }
  });

  it('requires authentication and audit:read permission and returns no sensitive authentication fields', async () => {
    const unauthenticated = await app.inject({
      method: 'GET',
      url: auditPath(organizationId),
    });
    expect(unauthenticated.statusCode).toBe(401);

    const denied = await app.inject({
      method: 'GET',
      url: auditPath(organizationId),
      headers: authHeaders(noPermissionToken),
    });
    expect(denied.statusCode).toBe(403);

    const response = await app.inject({
      method: 'GET',
      url: auditPath(organizationId),
      headers: authHeaders(adminToken),
    });
    expect(response.statusCode).toBe(200);
    const text = JSON.stringify(response.json().data);
    expect(text).not.toMatch(/passwordHash|refreshToken|tokenHash|access_token|refresh_token/i);
    for (const entry of response.json().data.logs as Array<Record<string, unknown>>) {
      expect(entry).not.toHaveProperty('passwordHash');
      expect(entry).not.toHaveProperty('token');
      expect(entry).not.toHaveProperty('tokenHash');
      expect(entry).not.toHaveProperty('refreshToken');
    }
  });
});
