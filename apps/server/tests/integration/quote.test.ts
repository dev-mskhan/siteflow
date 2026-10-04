import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import {
  materials,
  materialRequestItems,
  materialRequests,
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
const quotePath = (orgId: string, projectId: string) =>
  `/api/v1/organizations/${orgId}/projects/${projectId}/quotes`;

describe('Quotes (integration)', () => {
  let app: FastifyInstance;
  let token: string;
  let orgId: string;
  let projectId: string;
  let otherProjectId: string;
  let otherOrgId: string;
  let otherOrgToken: string;
  let supplierId: string;
  let inactiveSupplierId: string;
  let foreignSupplierId: string;
  let materialId: string;
  let foreignMaterialId: string;

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
      quoteDate: today,
      validUntil: '2035-12-31',
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

  async function createQuote(
    project = projectId,
    payload: Record<string, unknown> = validPayload(),
    auth = token,
  ) {
    return app.inject({
      method: 'POST',
      url: quotePath(orgId, project),
      headers: { authorization: `Bearer ${auth}` },
      payload,
    });
  }

  async function createQuoteData(
    project = projectId,
    payload: Record<string, unknown> = validPayload(),
  ) {
    const response = await createQuote(project, payload);
    expect(response.statusCode).toBe(201);
    return response.json().data;
  }

  async function createRequest(): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/material-requests`,
      headers: { authorization: `Bearer ${token}` },
      payload: { items: [{ materialId, quantity: '2', unitCode: 'EA' }] },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data.id as string;
  }

  async function submitQuote(quoteId: string) {
    return app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${quoteId}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });
  }

  async function event(eventType: string, quoteId: string) {
    const rows = await getDb().execute(sql`
      SELECT id, event_type, organization_id, payload
      FROM app.outbox_events
      WHERE event_type = ${eventType}
        AND organization_id = ${orgId}
        AND payload ->> 'quoteId'::text = ${quoteId}
    `);
    return Array.from(rows as unknown as Iterable<unknown>);
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `quote_owner_${runId}@example.com` });
    token = owner.token;
    orgId = (await createOrgWithAdmin(app, token, `Quote Org ${runId}`)).orgId;
    projectId = await createProject(orgId, token, `Quote Project ${runId}`);
    otherProjectId = await createProject(orgId, token, `Quote Other Project ${runId}`);

    const foreign = await createVerifiedUser({ email: `quote_foreign_${runId}@example.com` });
    otherOrgToken = foreign.token;
    otherOrgId = (await createOrgWithAdmin(app, otherOrgToken, `Quote Foreign Org ${runId}`)).orgId;

    supplierId = crypto.randomUUID();
    inactiveSupplierId = crypto.randomUUID();
    foreignSupplierId = crypto.randomUUID();
    materialId = crypto.randomUUID();
    foreignMaterialId = crypto.randomUUID();
    await getDb().insert(suppliers).values([
      {
        id: supplierId,
        organizationId: orgId,
        supplierCode: `Q-${runId}`,
        legalName: `Quote Supplier ${runId}`,
        displayName: `Quote Supplier ${runId}`,
        status: 'ACTIVE',
      },
      {
        id: inactiveSupplierId,
        organizationId: orgId,
        supplierCode: `QI-${runId}`,
        legalName: `Inactive Quote Supplier ${runId}`,
        displayName: `Inactive Quote Supplier ${runId}`,
        status: 'INACTIVE',
      },
      {
        id: foreignSupplierId,
        organizationId: otherOrgId,
        supplierCode: `QF-${runId}`,
        legalName: `Foreign Quote Supplier ${runId}`,
        displayName: `Foreign Quote Supplier ${runId}`,
        status: 'ACTIVE',
      },
    ]);
    await getDb().insert(materials).values([
      {
        id: materialId,
        organizationId: orgId,
        materialCode: `QM-${runId}`,
        name: `Quote material ${runId}`,
        defaultUnitCode: 'EA',
      },
      {
        id: foreignMaterialId,
        organizationId: otherOrgId,
        materialCode: `QMF-${runId}`,
        name: `Foreign quote material ${runId}`,
        defaultUnitCode: 'EA',
      },
    ]);
  }, 90000);

  afterAll(async () => {
    await app.close();
  });

  it('creates a quote with server-computed line and document totals and a monthly document number', async () => {
    const response = await createQuote(projectId, validPayload({ totalAmount: '0.01' }));
    expect(response.statusCode).toBe(201);
    const created = response.json().data;
    expect(created.status).toBe('DRAFT');
    expect(created.quoteNumber).toMatch(/^QT-\d{6}-\d{3}$/);
    expect(created.subtotal).toBe('21.00');
    expect(created.discountAmount).toBe('1.00');
    expect(created.taxAmount).toBe('2.00');
    expect(created.totalAmount).toBe('22.00');
    expect(created.items[0].lineTotal).toBe('22.00');
    const [persisted] = await getDb().select().from(quotes)
      .where(and(eq(quotes.id, created.id), eq(quotes.organizationId, orgId)));
    expect(persisted?.totalAmount).toBe('22.00');
    const persistedItems = await getDb().select().from(quoteItems)
      .where(and(eq(quoteItems.quoteId, created.id), eq(quoteItems.organizationId, orgId)));
    expect(persistedItems).toHaveLength(1);
    expect(persistedItems[0]?.lineSubtotal).toBe('21.00');
    expect(persistedItems[0]?.lineTotal).toBe('22.00');
  });

  it('rejects supplier IDs from another tenant and suppliers that are inactive', async () => {
    const foreignSupplier = await createQuote(projectId, validPayload({ supplierId: foreignSupplierId }));
    expect([404, 422]).toContain(foreignSupplier.statusCode);
    const inactive = await createQuote(projectId, validPayload({ supplierId: inactiveSupplierId }));
    expect(inactive.statusCode).toBe(422);
  });

  it.each([
    ['an empty items array', { items: [] }],
    ['an invalid decimal price', { items: [{ materialId, quantity: '1', unitCode: 'EA', unitPrice: '1.234' }] }],
  ])('rejects quote creation with %s', async (_label, overrides) => {
    const response = await createQuote(projectId, validPayload(overrides));
    expect(response.statusCode).toBe(422);
  });

  it('requires authentication to create a quote', async () => {
    const response = await app.inject({
      method: 'POST',
      url: quotePath(orgId, projectId),
      payload: validPayload(),
    });
    expect(response.statusCode).toBe(401);
  });

  it('lists own-project quotes only, filters status, paginates, and bulk-populates items', async () => {
    const first = await createQuoteData();
    const second = await createQuoteData(projectId, validPayload({
      items: [
        { materialId, quantity: '1', unitCode: 'EA', unitPrice: '3.00' },
        { materialId, quantity: '2', unitCode: 'EA', unitPrice: '4.00' },
      ],
    }));
    const foreignProject = await createQuoteData(otherProjectId);
    const submitted = await createQuoteData();
    expect((await submitQuote(submitted.id)).statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: quotePath(orgId, projectId),
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    const data = list.json().data as Array<{ id: string; items: unknown[] }>;
    expect(data.some((quote) => quote.id === first.id)).toBe(true);
    expect(data.some((quote) => quote.id === second.id)).toBe(true);
    expect(data.some((quote) => quote.id === foreignProject.id)).toBe(false);
    expect(data.find((quote) => quote.id === first.id)?.items).toHaveLength(1);
    expect(data.find((quote) => quote.id === second.id)?.items).toHaveLength(2);

    const filtered = await app.inject({
      method: 'GET',
      url: `${quotePath(orgId, projectId)}?status=SUBMITTED`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().data.some((quote: { id: string }) => quote.id === submitted.id)).toBe(true);
    expect(filtered.json().data.some((quote: { id: string }) => quote.id === first.id)).toBe(false);

    const page1 = await app.inject({
      method: 'GET',
      url: `${quotePath(orgId, projectId)}?limit=1`,
      headers: { authorization: `Bearer ${token}` },
    });
    const cursor = page1.json().meta.nextCursor as string;
    expect(page1.statusCode).toBe(200);
    expect(cursor).toBeTruthy();
    const page2 = await app.inject({
      method: 'GET',
      url: `${quotePath(orgId, projectId)}?limit=1&cursor=${encodeURIComponent(cursor)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(page2.statusCode).toBe(200);
    expect(page2.json().data[0].id).not.toBe(page1.json().data[0].id);
  });

  it('gets an own quote with its items and hides another project quote by explicit ID', async () => {
    const own = await createQuoteData();
    const other = await createQuoteData(otherProjectId);
    const ownResponse = await app.inject({
      method: 'GET',
      url: `${quotePath(orgId, projectId)}/${own.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ownResponse.statusCode).toBe(200);
    expect(ownResponse.json().data.items).toHaveLength(1);
    const hidden = await app.inject({
      method: 'GET',
      url: `${quotePath(orgId, projectId)}/${other.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(hidden.statusCode).toBe(404);
  });

  it('updates a DRAFT quote and rejects changes after acceptance', async () => {
    const draft = await createQuoteData();
    const update = await app.inject({
      method: 'PATCH',
      url: `${quotePath(orgId, projectId)}/${draft.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { notes: 'revised before submission' },
    });
    expect(update.statusCode).toBe(200);
    const [persisted] = await getDb().select().from(quotes)
      .where(and(eq(quotes.id, draft.id), eq(quotes.organizationId, orgId)));
    expect(persisted?.notes).toBe('revised before submission');

    const accepted = await createQuoteData();
    expect((await submitQuote(accepted.id)).statusCode).toBe(200);
    expect((await app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${accepted.id}/accept`,
      headers: { authorization: `Bearer ${token}` },
    })).statusCode).toBe(200);
    const forbiddenUpdate = await app.inject({
      method: 'PATCH',
      url: `${quotePath(orgId, projectId)}/${accepted.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { notes: 'must not mutate accepted quote' },
    });
    expect(forbiddenUpdate.statusCode).toBe(422);
  });

  it('submits a quote once with persisted timestamp and a resource-scoped outbox event', async () => {
    const created = await createQuoteData();
    const response = await submitQuote(created.id);
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('SUBMITTED');
    expect(response.json().data.submittedAt).not.toBeNull();
    const [persisted] = await getDb().select().from(quotes)
      .where(and(eq(quotes.id, created.id), eq(quotes.organizationId, orgId)));
    expect(persisted?.status).toBe('SUBMITTED');
    expect(persisted?.submittedAt).toBeInstanceOf(Date);
    expect(await event('procurement.quote.submitted', created.id)).toHaveLength(1);
    expect((await submitQuote(created.id)).statusCode).toBe(422);
  });

  it('serializes concurrent submissions so only one transitions the quote', async () => {
    const created = await createQuoteData();
    const url = `${quotePath(orgId, projectId)}/${created.id}/submit`;
    const results = await Promise.all([
      app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } }),
      app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } }),
    ]);
    expect.soft(results.map((result) => result.statusCode).sort()).toEqual([200, 422]);
    const [persisted] = await getDb().select().from(quotes)
      .where(and(eq(quotes.id, created.id), eq(quotes.organizationId, orgId)));
    expect(persisted?.status).toBe('SUBMITTED');
  });

  it('accepts a submitted quote idempotently and writes its accepted event once', async () => {
    const created = await createQuoteData();
    expect((await submitQuote(created.id)).statusCode).toBe(200);
    const url = `${quotePath(orgId, projectId)}/${created.id}/accept`;
    const accepted = await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.json().data.status).toBe('ACCEPTED');
    expect(accepted.json().data.acceptedAt).not.toBeNull();
    expect((await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } })).statusCode).toBe(200);
    const [persisted] = await getDb().select().from(quotes)
      .where(and(eq(quotes.id, created.id), eq(quotes.organizationId, orgId)));
    expect(persisted?.status).toBe('ACCEPTED');
    expect(persisted?.acceptedAt).toBeInstanceOf(Date);
    expect(await event('procurement.quote.accepted', created.id)).toHaveLength(1);
  });

  it('rejects expired quotes and prevents accepting a second quote for the same request', async () => {
    const expired = await createQuoteData(projectId, validPayload({
      quoteDate: '2020-01-01',
      validUntil: '2020-01-02',
    }));
    expect((await submitQuote(expired.id)).statusCode).toBe(200);
    const expiredAccept = await app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${expired.id}/accept`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(expiredAccept.statusCode).toBe(422);

    const materialRequestId = await createRequest();
    const first = await createQuoteData(projectId, validPayload({ materialRequestId }));
    const second = await createQuoteData(projectId, validPayload({ materialRequestId }));
    expect((await submitQuote(first.id)).statusCode).toBe(200);
    expect((await submitQuote(second.id)).statusCode).toBe(200);
    expect((await app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${first.id}/accept`,
      headers: { authorization: `Bearer ${token}` },
    })).statusCode).toBe(200);
    const rejectedSecond = await app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${second.id}/accept`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rejectedSecond.statusCode).toBe(409);
  });

  it('prevents two concurrent quote acceptances for the same material request', async () => {
    const materialRequestId = await createRequest();
    const first = await createQuoteData(projectId, validPayload({ materialRequestId }));
    const second = await createQuoteData(projectId, validPayload({ materialRequestId }));
    expect((await submitQuote(first.id)).statusCode).toBe(200);
    expect((await submitQuote(second.id)).statusCode).toBe(200);
    const accept = (quoteId: string) => app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${quoteId}/accept`,
      headers: { authorization: `Bearer ${token}` },
    });
    const results = await Promise.all([accept(first.id), accept(second.id)]);
    const accepted = await getDb().select().from(quotes)
      .where(and(
        eq(quotes.organizationId, orgId),
        eq(quotes.projectId, projectId),
        eq(quotes.materialRequestId, materialRequestId),
        eq(quotes.status, 'ACCEPTED'),
      ));
    expect.soft(results.map((result) => result.statusCode).sort()).toEqual([200, 409]);
    expect(accepted).toHaveLength(1);
  });

  it('rejects submitted and draft quotes, but does not permit reversing acceptance', async () => {
    const submitted = await createQuoteData();
    expect((await submitQuote(submitted.id)).statusCode).toBe(200);
    const rejectSubmitted = await app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${submitted.id}/reject`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rejectSubmitted.statusCode).toBe(200);
    expect(rejectSubmitted.json().data.status).toBe('REJECTED');
    expect(await event('procurement.quote.rejected', submitted.id)).toHaveLength(1);

    const draft = await createQuoteData();
    const rejectDraft = await app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${draft.id}/reject`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rejectDraft.statusCode).toBe(200);
    expect(rejectDraft.json().data.status).toBe('REJECTED');

    const accepted = await createQuoteData();
    expect((await submitQuote(accepted.id)).statusCode).toBe(200);
    expect((await app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${accepted.id}/accept`,
      headers: { authorization: `Bearer ${token}` },
    })).statusCode).toBe(200);
    const rejectAccepted = await app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${accepted.id}/reject`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(rejectAccepted.statusCode).toBe(422);
  });

  it('ignores privileged quote fields and denies a foreign tenant access to an owned quote', async () => {
    const response = await createQuote(projectId, validPayload({
      status: 'ACCEPTED',
      acceptedAt: '2026-01-01T00:00:00.000Z',
      totalAmount: '999999.99',
    }));
    expect(response.statusCode).toBe(201);
    const quoteId = response.json().data.id as string;
    expect(response.json().data.status).toBe('DRAFT');
    expect(response.json().data.totalAmount).toBe('22.00');
    const denied = await app.inject({
      method: 'POST',
      url: `${quotePath(orgId, projectId)}/${quoteId}/accept`,
      headers: { authorization: `Bearer ${otherOrgToken}` },
    });
    expect([403, 404]).toContain(denied.statusCode);
    const [persisted] = await getDb().select().from(quotes)
      .where(and(eq(quotes.id, quoteId), eq(quotes.organizationId, orgId)));
    expect(persisted?.status).toBe('DRAFT');
  });

  it('links quote line items to material-request items when supplied', async () => {
    const materialRequestId = await createRequest();
    const [mrItem] = await getDb().select().from(materialRequestItems)
      .where(eq(materialRequestItems.materialRequestId, materialRequestId));
    const response = await createQuote(projectId, validPayload({
      materialRequestId,
      items: [{
        materialRequestItemId: mrItem!.id,
        materialId,
        quantity: '2',
        unitCode: 'EA',
        unitPrice: '5.00',
      }],
    }));
    expect(response.statusCode).toBe(201);
    expect(response.json().data.items[0].materialRequestItemId).toBe(mrItem!.id);
    const [persistedMR] = await getDb().select().from(materialRequests)
      .where(and(eq(materialRequests.id, materialRequestId), eq(materialRequests.organizationId, orgId)));
    expect(persistedMR?.projectId).toBe(projectId);
  });
});
