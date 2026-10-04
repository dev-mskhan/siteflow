import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import {
  committedCosts,
  auditLogs,
  materials,
  purchaseOrderItems,
  purchaseOrders,
  quoteItems,
  quotes,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createTestApp } from '../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const suffix = () => crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
const poPath = (orgId: string, projectId: string) =>
  `/api/v1/organizations/${orgId}/projects/${projectId}/purchase-orders`;

describe('Purchase orders (integration)', () => {
  let app: FastifyInstance;
  let token: string;
  let actorUserId: string;
  let orgId: string;
  let projectId: string;
  let otherProjectId: string;
  let otherOrgId: string;
  let otherOrgToken: string;
  let supplierId: string;
  let foreignSupplierId: string;
  let materialId: string;

  async function createProject(org: string, auth: string, name: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org}/projects`,
      headers: { authorization: `Bearer ${auth}` },
      payload: { name, currency: 'USD' },
    });
    expect(response.statusCode).toBe(201);
    return response.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project.id;
  }

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      supplierId,
      orderDate: today,
      expectedDeliveryDate: '2030-12-31',
      deliveryLocation: `Site ${runId}`,
      currencyCode: 'USD',
      items: [{
        materialId,
        quantity: '2',
        unitCode: 'EA',
        unitPrice: '10.50',
        discountAmount: '1.00',
        taxAmount: '2.00',
      }],
      ...overrides,
    };
  }

  async function createPO(
    project = projectId,
    payload: Record<string, unknown> = validPayload(),
    auth = token,
  ) {
    return app.inject({
      method: 'POST',
      url: poPath(orgId, project),
      headers: { authorization: `Bearer ${auth}` },
      payload,
    });
  }

  async function createPOData(
    project = projectId,
    payload: Record<string, unknown> = validPayload(),
  ) {
    const response = await createPO(project, payload);
    expect(response.statusCode).toBe(201);
    return response.json().data;
  }

  async function action(poId: string, name: string, project = projectId, auth = token) {
    return app.inject({
      method: 'POST',
      url: `${poPath(orgId, project)}/${poId}/${name}`,
      headers: { authorization: `Bearer ${auth}` },
    });
  }

  async function event(eventType: string, field: string, id: string) {
    const rows = await getDb().execute(sql`
      SELECT id, event_type, organization_id, payload
      FROM app.outbox_events
      WHERE event_type = ${eventType}
        AND organization_id = ${orgId}
        AND payload ->> ${field}::text = ${id}
    `);
    return Array.from(rows as unknown as Iterable<unknown>);
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `po_owner_${runId}@example.com` });
    token = owner.token;
    actorUserId = owner.user.id;
    orgId = (await createOrgWithAdmin(app, token, `PO Org ${runId}`)).orgId;
    projectId = await createProject(orgId, token, `PO Project ${runId}`);
    otherProjectId = await createProject(orgId, token, `PO Other Project ${runId}`);

    const foreign = await createVerifiedUser({ email: `po_foreign_${runId}@example.com` });
    otherOrgToken = foreign.token;
    otherOrgId = (await createOrgWithAdmin(app, otherOrgToken, `PO Foreign Org ${runId}`)).orgId;
    supplierId = crypto.randomUUID();
    foreignSupplierId = crypto.randomUUID();
    materialId = crypto.randomUUID();
    await getDb().insert(suppliers).values([
      {
        id: supplierId,
        organizationId: orgId,
        supplierCode: `PO-${runId}`,
        legalName: `PO Supplier ${runId}`,
        displayName: `PO Supplier ${runId}`,
        status: 'ACTIVE',
      },
      {
        id: foreignSupplierId,
        organizationId: otherOrgId,
        supplierCode: `POF-${runId}`,
        legalName: `Foreign PO Supplier ${runId}`,
        displayName: `Foreign PO Supplier ${runId}`,
        status: 'ACTIVE',
      },
    ]);
    await getDb().insert(materials).values({
      id: materialId,
      organizationId: orgId,
      materialCode: `POM-${runId}`,
      name: `PO material ${runId}`,
      defaultUnitCode: 'EA',
    });
  }, 90000);

  afterAll(async () => {
    await app.close();
  });

  it('creates a DRAFT PO with server totals, monthly number and persisted item relationships', async () => {
    const response = await createPO(projectId, validPayload({ totalAmount: '0.01' }));
    expect(response.statusCode).toBe(201);
    const created = response.json().data;
    expect(created.status).toBe('DRAFT');
    expect(created.poNumber).toMatch(/^PO-\d{6}-\d{3}$/);
    expect(created.subtotal).toBe('21.00');
    expect(created.discountAmount).toBe('1.00');
    expect(created.taxAmount).toBe('2.00');
    expect(created.totalAmount).toBe('22.00');
    expect(created.items[0].lineSubtotal).toBe('21.00');
    expect(created.items[0].lineTotal).toBe('22.00');
    const [persisted] = await getDb().select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, created.id), eq(purchaseOrders.organizationId, orgId)));
    expect(persisted?.status).toBe('DRAFT');
    expect(persisted?.totalAmount).toBe('22.00');
    expect(persisted?.projectId).toBe(projectId);
    const items = await getDb().select().from(purchaseOrderItems)
      .where(and(eq(purchaseOrderItems.purchaseOrderId, created.id), eq(purchaseOrderItems.organizationId, orgId)));
    expect(items).toHaveLength(1);
  });

  it('rejects a supplier from another organization, empty items and zero quantity', async () => {
    const foreignSupplier = await createPO(projectId, validPayload({ supplierId: foreignSupplierId }));
    expect([404, 422]).toContain(foreignSupplier.statusCode);
    expect((await createPO(projectId, validPayload({ items: [] }))).statusCode).toBe(422);
    expect((await createPO(projectId, validPayload({
      items: [{ materialId, quantity: '0', unitCode: 'EA', unitPrice: '1.00' }],
    }))).statusCode).toBe(422);
  });

  it('requires authentication to create a PO', async () => {
    const response = await app.inject({
      method: 'POST',
      url: poPath(orgId, projectId),
      payload: validPayload(),
    });
    expect(response.statusCode).toBe(401);
  });

  it('lists own-project POs only with cursor pagination and populated items', async () => {
    const first = await createPOData();
    const second = await createPOData(projectId, validPayload({
      items: [
        { materialId, quantity: '1', unitCode: 'EA', unitPrice: '3.00' },
        { materialId, quantity: '2', unitCode: 'EA', unitPrice: '4.00' },
      ],
    }));
    const otherProject = await createPOData(otherProjectId);
    const list = await app.inject({
      method: 'GET',
      url: poPath(orgId, projectId),
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    const entries = list.json().data as Array<{ id: string; items: unknown[] }>;
    expect(entries.some((po) => po.id === first.id)).toBe(true);
    expect(entries.some((po) => po.id === second.id)).toBe(true);
    expect(entries.some((po) => po.id === otherProject.id)).toBe(false);
    expect(entries.find((po) => po.id === first.id)?.items).toHaveLength(1);
    expect(entries.find((po) => po.id === second.id)?.items).toHaveLength(2);

    const page1 = await app.inject({
      method: 'GET',
      url: `${poPath(orgId, projectId)}?limit=1`,
      headers: { authorization: `Bearer ${token}` },
    });
    const cursor = page1.json().meta.nextCursor as string;
    expect(page1.statusCode).toBe(200);
    expect(cursor).toBeTruthy();
    const page2 = await app.inject({
      method: 'GET',
      url: `${poPath(orgId, projectId)}?limit=1&cursor=${encodeURIComponent(cursor)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(page2.statusCode).toBe(200);
    expect(page2.json().data[0].id).not.toBe(page1.json().data[0].id);
  });

  it('gets an own PO and returns not found for an explicit other-project PO ID', async () => {
    const own = await createPOData();
    const other = await createPOData(otherProjectId);
    const ownResponse = await app.inject({
      method: 'GET',
      url: `${poPath(orgId, projectId)}/${own.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ownResponse.statusCode).toBe(200);
    expect(ownResponse.json().data.items).toHaveLength(1);
    const hidden = await app.inject({
      method: 'GET',
      url: `${poPath(orgId, projectId)}/${other.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(hidden.statusCode).toBe(404);
  });

  it('updates a DRAFT PO and persists the allowed metadata', async () => {
    const created = await createPOData();
    const response = await app.inject({
      method: 'PATCH',
      url: `${poPath(orgId, projectId)}/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { notes: 'draft revision' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.notes).toBe('draft revision');
    const [persisted] = await getDb().select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, created.id), eq(purchaseOrders.organizationId, orgId)));
    expect(persisted?.notes).toBe('draft revision');
  });

  it('allows only the supported metadata fields to change after approval', async () => {
    const created = await createPOData();
    expect((await action(created.id, 'submit')).statusCode).toBe(200);
    expect((await action(created.id, 'approve')).statusCode).toBe(200);

    const response = await app.inject({
      method: 'PATCH',
      url: `${poPath(orgId, projectId)}/${created.id}`,
      headers: { authorization: 'Bearer ' + token },
      payload: { notes: 'approved order delivery note' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('APPROVED');
    expect(response.json().data.notes).toBe('approved order delivery note');
    const [persisted] = await getDb().select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, created.id), eq(purchaseOrders.organizationId, orgId)));
    expect(persisted?.notes).toBe('approved order delivery note');
  });

  it('transitions DRAFT to PENDING_APPROVAL, rejects duplicate submit and serializes concurrent submits', async () => {
    const created = await createPOData();
    const url = `${poPath(orgId, projectId)}/${created.id}/submit`;
    const concurrent = await Promise.all([
      app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } }),
      app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } }),
    ]);
    expect.soft(concurrent.map((result) => result.statusCode).sort()).toEqual([200, 422]);
    expect(concurrent.find((result) => result.statusCode === 200)?.json().data.status).toBe('PENDING_APPROVAL');
    expect((await action(created.id, 'submit')).statusCode).toBe(422);
    const [persisted] = await getDb().select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, created.id), eq(purchaseOrders.organizationId, orgId)));
    expect(persisted?.status).toBe('PENDING_APPROVAL');
  });

  it('approves a pending PO idempotently and creates one committed cost and scoped events', async () => {
    const created = await createPOData();
    expect((await action(created.id, 'submit')).statusCode).toBe(200);
    const approved = await action(created.id, 'approve');
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data.status).toBe('APPROVED');
    expect(approved.json().data.approvedAt).not.toBeNull();
    expect(approved.json().data.approvedBy).toBe(actorUserId);
    expect((await action(created.id, 'approve')).statusCode).toBe(200);

    const [persisted] = await getDb().select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, created.id), eq(purchaseOrders.organizationId, orgId)));
    expect(persisted?.status).toBe('APPROVED');
    const costs = await getDb().select().from(committedCosts)
      .where(and(
        eq(committedCosts.organizationId, orgId),
        eq(committedCosts.sourceType, 'PURCHASE_ORDER'),
        eq(committedCosts.sourceId, created.id),
      ));
    expect(costs).toHaveLength(1);
    expect(costs[0]?.committedAmount).toBe(created.totalAmount);
    expect(costs[0]?.projectId).toBe(projectId);
    expect(await event('procurement.committed_cost.created', 'poId', created.id)).toHaveLength(1);
    expect(await event('procurement.purchase_order.approved', 'poId', created.id)).toHaveLength(1);
  });

  it('serializes concurrent approvals and keeps a single committed-cost record', async () => {
    const created = await createPOData();
    expect((await action(created.id, 'submit')).statusCode).toBe(200);
    const results = await Promise.all([action(created.id, 'approve'), action(created.id, 'approve')]);
    expect.soft(results.map((result) => result.statusCode)).toEqual([200, 200]);
    expect.soft(results.every((result) => result.json().data.status === 'APPROVED')).toBe(true);
    const costs = await getDb().select().from(committedCosts).where(and(
      eq(committedCosts.organizationId, orgId),
      eq(committedCosts.sourceId, created.id),
    ));
    expect(costs).toHaveLength(1);
  });

  it('rejects approval before submission and sends only an approved PO', async () => {
    const draft = await createPOData();
    expect((await action(draft.id, 'approve')).statusCode).toBe(422);
    expect((await action(draft.id, 'send')).statusCode).toBe(422);
    expect((await action(draft.id, 'submit')).statusCode).toBe(200);
    expect((await action(draft.id, 'approve')).statusCode).toBe(200);
    const sent = await action(draft.id, 'send');
    expect(sent.statusCode).toBe(200);
    expect(sent.json().data.status).toBe('SENT');
    expect(sent.json().data.sentAt).not.toBeNull();
    expect(await event('procurement.purchase_order.sent', 'poId', draft.id)).toHaveLength(1);
  });

  it('cancels a DRAFT PO and records CANCELLED status', async () => {
    const created = await createPOData();
    const response = await action(created.id, 'cancel');
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('CANCELLED');
    const [persisted] = await getDb().select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, created.id), eq(purchaseOrders.organizationId, orgId)));
    expect(persisted?.status).toBe('CANCELLED');
  });

  it('treats repeated PO cancellation as idempotent without duplicating outbox effects', async () => {
    const created = await createPOData();
    expect((await action(created.id, 'cancel')).statusCode).toBe(200);

    const repeated = await action(created.id, 'cancel');
    expect(repeated.statusCode).toBe(200);
    expect(repeated.json().data.status).toBe('CANCELLED');
    expect(await event('procurement.purchase_order.cancelled', 'poId', created.id)).toHaveLength(1);
  });

  it('cancels an approved PO, releases its committed cost and writes scoped events/audit', async () => {
    const created = await createPOData();
    expect((await action(created.id, 'submit')).statusCode).toBe(200);
    expect((await action(created.id, 'approve')).statusCode).toBe(200);
    const cancelled = await action(created.id, 'cancel');
    expect(cancelled.statusCode).toBe(200);
    expect(cancelled.json().data.status).toBe('CANCELLED');
    const costs = await getDb().select().from(committedCosts).where(and(
      eq(committedCosts.organizationId, orgId),
      eq(committedCosts.sourceId, created.id),
    ));
    expect(costs).toHaveLength(1);
    expect(costs[0]?.status).toBe('CANCELLED');
    expect(costs[0]?.releasedAt).toBeInstanceOf(Date);
    expect(await event('procurement.committed_cost.cancelled', 'poId', created.id)).toHaveLength(1);
    expect(await event('procurement.purchase_order.cancelled', 'poId', created.id)).toHaveLength(1);
    const audit = await getDb().select().from(auditLogs)
      .where(and(
        eq(auditLogs.organizationId, orgId),
        eq(auditLogs.action, 'committed_cost.cancelled'),
        eq(auditLogs.resourceId, costs[0]!.id),
      ));
    expect(audit).toHaveLength(1);
  });

  it('denies a foreign tenant from approving this organization PO without changing its state', async () => {
    const created = await createPOData();
    expect((await action(created.id, 'submit')).statusCode).toBe(200);
    const denied = await action(created.id, 'approve', projectId, otherOrgToken);
    expect([403, 404]).toContain(denied.statusCode);
    const [persisted] = await getDb().select().from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, created.id), eq(purchaseOrders.organizationId, orgId)));
    expect(persisted?.status).toBe('PENDING_APPROVAL');
  });

  it('ignores client-supplied PO approval and amount fields', async () => {
    const response = await createPO(projectId, validPayload({
      status: 'APPROVED',
      approvedBy: actorUserId,
      approvedAt: '2026-01-01T00:00:00.000Z',
      totalAmount: '999999.99',
    }));
    expect(response.statusCode).toBe(201);
    const created = response.json().data;
    expect(created.status).toBe('DRAFT');
    expect(created.approvedBy).toBeNull();
    expect(created.approvedAt).toBeNull();
    expect(created.totalAmount).toBe('22.00');
  });

  it('uses distinct allocated document numbers for separate POs in one project', async () => {
    const first = await createPO();
    const second = await createPO();
    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.json().data.poNumber).not.toBe(second.json().data.poNumber);
  });

  it('preserves source-quote and quote-item references on a PO created from a quote', async () => {
    const quoteResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/quotes`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        supplierId,
        quoteDate: today,
        currencyCode: 'USD',
        items: [{ materialId, quantity: '3', unitCode: 'EA', unitPrice: '4.00' }],
      },
    });
    expect(quoteResponse.statusCode).toBe(201);
    const quote = quoteResponse.json().data;
    const quoteItemId = quote.items[0].id as string;
    const poResponse = await createPO(projectId, validPayload({
      sourceQuoteId: quote.id,
      items: [{
        materialId,
        quantity: quote.items[0].quantity,
        unitCode: quote.items[0].unitCode,
        unitPrice: quote.items[0].unitPrice,
        sourceQuoteItemId: quoteItemId,
      }],
    }));
    expect(poResponse.statusCode).toBe(201);
    expect(poResponse.json().data.sourceQuoteId).toBe(quote.id);
    expect(poResponse.json().data.items[0].sourceQuoteItemId).toBe(quoteItemId);
    expect(poResponse.json().data.items[0].quantity).toBe(quote.items[0].quantity);
    const persistedQuote = await getDb().select().from(quoteItems)
      .where(and(eq(quoteItems.id, quoteItemId), eq(quoteItems.organizationId, orgId)));
    expect(persistedQuote).toHaveLength(1);
  });

  it('returns the already-approved PO for a repeated approval after it has advanced', async () => {
    const created = await createPOData();
    expect((await action(created.id, 'submit')).statusCode).toBe(200);
    expect((await action(created.id, 'approve')).statusCode).toBe(200);
    const repeatedApprove = await action(created.id, 'approve');
    expect(repeatedApprove.statusCode).toBe(200);
    expect(repeatedApprove.json().data.status).toBe('APPROVED');
  });
});
