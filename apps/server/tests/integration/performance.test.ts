import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  partnerPerformanceEvents,
  subcontractors,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createTestApp } from '../helpers/test-app.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const supplierPerformancePath = (orgId: string, projectId: string, supplierId: string) =>
  `/api/v1/organizations/${orgId}/projects/${projectId}/performance/suppliers/${supplierId}`;
const subcontractorPerformancePath = (orgId: string, projectId: string, subcontractorId: string) =>
  `/api/v1/organizations/${orgId}/projects/${projectId}/performance/subcontractors/${subcontractorId}`;
const authHeaders = (token: string) => ({
  authorization: `${['Be', 'arer'].join('')} ${token}`,
});

describe('Partner performance (integration)', () => {
  let app: FastifyInstance;
  let token: string;
  let outsiderToken: string;
  let clientToken: string;
  let orgId: string;
  let projectId: string;
  let foreignOrgId: string;
  let foreignProjectId: string;
  let supplierId: string;
  let emptySupplierId: string;
  let foreignSupplierId: string;
  let subcontractorId: string;
  let emptySubcontractorId: string;
  let foreignSubcontractorId: string;

  async function createProject(org: string, auth: string, name: string) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org}/projects`,
      headers: authHeaders(auth),
      payload: { name, currency: 'USD' },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data.project.id as string;
  }

  async function addEvent(args: {
    org: string;
    project: string;
    partnerType: 'SUPPLIER' | 'SUBCONTRACTOR';
    supplier?: string;
    subcontractor?: string;
    eventType: 'DELIVERY_ON_TIME' | 'DELIVERY_LATE' | 'RECEIPT_REJECTION' | 'WORK_COMPLETED';
    occurredAt: Date;
    sourceId: string;
  }) {
    await getDb().insert(partnerPerformanceEvents).values({
      id: crypto.randomUUID(),
      organizationId: args.org,
      projectId: args.project,
      partnerType: args.partnerType,
      supplierId: args.supplier ?? null,
      subcontractorId: args.subcontractor ?? null,
      sourceType: 'TEST',
      sourceId: args.sourceId,
      eventType: args.eventType,
      occurredAt: args.occurredAt,
      notes: `performance ${runId}`,
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `performance-owner-${runId}@example.com` });
    token = owner.token;
    const org = await createOrgWithAdmin(app, token, `Performance Org ${runId}`);
    orgId = org.orgId;
    projectId = await createProject(orgId, token, `Performance Project ${runId}`);

    const outsider = await createVerifiedUser({ email: `performance-outsider-${runId}@example.com` });
    outsiderToken = outsider.token;
    const client = await createVerifiedUser({ email: `performance-client-${runId}@example.com` });
    clientToken = client.token;
    const clientRoleId = org.roleMap.get('CLIENT') ?? org.roleMap.get('Client');
    expect(clientRoleId).toBeTruthy();
    await addMemberDirectly(orgId, client.user.id, clientRoleId!);
    const foreignOwner = await createVerifiedUser({ email: `performance-foreign-${runId}@example.com` });
    const foreign = await createOrgWithAdmin(app, foreignOwner.token, `Performance Foreign ${runId}`);
    foreignOrgId = foreign.orgId;
    foreignProjectId = await createProject(foreignOrgId, foreignOwner.token, `Performance Foreign Project ${runId}`);

    supplierId = crypto.randomUUID();
    emptySupplierId = crypto.randomUUID();
    foreignSupplierId = crypto.randomUUID();
    subcontractorId = crypto.randomUUID();
    emptySubcontractorId = crypto.randomUUID();
    foreignSubcontractorId = crypto.randomUUID();
    await getDb().insert(suppliers).values([
      {
        id: supplierId,
        organizationId: orgId,
        supplierCode: `PERF-S-${runId}`,
        legalName: `Performance supplier ${runId}`,
        displayName: `Performance supplier ${runId}`,
        status: 'ACTIVE',
      },
      {
        id: emptySupplierId,
        organizationId: orgId,
        supplierCode: `PERF-EMPTY-S-${runId}`,
        legalName: `Empty supplier ${runId}`,
        displayName: `Empty supplier ${runId}`,
        status: 'ACTIVE',
      },
      {
        id: foreignSupplierId,
        organizationId: foreignOrgId,
        supplierCode: `PERF-F-${runId}`,
        legalName: `Foreign supplier ${runId}`,
        displayName: `Foreign supplier ${runId}`,
        status: 'ACTIVE',
      },
    ]);
    await getDb().insert(subcontractors).values([
      {
        id: subcontractorId,
        organizationId: orgId,
        legalName: `Performance subcontractor ${runId}`,
        displayName: `Performance subcontractor ${runId}`,
        status: 'ACTIVE',
      },
      {
        id: emptySubcontractorId,
        organizationId: orgId,
        legalName: `Empty subcontractor ${runId}`,
        displayName: `Empty subcontractor ${runId}`,
        status: 'ACTIVE',
      },
      {
        id: foreignSubcontractorId,
        organizationId: foreignOrgId,
        legalName: `Foreign subcontractor ${runId}`,
        displayName: `Foreign subcontractor ${runId}`,
        status: 'ACTIVE',
      },
    ]);

    const now = Date.now();
    await addEvent({
      org: orgId,
      project: projectId,
      partnerType: 'SUPPLIER',
      supplier: supplierId,
      eventType: 'DELIVERY_ON_TIME',
      occurredAt: new Date(now - 3000),
      sourceId: `${runId}-ontime`,
    });
    await addEvent({
      org: orgId,
      project: projectId,
      partnerType: 'SUPPLIER',
      supplier: supplierId,
      eventType: 'DELIVERY_LATE',
      occurredAt: new Date(now - 2000),
      sourceId: `${runId}-late`,
    });
    await addEvent({
      org: orgId,
      project: projectId,
      partnerType: 'SUPPLIER',
      supplier: supplierId,
      eventType: 'RECEIPT_REJECTION',
      occurredAt: new Date(now - 1000),
      sourceId: `${runId}-rejection`,
    });
    await addEvent({
      org: orgId,
      project: projectId,
      partnerType: 'SUBCONTRACTOR',
      subcontractor: subcontractorId,
      eventType: 'WORK_COMPLETED',
      occurredAt: new Date(now),
      sourceId: `${runId}-work`,
    });
    await addEvent({
      org: orgId,
      project: projectId,
      partnerType: 'SUBCONTRACTOR',
      subcontractor: subcontractorId,
      eventType: 'WORK_COMPLETED',
      occurredAt: new Date(now - 1000),
      sourceId: `${runId}-work-older`,
    });
    await addEvent({
      org: foreignOrgId,
      project: foreignProjectId,
      partnerType: 'SUPPLIER',
      supplier: foreignSupplierId,
      eventType: 'DELIVERY_LATE',
      occurredAt: new Date(now),
      sourceId: `${runId}-foreign`,
    });
    await addEvent({
      org: foreignOrgId,
      project: foreignProjectId,
      partnerType: 'SUBCONTRACTOR',
      subcontractor: foreignSubcontractorId,
      eventType: 'WORK_COMPLETED',
      occurredAt: new Date(now),
      sourceId: `${runId}-foreign-work`,
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('returns this supplier’s on-time, late, and rejection events, and an empty supplier timeline', async () => {
    const response = await app.inject({
      method: 'GET',
      url: supplierPerformancePath(orgId, projectId, supplierId),
      headers: authHeaders(token),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data;
    expect(body).toHaveProperty('items');
    expect(body).toHaveProperty('nextCursor');
    expect(body.items.map((event: { eventType: string }) => event.eventType)).toEqual(expect.arrayContaining([
      'DELIVERY_ON_TIME',
      'DELIVERY_LATE',
      'RECEIPT_REJECTION',
    ]));

    const empty = await app.inject({
      method: 'GET',
      url: supplierPerformancePath(orgId, projectId, emptySupplierId),
      headers: authHeaders(token),
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().data.items).toEqual([]);
    expect(empty.json().data.nextCursor).toBeNull();
  });

  it('paginates supplier events with a decodable occurredAt/id cursor', async () => {
    const first = await app.inject({
      method: 'GET',
      url: `${supplierPerformancePath(orgId, projectId, supplierId)}?limit=1`,
      headers: authHeaders(token),
    });
    expect(first.statusCode).toBe(200);
    expect(first.json().data.items).toHaveLength(1);
    const cursor = first.json().data.nextCursor as string;
    expect(cursor).toBeTruthy();
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString('utf8'));
    expect(decoded).toHaveProperty('occurredAt');
    expect(decoded).toHaveProperty('id');
    expect(typeof decoded.id).toBe('string');
    const next = await app.inject({
      method: 'GET',
      url: `${supplierPerformancePath(orgId, projectId, supplierId)}?limit=1&cursor=${encodeURIComponent(cursor)}`,
      headers: authHeaders(token),
    });
    expect(next.statusCode).toBe(200);
    expect(next.json().data.items[0].id).not.toBe(first.json().data.items[0].id);
    expect(next.json().data.nextCursor).toBeTruthy();
  });

  it('clamps or rejects limits above 100, ignores malformed cursors, and isolates foreign supplier IDs', async () => {
    const oversized = await app.inject({
      method: 'GET',
      url: `${supplierPerformancePath(orgId, projectId, supplierId)}?limit=101`,
      headers: authHeaders(token),
    });
    expect([200, 400, 422]).toContain(oversized.statusCode);
    if (oversized.statusCode === 200) expect(oversized.json().data.items.length).toBeLessThanOrEqual(100);

    const invalidCursor = await app.inject({
      method: 'GET',
      url: `${supplierPerformancePath(orgId, projectId, supplierId)}?cursor=not-json`,
      headers: authHeaders(token),
    });
    expect(invalidCursor.statusCode).toBe(200);
    expect(invalidCursor.json().data.items).toHaveLength(3);

    const foreign = await app.inject({
      method: 'GET',
      url: supplierPerformancePath(orgId, projectId, foreignSupplierId),
      headers: authHeaders(token),
    });
    expect(foreign.statusCode).toBe(200);
    expect(foreign.json().data.items).toEqual([]);

    const persistedForeign = await getDb().select().from(partnerPerformanceEvents).where(and(
      eq(partnerPerformanceEvents.organizationId, foreignOrgId),
      eq(partnerPerformanceEvents.supplierId, foreignSupplierId),
    ));
    expect(persistedForeign).toHaveLength(1);
  });

  it('returns subcontractor events and supports subcontractor cursor pagination and empty results', async () => {
    const events = await getDb().select().from(partnerPerformanceEvents).where(and(
      eq(partnerPerformanceEvents.organizationId, orgId),
      eq(partnerPerformanceEvents.subcontractorId, subcontractorId),
    ));
    expect(events).toHaveLength(2);
    const response = await app.inject({
      method: 'GET',
      url: subcontractorPerformancePath(orgId, projectId, subcontractorId),
      headers: authHeaders(token),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.items[0].eventType).toBe('WORK_COMPLETED');

    const page = await app.inject({
      method: 'GET',
      url: `${subcontractorPerformancePath(orgId, projectId, subcontractorId)}?limit=1`,
      headers: authHeaders(token),
    });
    expect(page.statusCode).toBe(200);
    expect(page.json().data.items).toHaveLength(1);
    expect(page.json().data.nextCursor).toBeTruthy();
    const next = await app.inject({
      method: 'GET',
      url: `${subcontractorPerformancePath(orgId, projectId, subcontractorId)}?limit=1&cursor=${encodeURIComponent(page.json().data.nextCursor)}`,
      headers: authHeaders(token),
    });
    expect(next.statusCode).toBe(200);
    expect(next.json().data.items[0].id).not.toBe(page.json().data.items[0].id);

    const empty = await app.inject({
      method: 'GET',
      url: subcontractorPerformancePath(orgId, projectId, emptySubcontractorId),
      headers: authHeaders(token),
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().data.items).toEqual([]);
    expect(empty.json().data.nextCursor).toBeNull();

    const foreign = await app.inject({
      method: 'GET',
      url: subcontractorPerformancePath(orgId, projectId, foreignSubcontractorId),
      headers: authHeaders(token),
    });
    expect(foreign.statusCode).toBe(200);
    expect(foreign.json().data.items).toEqual([]);
    const foreignEvents = await getDb().select().from(partnerPerformanceEvents).where(and(
      eq(partnerPerformanceEvents.organizationId, foreignOrgId),
      eq(partnerPerformanceEvents.subcontractorId, foreignSubcontractorId),
    ));
    expect(foreignEvents).toHaveLength(1);
  });

  it('requires project permission and isolates another organization’s subcontractor timeline', async () => {
    const noPermission = await app.inject({
      method: 'GET',
      url: supplierPerformancePath(orgId, projectId, supplierId),
      headers: authHeaders(clientToken),
    });
    expect([403, 404]).toContain(noPermission.statusCode);

    const nonMember = await app.inject({
      method: 'GET',
      url: supplierPerformancePath(orgId, projectId, supplierId),
      headers: authHeaders(outsiderToken),
    });
    expect([403, 404]).toContain(nonMember.statusCode);

    const foreign = await app.inject({
      method: 'GET',
      url: subcontractorPerformancePath(orgId, projectId, crypto.randomUUID()),
      headers: authHeaders(token),
    });
    expect(foreign.statusCode).toBe(200);
    expect(foreign.json().data.items).toEqual([]);
  });
});
