import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  materials,
  materialRequests,
  outboxEvents,
  procurementApprovals,
  purchaseOrders,
  quotes,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createTestApp } from '../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
const path = (orgId: string, projectId: string) => `/api/v1/organizations/${orgId}/projects/${projectId}/procurement-approvals`;

describe('Procurement approval flow (integration)', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let orgId: string;
  let projectId: string;
  let otherProjectId: string;
  let foreignOrgId: string;
  let foreignProjectId: string;
  let foreignUserToken: string;
  let materialId: string;
  let supplierId: string;
  let foreignSupplierId: string;

  async function createProject(org: string, auth: string, name: string): Promise<string> {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org}/projects`,
      headers: { authorization: `Bearer ${auth}` },
      payload: { name, currency: 'USD' },
    });
    expect(res.statusCode).toBe(201);
    return res.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project.id;
  }

  async function ensureMaterial(org: string, code: string): Promise<string> {
    const id = crypto.randomUUID();
    await getDb().insert(materials).values({
      id,
      organizationId: org,
      materialCode: code,
      name: `Approval material ${code}`,
      defaultUnitCode: 'EA',
    });
    return id;
  }

  async function ensureSupplier(org: string, code: string): Promise<string> {
    const id = crypto.randomUUID();
    await getDb().insert(suppliers).values({
      id,
      organizationId: org,
      supplierCode: code,
      legalName: `Approval supplier ${code}`,
      displayName: `Approval supplier ${code}`,
      status: 'ACTIVE',
    });
    return id;
  }

  async function createMaterialRequest(
    project = projectId,
    auth = adminToken,
    organization = orgId,
  ) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organization}/projects/${project}/material-requests`,
      headers: { authorization: `Bearer ${auth}` },
      payload: {
        notes: `Approval MR ${runId}`,
        items: [{ materialId, quantity: '2', unitCode: 'EA' }],
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().data;
  }

  async function createQuote(project = projectId, auth = adminToken, organization = orgId) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organization}/projects/${project}/quotes`,
      headers: { authorization: `Bearer ${auth}` },
      payload: {
        supplierId,
        quoteDate: today,
        validUntil: '2035-12-31',
        currencyCode: 'USD',
        items: [{ materialId, quantity: '2', unitCode: 'EA', unitPrice: '10.50' }],
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().data;
  }

  async function createPo(project = projectId, auth = adminToken, organization = orgId) {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organization}/projects/${project}/purchase-orders`,
      headers: { authorization: `Bearer ${auth}` },
      payload: {
        supplierId,
        orderDate: today,
        expectedDeliveryDate: '2035-12-31',
        currencyCode: 'USD',
        items: [{ materialId, quantity: '2', unitCode: 'EA', unitPrice: '10.50' }],
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json().data;
  }

  async function createApproval(
    resourceType: 'MATERIAL_REQUEST' | 'QUOTE' | 'PURCHASE_ORDER',
    resourceId: string,
    auth = adminToken,
    project = projectId,
    organization = orgId,
  ) {
    const res = await app.inject({
      method: 'POST',
      url: path(organization, project),
      headers: { authorization: `Bearer ${auth}` },
      payload: { resourceType, resourceId },
    });
    return res;
  }

  async function getScopedOutbox(type: string, key: 'approvalId' | 'resourceId', value: string) {
    return getDb()
      .select()
      .from(outboxEvents)
      .where(and(
        eq(outboxEvents.eventType, type),
        eq(outboxEvents.organizationId, orgId),
        sql`${outboxEvents.payload} ->> ${key} = ${value}`,
      ));
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `approval_owner_${runId}@example.com` });
    adminToken = owner.token;
    orgId = (await createOrgWithAdmin(app, adminToken, `Approval Org ${runId}`)).orgId;
    projectId = await createProject(orgId, adminToken, `Approval Project ${runId}`);
    otherProjectId = await createProject(orgId, adminToken, `Approval Other Project ${runId}`);

    const foreignOwner = await createVerifiedUser({ email: `approval_foreign_${runId}@example.com` });
    foreignUserToken = foreignOwner.token;
    foreignOrgId = (await createOrgWithAdmin(app, foreignUserToken, `Approval Foreign ${runId}`)).orgId;
    foreignProjectId = await createProject(foreignOrgId, foreignUserToken, `Approval Foreign Project ${runId}`);

    materialId = await ensureMaterial(orgId, `APR-${runId}`);
    supplierId = await ensureSupplier(orgId, `APR-S-${runId}`);
    foreignSupplierId = await ensureSupplier(foreignOrgId, `APR-S-F-${runId}`);
    await ensureMaterial(foreignOrgId, `APR-F-${runId}`);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('creates a pending approval for a project resource and rejects a duplicate pending one', async () => {
    const mr = await createMaterialRequest();
    const created = await createApproval('MATERIAL_REQUEST', mr.id);
    expect(created.statusCode).toBe(201);
    const body = created.json();
    expect(body.data.status).toBe('PENDING');
    expect(body.data.resourceType).toBe('MATERIAL_REQUEST');
    expect(body.data.resourceId).toBe(mr.id);

    const duplicate = await createApproval('MATERIAL_REQUEST', mr.id);
    expect(duplicate.statusCode).toBe(409);

    const rows = await getDb().select().from(procurementApprovals).where(and(
      eq(procurementApprovals.organizationId, orgId),
      eq(procurementApprovals.resourceId, mr.id),
      eq(procurementApprovals.resourceType, 'MATERIAL_REQUEST'),
    ));
    expect(rows.length).toBeGreaterThanOrEqual(1);
  });

  it('approves a pending approval and writes a scoped outbox event and audit log', async () => {
    const quote = await createQuote();
    const approvalRes = await createApproval('QUOTE', quote.id);
    expect(approvalRes.statusCode).toBe(201);
    const approvalId = approvalRes.json().data.id;

    const review = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${approvalId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { decisionReason: 'Approved by test' },
    });
    expect(review.statusCode).toBe(200);
    expect(review.json().data.status).toBe('APPROVED');

    const outbox = await getScopedOutbox('procurement.approval.approved', 'approvalId', approvalId);
    expect(outbox).toHaveLength(1);

    const audit = await getDb().select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, orgId),
      eq(auditLogs.action, 'procurement_approval.approved'),
      eq(auditLogs.resourceId, approvalId),
    ));
    expect(audit).toHaveLength(1);

    const quoteRow = await getDb().select().from(quotes).where(eq(quotes.id, quote.id));
    expect(quoteRow[0]?.status).toBe('ACCEPTED');

    const repeated = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${approvalId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().data.status).toBe('APPROVED');
    expect(await getScopedOutbox('procurement.approval.approved', 'approvalId', approvalId)).toHaveLength(1);
  });

  it('rejects and cancels pending approvals without leaving the resource active', async () => {
    const po = await createPo();
    const created = await createApproval('PURCHASE_ORDER', po.id);
    expect(created.statusCode).toBe(201);
    const approvalId = created.json().data.id;

    const rejectRes = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${approvalId}/reject`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { decisionReason: 'Needs revision' },
    });
    expect(rejectRes.statusCode).toBe(200);
    expect(rejectRes.json().data.status).toBe('REJECTED');
    expect(await getScopedOutbox('procurement.approval.rejected', 'approvalId', approvalId)).toHaveLength(1);

    const poRow = await getDb().select().from(purchaseOrders).where(eq(purchaseOrders.id, po.id));
    expect(poRow[0]?.status).toBe('DRAFT');

    const another = await createApproval('PURCHASE_ORDER', po.id);
    expect(another.statusCode).toBe(201);
    const cancelRes = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${another.json().data.id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(cancelRes.statusCode).toBe(200);
    expect(cancelRes.json().data.status).toBe('CANCELLED');

    const cancelledOutbox = await getScopedOutbox('procurement.approval.cancelled', 'approvalId', another.json().data.id);
    expect(cancelledOutbox).toHaveLength(1);
    const repeatCancel = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${another.json().data.id}/cancel`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(repeatCancel.statusCode).toBe(422);
  });

  it('lists project approvals with status filtering and cursor pagination', async () => {
    const request = await createMaterialRequest();
    const quote = await createQuote();
    const po = await createPo();
    const created = await Promise.all([
      createApproval('MATERIAL_REQUEST', request.id),
      createApproval('QUOTE', quote.id),
      createApproval('PURCHASE_ORDER', po.id),
    ]);
    expect(created.map((result) => result.statusCode)).toEqual([201, 201, 201]);

    const approvedId = created[0]!.json().data.id as string;
    const approved = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${approvedId}/approve`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(approved.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: path(orgId, projectId),
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.map((entry: { id: string }) => entry.id)).toEqual(
      expect.arrayContaining(created.map((entry) => entry.json().data.id)),
    );

    const firstPage = await app.inject({
      method: 'GET',
      url: `${path(orgId, projectId)}?status=PENDING&limit=1`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(firstPage.statusCode).toBe(200);
    expect(firstPage.json().data).toHaveLength(1);
    expect(firstPage.json().data[0].status).toBe('PENDING');
    const cursor = firstPage.json().meta.nextCursor as string;
    expect(cursor).toBeTruthy();

    const nextPage = await app.inject({
      method: 'GET',
      url: `${path(orgId, projectId)}?status=PENDING&limit=1&cursor=${encodeURIComponent(cursor)}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(nextPage.statusCode).toBe(200);
    expect(nextPage.json().data).toHaveLength(1);
    expect(nextPage.json().data[0].id).not.toBe(firstPage.json().data[0].id);

    const otherProjectRequest = await createMaterialRequest(otherProjectId);
    const otherProjectApproval = await createApproval(
      'MATERIAL_REQUEST',
      otherProjectRequest.id,
      adminToken,
      otherProjectId,
    );
    expect(otherProjectApproval.statusCode).toBe(201);

    const ownGet = await app.inject({
      method: 'GET',
      url: `${path(orgId, projectId)}/${created[1]!.json().data.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(ownGet.statusCode).toBe(200);
    const hiddenGet = await app.inject({
      method: 'GET',
      url: `${path(orgId, projectId)}/${otherProjectApproval.json().data.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(hiddenGet.statusCode).toBe(404);
  });

  it('rejects unauthenticated and malformed creates, and serializes concurrent approvals idempotently', async () => {
    const unauthenticated = await app.inject({
      method: 'POST',
      url: path(orgId, projectId),
      payload: { resourceType: 'MATERIAL_REQUEST', resourceId: crypto.randomUUID() },
    });
    expect(unauthenticated.statusCode).toBe(401);

    const invalidType = await app.inject({
      method: 'POST',
      url: path(orgId, projectId),
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { resourceType: 'INVALID', resourceId: crypto.randomUUID() },
    });
    expect(invalidType.statusCode).toBe(422);

    const request = await createMaterialRequest();
    const created = await createApproval('MATERIAL_REQUEST', request.id);
    expect(created.statusCode).toBe(201);
    const approvalId = created.json().data.id as string;
    const url = `${path(orgId, projectId)}/${approvalId}/approve`;
    const concurrent = await Promise.all([
      app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${adminToken}` }, payload: {} }),
      app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${adminToken}` }, payload: {} }),
    ]);
    expect(concurrent.map((result) => result.statusCode)).toEqual([200, 200]);
    expect(concurrent.every((result) => result.json().data.status === 'APPROVED')).toBe(true);
    expect(await getScopedOutbox('procurement.approval.approved', 'approvalId', approvalId)).toHaveLength(1);
    const [resource] = await getDb().select().from(materialRequests).where(eq(materialRequests.id, request.id));
    expect(resource?.status).toBe('APPROVED');
  });

  it('rejects a quote approval, transitions the resource and rejects a second decision', async () => {
    const quote = await createQuote();
    const created = await createApproval('QUOTE', quote.id);
    expect(created.statusCode).toBe(201);
    const approvalId = created.json().data.id as string;
    const rejected = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${approvalId}/reject`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { decisionReason: 'Rejected for test coverage' },
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().data.status).toBe('REJECTED');
    expect((await getDb().select().from(quotes).where(eq(quotes.id, quote.id)))[0]?.status).toBe('REJECTED');
    expect(await getScopedOutbox('procurement.approval.rejected', 'approvalId', approvalId)).toHaveLength(1);

    const repeat = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${approvalId}/reject`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: {},
    });
    expect(repeat.statusCode).toBe(422);
  });

  it('hides approvals from users in other tenant organizations', async () => {
    const request = await createMaterialRequest();
    const created = await createApproval('MATERIAL_REQUEST', request.id);
    expect(created.statusCode).toBe(201);
    const crossTenant = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${created.json().data.id}/approve`,
      headers: { authorization: `Bearer ${foreignUserToken}` },
      payload: {},
    });
    expect([403, 404]).toContain(crossTenant.statusCode);
  });

  it('rejects approval requests for foreign-org resources and denies access across tenants', async () => {
    const foreignQuote = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${foreignOrgId}/projects/${foreignProjectId}/quotes`,
      headers: { authorization: `Bearer ${foreignUserToken}` },
      payload: {
        supplierId: foreignSupplierId,
        quoteDate: today,
        validUntil: '2035-12-31',
        currencyCode: 'USD',
        items: [{ materialId: await ensureMaterial(foreignOrgId, `APR-F2-${runId}`), quantity: '2', unitCode: 'EA', unitPrice: '4.50' }],
      },
    });
    expect(foreignQuote.statusCode).toBe(201);
    const foreignId = foreignQuote.json().data.id;

    const denied = await createApproval('QUOTE', foreignId);
    expect([403, 404, 422]).toContain(denied.statusCode);

    const otherOrgApproval = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${crypto.randomUUID()}/approve`,
      headers: { authorization: `Bearer ${foreignUserToken}` },
    });
    expect([403, 404, 422]).toContain(otherOrgApproval.statusCode);
  });
});
