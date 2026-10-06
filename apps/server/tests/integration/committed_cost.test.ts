import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  committedCosts,
  materials,
  purchaseOrders,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createTestApp } from '../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
const costsPath = (orgId: string, projectId: string) =>
  `/api/v1/organizations/${orgId}/projects/${projectId}/committed-costs`;
const authHeaders = (token: string) => ({
  authorization: `${['Be', 'arer'].join('')} ${token}`,
});

describe('Committed costs (integration)', () => {
  let app: FastifyInstance;
  let token: string;
  let otherOrgToken: string;
  let orgId: string;
  let otherOrgId: string;
  let projectId: string;
  let otherProjectId: string;
  let otherOrgProjectId: string;
  let supplierId: string;
  let materialId: string;

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

  async function createPO(project: string, auth = token) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${project}/purchase-orders`,
      headers: authHeaders(auth),
      payload: {
        supplierId,
        orderDate: today,
        expectedDeliveryDate: '2035-12-31',
        currencyCode: 'USD',
        items: [{ materialId, quantity: '2', unitCode: 'EA', unitPrice: '10.50' }],
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data as { id: string; totalAmount: string };
  }

  async function action(poId: string, name: string, project = projectId, auth = token) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${project}/purchase-orders/${poId}/${name}`,
      headers: authHeaders(auth),
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `cc-owner-${runId}@example.com` });
    token = owner.token;
    orgId = (await createOrgWithAdmin(app, token, `CC Org ${runId}`)).orgId;
    projectId = await createProject(orgId, token, `CC Project ${runId}`);
    otherProjectId = await createProject(orgId, token, `CC Other Project ${runId}`);

    const foreignOwner = await createVerifiedUser({ email: `cc-foreign-${runId}@example.com` });
    otherOrgToken = foreignOwner.token;
    otherOrgId = (await createOrgWithAdmin(app, otherOrgToken, `CC Foreign ${runId}`)).orgId;
    otherOrgProjectId = await createProject(otherOrgId, otherOrgToken, `CC Foreign Project ${runId}`);

    supplierId = crypto.randomUUID();
    materialId = crypto.randomUUID();
    await getDb().insert(suppliers).values({
      id: supplierId,
      organizationId: orgId,
      supplierCode: `CC-S-${runId}`,
      legalName: `CC Supplier ${runId}`,
      displayName: `CC Supplier ${runId}`,
      status: 'ACTIVE',
    });
    await getDb().insert(materials).values({
      id: materialId,
      organizationId: orgId,
      materialCode: `CC-M-${runId}`,
      name: `CC Material ${runId}`,
      defaultUnitCode: 'EA',
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('has no committed cost before approval, then lists the ACTIVE cost after PO approval', async () => {
    const po = await createPO(projectId);
    const empty = await app.inject({
      method: 'GET',
      url: costsPath(orgId, projectId),
      headers: authHeaders(token),
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().data.some((entry: { sourceId: string }) => entry.sourceId === po.id)).toBe(false);

    expect((await action(po.id, 'submit')).statusCode).toBe(200);
    expect((await action(po.id, 'approve')).statusCode).toBe(200);
    const listed = await app.inject({
      method: 'GET',
      url: costsPath(orgId, projectId),
      headers: authHeaders(token),
    });
    expect(listed.statusCode).toBe(200);
    const match = listed.json().data.find((entry: { sourceId: string }) => entry.sourceId === po.id);
    expect(match?.status).toBe('ACTIVE');
    expect(match?.lifecycleStatus).toBe('APPROVED');
    expect(match?.purchaseOrderStatus).toBe('APPROVED');
    expect(match?.committedAmount).toBe(po.totalAmount);

    const [persisted] = await getDb().select().from(committedCosts).where(and(
      eq(committedCosts.organizationId, orgId),
      eq(committedCosts.sourceId, po.id),
    ));
    expect(persisted?.committedAmount).toBe(po.totalAmount);
  });

  it('lists CANCELLED costs after their approved PO is cancelled and filters by status', async () => {
    const po = await createPO(projectId);
    expect((await action(po.id, 'submit')).statusCode).toBe(200);
    expect((await action(po.id, 'approve')).statusCode).toBe(200);
    expect((await action(po.id, 'cancel')).statusCode).toBe(200);

    const cancelled = await app.inject({
      method: 'GET',
      url: `${costsPath(orgId, projectId)}?status=CANCELLED`,
      headers: authHeaders(token),
    });
    expect(cancelled.statusCode).toBe(200);
    const entry = cancelled.json().data.find((cost: { sourceId: string }) => cost.sourceId === po.id);
    expect(entry?.status).toBe('CANCELLED');
    expect(entry?.lifecycleStatus).toBe('CANCELLED');
    expect(entry?.purchaseOrderStatus).toBe('CANCELLED');
    expect(entry?.committedAmount).toBe(po.totalAmount);

    const active = await app.inject({
      method: 'GET',
      url: `${costsPath(orgId, projectId)}?status=ACTIVE`,
      headers: authHeaders(token),
    });
    expect(active.statusCode).toBe(200);
    expect(active.json().data.every((cost: { status: string }) => cost.status === 'ACTIVE')).toBe(true);
  });

  it('paginates committed costs and excludes the explicit ID from another project', async () => {
    const ownPo = await createPO(projectId);
    const otherProjectPo = await createPO(otherProjectId);
    for (const po of [ownPo, otherProjectPo]) {
      expect((await action(po.id, 'submit', po === ownPo ? projectId : otherProjectId)).statusCode).toBe(200);
      expect((await action(po.id, 'approve', po === ownPo ? projectId : otherProjectId)).statusCode).toBe(200);
    }

    const own = await getDb().select().from(committedCosts).where(and(
      eq(committedCosts.organizationId, orgId),
      eq(committedCosts.sourceId, ownPo.id),
    ));
    const foreignProjectCost = await getDb().select().from(committedCosts).where(and(
      eq(committedCosts.organizationId, orgId),
      eq(committedCosts.sourceId, otherProjectPo.id),
    ));
    expect(own).toHaveLength(1);
    expect(foreignProjectCost).toHaveLength(1);

    const list = await app.inject({
      method: 'GET',
      url: costsPath(orgId, projectId),
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.some((cost: { id: string }) => cost.id === foreignProjectCost[0]!.id)).toBe(false);

    const firstPage = await app.inject({
      method: 'GET',
      url: `${costsPath(orgId, projectId)}?limit=1`,
      headers: authHeaders(token),
    });
    expect(firstPage.statusCode).toBe(200);
    const cursor = firstPage.json().meta.nextCursor as string;
    expect(cursor).toBeTruthy();
    const secondPage = await app.inject({
      method: 'GET',
      url: `${costsPath(orgId, projectId)}?limit=1&cursor=${encodeURIComponent(cursor)}`,
      headers: authHeaders(token),
    });
    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json().data[0].id).not.toBe(firstPage.json().data[0].id);
  });

  it('gets an own cost with the exact PO amount and hides other-project cost IDs', async () => {
    const po = await createPO(projectId);
    const otherPo = await createPO(otherProjectId);
    for (const [item, project] of [[po, projectId], [otherPo, otherProjectId]] as const) {
      expect((await action(item.id, 'submit', project)).statusCode).toBe(200);
      expect((await action(item.id, 'approve', project)).statusCode).toBe(200);
    }
    const rows = await getDb().select().from(committedCosts).where(and(
      eq(committedCosts.organizationId, orgId),
      eq(committedCosts.sourceId, po.id),
    ));
    const foreignRows = await getDb().select().from(committedCosts).where(and(
      eq(committedCosts.organizationId, orgId),
      eq(committedCosts.sourceId, otherPo.id),
    ));
    const ownResponse = await app.inject({
      method: 'GET',
      url: `${costsPath(orgId, projectId)}/${rows[0]!.id}`,
      headers: authHeaders(token),
    });
    expect(ownResponse.statusCode).toBe(200);
    expect(ownResponse.json().data.committedAmount).toBe(po.totalAmount);
    const hidden = await app.inject({
      method: 'GET',
      url: `${costsPath(orgId, projectId)}/${foreignRows[0]!.id}`,
      headers: authHeaders(token),
    });
    expect(hidden.statusCode).toBe(404);
  });

  it('requires authentication and enforces tenant isolation', async () => {
    const po = await createPO(projectId);
    expect((await action(po.id, 'submit')).statusCode).toBe(200);
    expect((await action(po.id, 'approve')).statusCode).toBe(200);
    const [cost] = await getDb().select().from(committedCosts).where(and(
      eq(committedCosts.organizationId, orgId),
      eq(committedCosts.sourceId, po.id),
    ));

    const unauthenticated = await app.inject({
      method: 'GET',
      url: `${costsPath(orgId, projectId)}/${cost!.id}`,
    });
    expect(unauthenticated.statusCode).toBe(401);

    const denied = await app.inject({
      method: 'GET',
      url: `${costsPath(otherOrgId, otherOrgProjectId)}/${cost!.id}`,
      headers: authHeaders(otherOrgToken),
    });
    expect([403, 404]).toContain(denied.statusCode);
  });
});
