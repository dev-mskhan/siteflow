import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  deliveries,
  deliveryItems,
  materials,
  outboxEvents,
  partnerPerformanceEvents,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createTestApp } from '../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
const path = (orgId: string, projectId: string) =>
  `/api/v1/organizations/${orgId}/projects/${projectId}/deliveries`;
const id = () => crypto.randomUUID();

describe('Delivery flow (integration)', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let orgId: string;
  let projectId: string;
  let otherProjectId: string;
  let foreignOrgId: string;
  let foreignProjectId: string;
  let foreignToken: string;
  let supplierId: string;
  let foreignSupplierId: string;
  let materialId: string;
  let foreignMaterialId: string;

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
    const materialId = id();
    await getDb().insert(materials).values({
      id: materialId,
      organizationId: org,
      materialCode: code,
      name: `Delivery material ${code}`,
      defaultUnitCode: 'EA',
    });
    return materialId;
  }

  async function ensureSupplier(org: string, code: string): Promise<string> {
    const supplierId = id();
    await getDb().insert(suppliers).values({
      id: supplierId,
      organizationId: org,
      supplierCode: code,
      legalName: `Delivery supplier ${code}`,
      displayName: `Delivery supplier ${code}`,
      status: 'ACTIVE',
    });
    return supplierId;
  }

  async function seedSentPo({
    organization = orgId,
    project = projectId,
    supplier = supplierId,
    material = materialId,
    quantity = '10',
  }: {
    organization?: string;
    project?: string;
    supplier?: string;
    material?: string;
    quantity?: string;
  } = {}) {
    const purchaseOrderId = id();
    const purchaseOrderItemId = id();
    await getDb().insert(purchaseOrders).values({
      id: purchaseOrderId,
      organizationId: organization,
      projectId: project,
      poNumber: `PO-DL-${runId}-${id().slice(0, 8)}`,
      supplierId: supplier,
      status: 'SENT',
      orderDate: today,
      expectedDeliveryDate: '2035-12-31',
      currencyCode: 'USD',
      subtotal: '50.00',
      discountAmount: '0.00',
      taxAmount: '0.00',
      totalAmount: '50.00',
      sentAt: new Date(),
    });
    await getDb().insert(purchaseOrderItems).values({
      id: purchaseOrderItemId,
      organizationId: organization,
      purchaseOrderId,
      materialId: material,
      quantity,
      unitCode: 'EA',
      unitPrice: '5.00',
      discountAmount: '0.00',
      taxAmount: '0.00',
      lineSubtotal: '50.00',
      lineTotal: '50.00',
    });
    return { purchaseOrderId, purchaseOrderItemId };
  }

  async function createDelivery(
    purchaseOrderId: string,
    purchaseOrderItemId: string,
    quantity = '3',
    project = projectId,
    auth = adminToken,
    organization = orgId,
  ) {
    return app.inject({
      method: 'POST',
      url: path(organization, project),
      headers: { authorization: `Bearer ${auth}` },
      payload: {
        purchaseOrderId,
        scheduledDate: '2035-01-05',
        items: [{ purchaseOrderItemId, quantity, unitCode: 'EA' }],
      },
    });
  }

  async function getScopedOutbox(deliveryId: string) {
    return getDb().select().from(outboxEvents).where(and(
      eq(outboxEvents.eventType, 'procurement.delivery.delivered'),
      eq(outboxEvents.organizationId, orgId),
      sql`${outboxEvents.payload} ->> 'deliveryId' = ${deliveryId}`,
    ));
  }

  async function markDelivered(
    deliveryId: string,
    actualDeliveryDate: string,
    scheduledDate = '2035-01-05',
    project = projectId,
    auth = adminToken,
  ) {
    return app.inject({
      method: 'PATCH',
      url: `${path(orgId, project)}/${deliveryId}`,
      headers: { authorization: `Bearer ${auth}` },
      payload: { status: 'DELIVERED', scheduledDate, actualDeliveryDate },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `delivery_owner_${runId}@example.com` });
    adminToken = owner.token;
    orgId = (await createOrgWithAdmin(app, adminToken, `Delivery Org ${runId}`)).orgId;
    projectId = await createProject(orgId, adminToken, `Delivery Project ${runId}`);
    otherProjectId = await createProject(orgId, adminToken, `Delivery Other Project ${runId}`);

    const foreignOwner = await createVerifiedUser({ email: `delivery_foreign_${runId}@example.com` });
    foreignToken = foreignOwner.token;
    foreignOrgId = (await createOrgWithAdmin(app, foreignToken, `Delivery Foreign ${runId}`)).orgId;
    foreignProjectId = await createProject(foreignOrgId, foreignToken, `Delivery Foreign Project ${runId}`);

    supplierId = await ensureSupplier(orgId, `DL-S-${runId}`);
    foreignSupplierId = await ensureSupplier(foreignOrgId, `DL-S-F-${runId}`);
    materialId = await ensureMaterial(orgId, `DL-M-${runId}`);
    foreignMaterialId = await ensureMaterial(foreignOrgId, `DL-M-F-${runId}`);
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('creates a delivery for a SENT PO and persists its number, item and audit record', async () => {
    const po = await seedSentPo();
    const result = await createDelivery(po.purchaseOrderId, po.purchaseOrderItemId);
    expect(result.statusCode).toBe(201);
    const body = result.json().data;
    expect(body.status).toBe('SCHEDULED');
    expect(body.deliveryNumber).toMatch(/^DL-\d{6}-\d{3}$/);
    expect(body.items).toHaveLength(1);

    const [persisted] = await getDb().select().from(deliveries).where(eq(deliveries.id, body.id));
    const items = await getDb().select().from(deliveryItems).where(eq(deliveryItems.deliveryId, body.id));
    expect(persisted?.purchaseOrderId).toBe(po.purchaseOrderId);
    expect(persisted?.status).toBe('SCHEDULED');
    expect(items).toHaveLength(1);
    expect(items[0]?.quantity).toBe('3.000');
    expect((await getDb().select().from(purchaseOrders).where(eq(purchaseOrders.id, po.purchaseOrderId)))[0]?.status).toBe('SENT');

    const audit = await getDb().select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, orgId),
      eq(auditLogs.action, 'delivery.created'),
      eq(auditLogs.resourceId, body.id),
    ));
    expect(audit).toHaveLength(1);
  });

  it('rejects over-delivery, a foreign PO item, empty item lists and unauthenticated creates', async () => {
    const po = await seedSentPo();
    const first = await createDelivery(po.purchaseOrderId, po.purchaseOrderItemId, '8');
    expect(first.statusCode).toBe(201);
    const overLimit = await createDelivery(po.purchaseOrderId, po.purchaseOrderItemId, '3');
    expect(overLimit.statusCode).toBe(422);

    const foreignPo = await seedSentPo({
      organization: foreignOrgId,
      project: foreignProjectId,
      supplier: foreignSupplierId,
      material: foreignMaterialId,
      quantity: '4',
    });
    const foreignItem = await createDelivery(po.purchaseOrderId, foreignPo.purchaseOrderItemId, '2');
    expect([404, 422]).toContain(foreignItem.statusCode);

    const empty = await app.inject({
      method: 'POST',
      url: path(orgId, projectId),
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { purchaseOrderId: po.purchaseOrderId, items: [] },
    });
    expect(empty.statusCode).toBe(422);

    const unauthenticated = await app.inject({
      method: 'POST',
      url: path(orgId, projectId),
      payload: {
        purchaseOrderId: po.purchaseOrderId,
        items: [{ purchaseOrderItemId: po.purchaseOrderItemId, quantity: '1', unitCode: 'EA' }],
      },
    });
    expect(unauthenticated.statusCode).toBe(401);
  });

  it('lists and gets deliveries by project with item arrays and cursor pagination', async () => {
    const firstPo = await seedSentPo();
    const secondPo = await seedSentPo();
    const otherProjectPo = await seedSentPo({ project: otherProjectId });
    const first = await createDelivery(firstPo.purchaseOrderId, firstPo.purchaseOrderItemId, '1');
    const second = await createDelivery(secondPo.purchaseOrderId, secondPo.purchaseOrderItemId, '1');
    const otherProjectDelivery = await createDelivery(
      otherProjectPo.purchaseOrderId,
      otherProjectPo.purchaseOrderItemId,
      '1',
      otherProjectId,
    );
    expect([first.statusCode, second.statusCode, otherProjectDelivery.statusCode]).toEqual([201, 201, 201]);

    const list = await app.inject({
      method: 'GET',
      url: path(orgId, projectId),
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(list.statusCode).toBe(200);
    const entries = list.json().data as Array<{ id: string; items: unknown[] }>;
    expect(entries.some((entry) => entry.id === first.json().data.id)).toBe(true);
    expect(entries.some((entry) => entry.id === second.json().data.id)).toBe(true);
    expect(entries.some((entry) => entry.id === otherProjectDelivery.json().data.id)).toBe(false);
    expect(entries.find((entry) => entry.id === first.json().data.id)?.items).toHaveLength(1);

    const page1 = await app.inject({
      method: 'GET',
      url: `${path(orgId, projectId)}?limit=1`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(page1.statusCode).toBe(200);
    const cursor = page1.json().meta.nextCursor as string;
    expect(cursor).toBeTruthy();
    const page2 = await app.inject({
      method: 'GET',
      url: `${path(orgId, projectId)}?limit=1&cursor=${encodeURIComponent(cursor)}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(page2.statusCode).toBe(200);
    expect(page2.json().data[0].id).not.toBe(page1.json().data[0].id);

    const getOwn = await app.inject({
      method: 'GET',
      url: `${path(orgId, projectId)}/${first.json().data.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(getOwn.statusCode).toBe(200);
    expect(getOwn.json().data.items).toHaveLength(1);
    const hidden = await app.inject({
      method: 'GET',
      url: `${path(orgId, projectId)}/${otherProjectDelivery.json().data.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(hidden.statusCode).toBe(404);
  });

  it('records late and on-time delivery events, an outbox event and audit updates once', async () => {
    const latePo = await seedSentPo();
    const lateDelivery = await createDelivery(latePo.purchaseOrderId, latePo.purchaseOrderItemId);
    expect(lateDelivery.statusCode).toBe(201);
    const lateId = lateDelivery.json().data.id as string;
    const late = await markDelivered(lateId, '2035-01-07');
    expect(late.statusCode).toBe(200);
    expect(late.json().data.status).toBe('DELIVERED');
    expect(late.json().data.actualDeliveryDate).toBe('2035-01-07');

    const lateEvents = await getDb().select().from(partnerPerformanceEvents).where(and(
      eq(partnerPerformanceEvents.organizationId, orgId),
      eq(partnerPerformanceEvents.sourceType, 'DELIVERY'),
      eq(partnerPerformanceEvents.sourceId, lateId),
      eq(partnerPerformanceEvents.eventType, 'DELIVERY_LATE'),
    ));
    expect(lateEvents).toHaveLength(1);
    expect(await getScopedOutbox(lateId)).toHaveLength(1);

    const repeat = await markDelivered(lateId, '2035-01-07');
    expect(repeat.statusCode).toBe(200);
    expect(await getScopedOutbox(lateId)).toHaveLength(1);

    const onTimePo = await seedSentPo();
    const onTimeDelivery = await createDelivery(onTimePo.purchaseOrderId, onTimePo.purchaseOrderItemId);
    expect(onTimeDelivery.statusCode).toBe(201);
    const onTimeId = onTimeDelivery.json().data.id as string;
    expect((await markDelivered(onTimeId, '2035-01-05')).statusCode).toBe(200);
    const onTimeEvents = await getDb().select().from(partnerPerformanceEvents).where(and(
      eq(partnerPerformanceEvents.organizationId, orgId),
      eq(partnerPerformanceEvents.sourceType, 'DELIVERY'),
      eq(partnerPerformanceEvents.sourceId, onTimeId),
      eq(partnerPerformanceEvents.eventType, 'DELIVERY_ON_TIME'),
    ));
    expect(onTimeEvents).toHaveLength(1);

    const audit = await getDb().select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, orgId),
      eq(auditLogs.action, 'delivery.updated'),
      eq(auditLogs.resourceId, lateId),
    ));
    expect(audit.length).toBeGreaterThan(0);
  });

  it('rejects invalid delivery transitions and cross-tenant updates', async () => {
    const po = await seedSentPo();
    const created = await createDelivery(po.purchaseOrderId, po.purchaseOrderItemId);
    expect(created.statusCode).toBe(201);
    const deliveryId = created.json().data.id as string;
    const cancelled = await app.inject({
      method: 'PATCH',
      url: `${path(orgId, projectId)}/${deliveryId}`,
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { status: 'CANCELLED' },
    });
    expect(cancelled.statusCode).toBe(200);
    const invalidTransition = await markDelivered(deliveryId, '2035-01-07');
    expect(invalidTransition.statusCode).toBe(422);

    const crossTenant = await app.inject({
      method: 'PATCH',
      url: `${path(orgId, projectId)}/${deliveryId}`,
      headers: { authorization: `Bearer ${foreignToken}` },
      payload: { status: 'DELIVERED' },
    });
    expect([403, 404]).toContain(crossTenant.statusCode);
  });
});
