import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  inventoryTransactions,
  materials,
  outboxEvents,
  partnerPerformanceEvents,
  purchaseOrderItems,
  purchaseOrders,
  receiptItems,
  receipts,
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
  `/api/v1/organizations/${orgId}/projects/${projectId}/receipts`;
const id = () => crypto.randomUUID();

describe('Receipt flow (integration)', () => {
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
  let foreignMaterialId: string;
  const activeFailureTriggers = new Set<{ trigger: string; fn: string }>();

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
      name: `Receipt material ${code}`,
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
      legalName: `Receipt supplier ${code}`,
      displayName: `Receipt supplier ${code}`,
      status: 'ACTIVE',
    });
    return supplierId;
  }

  async function seedPo({
    organization = orgId,
    project = projectId,
    supplier = supplierId,
    material,
    quantity = '10',
  }: {
    organization?: string;
    project?: string;
    supplier?: string;
    material?: string;
    quantity?: string;
  } = {}) {
    const materialId = material ?? await ensureMaterial(organization, `RC-M-${runId}-${id().slice(0, 6)}`);
    const purchaseOrderId = id();
    const purchaseOrderItemId = id();
    await getDb().insert(purchaseOrders).values({
      id: purchaseOrderId,
      organizationId: organization,
      projectId: project,
      poNumber: `PO-RC-${runId}-${id().slice(0, 8)}`,
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
      materialId,
      quantity,
      unitCode: 'EA',
      unitPrice: '5.00',
      discountAmount: '0.00',
      taxAmount: '0.00',
      lineSubtotal: '50.00',
      lineTotal: '50.00',
    });
    return { purchaseOrderId, purchaseOrderItemId, materialId };
  }

  async function createReceipt(
    po: { purchaseOrderId: string; purchaseOrderItemId: string },
    values: {
      quantityDelivered?: string;
      quantityAccepted?: string;
      quantityRejected?: string;
      project?: string;
      auth?: string;
      organization?: string;
      itemId?: string;
    } = {},
  ) {
    return app.inject({
      method: 'POST',
      url: path(values.organization ?? orgId, values.project ?? projectId),
      headers: values.auth ? { authorization: `Bearer ${values.auth}` } : { authorization: `Bearer ${adminToken}` },
      payload: {
        purchaseOrderId: po.purchaseOrderId,
        receivedAt: new Date().toISOString(),
        items: [{
          purchaseOrderItemId: values.itemId ?? po.purchaseOrderItemId,
          quantityDelivered: values.quantityDelivered ?? '10',
          quantityAccepted: values.quantityAccepted ?? '8',
          quantityRejected: values.quantityRejected ?? '2',
          unitCode: 'EA',
          rejectionReason: 'Damaged packaging',
        }],
      },
    });
  }

  async function balance(materialId: string) {
    const result = await getDb().execute(sql`
      SELECT COALESCE(SUM(
        CASE WHEN transaction_type IN ('RECEIPT','RETURN','ADJUSTMENT_IN','TRANSFER_IN')
          THEN quantity ELSE -quantity END
      ), 0) AS balance
      FROM app.inventory_transactions
      WHERE organization_id = ${orgId}
        AND project_id = ${projectId}
        AND material_id = ${materialId}
    `);
    return Number((result.rows ?? result)[0]?.balance ?? 0);
  }

  async function scopedOutbox(eventType: string, receiptId: string) {
    return getDb().select().from(outboxEvents).where(and(
      eq(outboxEvents.eventType, eventType),
      eq(outboxEvents.organizationId, orgId),
      sql`${outboxEvents.payload} ->> 'receiptId' = ${receiptId}`,
    ));
  }

  async function failInventoryFor(receiptId: string) {
    const suffix = id().replaceAll('-', '').slice(0, 12);
    const trigger = `fail_receipt_inventory_${suffix}`;
    const fn = `fail_receipt_inventory_${suffix}`;
    await getDb().execute(sql.raw(`
      CREATE FUNCTION app.${fn}() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.source_type = 'RECEIPT' AND NEW.source_id = '${receiptId}' THEN
          RAISE EXCEPTION 'intentional receipt inventory test failure';
        END IF;
        RETURN NEW;
      END;
      $$
    `));
    await getDb().execute(sql.raw(`
      CREATE TRIGGER ${trigger}
      BEFORE INSERT ON app.inventory_transactions
      FOR EACH ROW EXECUTE FUNCTION app.${fn}()
    `));
    const ref = { trigger, fn };
    activeFailureTriggers.add(ref);
    return async () => {
      await getDb().execute(sql.raw(`DROP TRIGGER IF EXISTS ${trigger} ON app.inventory_transactions`));
      await getDb().execute(sql.raw(`DROP FUNCTION IF EXISTS app.${fn}()`));
      activeFailureTriggers.delete(ref);
    };
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `receipt_owner_${runId}@example.com` });
    adminToken = owner.token;
    orgId = (await createOrgWithAdmin(app, adminToken, `Receipt Org ${runId}`)).orgId;
    projectId = await createProject(orgId, adminToken, `Receipt Project ${runId}`);
    otherProjectId = await createProject(orgId, adminToken, `Receipt Other Project ${runId}`);

    const foreignOwner = await createVerifiedUser({ email: `receipt_foreign_${runId}@example.com` });
    foreignToken = foreignOwner.token;
    foreignOrgId = (await createOrgWithAdmin(app, foreignToken, `Receipt Foreign ${runId}`)).orgId;
    foreignProjectId = await createProject(foreignOrgId, foreignToken, `Receipt Foreign Project ${runId}`);
    supplierId = await ensureSupplier(orgId, `RC-S-${runId}`);
    foreignSupplierId = await ensureSupplier(foreignOrgId, `RC-S-F-${runId}`);
    foreignMaterialId = await ensureMaterial(foreignOrgId, `RC-M-F-${runId}`);
  }, 60000);

  afterAll(async () => {
    for (const ref of activeFailureTriggers) {
      await getDb().execute(sql.raw(`DROP TRIGGER IF EXISTS ${ref.trigger} ON app.inventory_transactions`));
      await getDb().execute(sql.raw(`DROP FUNCTION IF EXISTS app.${ref.fn}()`));
    }
    await app.close();
  });

  it('creates a valid draft receipt with an allocated number and persists its items', async () => {
    const po = await seedPo();
    const response = await createReceipt(po);
    expect(response.statusCode).toBe(201);
    const receipt = response.json().data;
    expect(receipt.status).toBe('DRAFT');
    expect(receipt.receiptNumber).toMatch(/^RC-\d{6}-\d{3}$/);
    expect(receipt.items).toHaveLength(1);

    const [persisted] = await getDb().select().from(receipts).where(eq(receipts.id, receipt.id));
    const persistedItems = await getDb().select().from(receiptItems).where(eq(receiptItems.receiptId, receipt.id));
    expect(persisted?.purchaseOrderId).toBe(po.purchaseOrderId);
    expect(persisted?.status).toBe('DRAFT');
    expect(persistedItems).toHaveLength(1);
    expect(persistedItems[0]?.quantityAccepted).toBe('8.000');
  });

  it('rejects invalid accepted/rejected totals, foreign PO items, empty items and unauthenticated creates', async () => {
    const po = await seedPo();
    const invalidTotal = await createReceipt(po, {
      quantityDelivered: '5',
      quantityAccepted: '4',
      quantityRejected: '2',
    });
    expect(invalidTotal.statusCode).toBe(422);

    const foreignPo = await seedPo({
      organization: foreignOrgId,
      project: foreignProjectId,
      supplier: foreignSupplierId,
      material: foreignMaterialId,
    });
    const foreignItem = await createReceipt(po, { itemId: foreignPo.purchaseOrderItemId });
    expect([404, 422]).toContain(foreignItem.statusCode);

    const empty = await app.inject({
      method: 'POST',
      url: path(orgId, projectId),
      headers: { authorization: `Bearer ${adminToken}` },
      payload: { purchaseOrderId: po.purchaseOrderId, receivedAt: new Date().toISOString(), items: [] },
    });
    expect(empty.statusCode).toBe(422);

    const unauthenticated = await app.inject({
      method: 'POST',
      url: path(orgId, projectId),
      payload: {
        purchaseOrderId: po.purchaseOrderId,
        receivedAt: new Date().toISOString(),
        items: [{ purchaseOrderItemId: po.purchaseOrderItemId, quantityDelivered: '1', quantityAccepted: '1', unitCode: 'EA' }],
      },
    });
    expect(unauthenticated.statusCode).toBe(401);
  });

  it('lists and gets receipts with populated items, cursor paging and project isolation', async () => {
    const firstPo = await seedPo();
    const secondPo = await seedPo();
    const otherProjectPo = await seedPo({ project: otherProjectId });
    const first = await createReceipt(firstPo);
    const second = await createReceipt(secondPo);
    const otherProjectReceipt = await createReceipt(otherProjectPo, { project: otherProjectId });
    expect([first.statusCode, second.statusCode, otherProjectReceipt.statusCode]).toEqual([201, 201, 201]);

    const list = await app.inject({
      method: 'GET',
      url: path(orgId, projectId),
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(list.statusCode).toBe(200);
    const entries = list.json().data as Array<{ id: string; items: unknown[] }>;
    expect(entries.some((entry) => entry.id === first.json().data.id)).toBe(true);
    expect(entries.some((entry) => entry.id === second.json().data.id)).toBe(true);
    expect(entries.some((entry) => entry.id === otherProjectReceipt.json().data.id)).toBe(false);
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

    const own = await app.inject({
      method: 'GET',
      url: `${path(orgId, projectId)}/${first.json().data.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(own.statusCode).toBe(200);
    expect(own.json().data.items).toHaveLength(1);
    const hidden = await app.inject({
      method: 'GET',
      url: `${path(orgId, projectId)}/${otherProjectReceipt.json().data.id}`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(hidden.statusCode).toBe(404);
  });

  it('posts accepted quantities only and records a scoped outbox, rejection event and audit record', async () => {
    const po = await seedPo();
    const draft = await createReceipt(po);
    expect(draft.statusCode).toBe(201);
    const receiptId = draft.json().data.id as string;
    const before = await balance(po.materialId);
    const posted = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${receiptId}/post`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(posted.statusCode).toBe(200);
    expect(posted.json().data.status).toBe('POSTED');
    expect(await balance(po.materialId)).toBe(before + 8);

    const transactions = await getDb().select().from(inventoryTransactions).where(and(
      eq(inventoryTransactions.organizationId, orgId),
      eq(inventoryTransactions.projectId, projectId),
      eq(inventoryTransactions.sourceId, receiptId),
      eq(inventoryTransactions.transactionType, 'RECEIPT'),
    ));
    expect(transactions).toHaveLength(1);
    expect(transactions[0]?.quantity).toBe('8.000');
    expect(await scopedOutbox('procurement.receipt.posted', receiptId)).toHaveLength(1);

    const perf = await getDb().select().from(partnerPerformanceEvents).where(and(
      eq(partnerPerformanceEvents.organizationId, orgId),
      eq(partnerPerformanceEvents.sourceType, 'RECEIPT'),
      eq(partnerPerformanceEvents.sourceId, receiptId),
      eq(partnerPerformanceEvents.eventType, 'RECEIPT_REJECTION'),
    ));
    expect(perf).toHaveLength(1);
    const audit = await getDb().select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, orgId),
      eq(auditLogs.action, 'receipt.posted'),
      eq(auditLogs.resourceId, receiptId),
    ));
    expect(audit).toHaveLength(1);

    const repeatedPost = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${receiptId}/post`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(repeatedPost.statusCode).toBe(422);
  });

  it('serializes concurrent posts for the same PO and prevents over-receipt', async () => {
    const po = await seedPo({ quantity: '10' });
    const first = await createReceipt(po, { quantityDelivered: '6', quantityAccepted: '6', quantityRejected: '0' });
    const second = await createReceipt(po, { quantityDelivered: '6', quantityAccepted: '6', quantityRejected: '0' });
    expect([first.statusCode, second.statusCode]).toEqual([201, 201]);
    const postUrl = (receiptId: string) => `${path(orgId, projectId)}/${receiptId}/post`;
    const concurrent = await Promise.all([
      app.inject({ method: 'POST', url: postUrl(first.json().data.id), headers: { authorization: `Bearer ${adminToken}` } }),
      app.inject({ method: 'POST', url: postUrl(second.json().data.id), headers: { authorization: `Bearer ${adminToken}` } }),
    ]);
    expect(concurrent.map((response) => response.statusCode).sort()).toEqual([200, 422]);
    const postedRows = await getDb().select().from(receipts).where(and(
      eq(receipts.organizationId, orgId),
      eq(receipts.purchaseOrderId, po.purchaseOrderId),
      eq(receipts.status, 'POSTED'),
    ));
    expect(postedRows).toHaveLength(1);
    expect(await balance(po.materialId)).toBe(6);
  });

  it('voids posted receipts with a reversing ledger entry, and rejects draft/double voids', async () => {
    const po = await seedPo();
    const draft = await createReceipt(po);
    const draftId = draft.json().data.id as string;
    const draftVoid = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${draftId}/void`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(draftVoid.statusCode).toBe(422);

    const posted = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${draftId}/post`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(posted.statusCode).toBe(200);
    const beforeVoid = await balance(po.materialId);
    expect(beforeVoid).toBe(8);
    const voided = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${draftId}/void`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(voided.statusCode).toBe(200);
    expect(voided.json().data.status).toBe('VOIDED');
    expect(await balance(po.materialId)).toBe(0);
    expect(await scopedOutbox('procurement.receipt.voided', draftId)).toHaveLength(1);

    const txns = await getDb().select().from(inventoryTransactions).where(and(
      eq(inventoryTransactions.organizationId, orgId),
      eq(inventoryTransactions.projectId, projectId),
      eq(inventoryTransactions.sourceId, draftId),
    ));
    expect(txns.map((txn) => txn.transactionType).sort()).toEqual(['ADJUSTMENT_OUT', 'RECEIPT']);
    expect(txns.find((txn) => txn.transactionType === 'RECEIPT')?.quantity).toBe('8.000');

    const audit = await getDb().select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, orgId),
      eq(auditLogs.action, 'receipt.voided'),
      eq(auditLogs.resourceId, draftId),
    ));
    expect(audit).toHaveLength(1);
    const secondVoid = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${draftId}/void`,
      headers: { authorization: `Bearer ${adminToken}` },
    });
    expect(secondVoid.statusCode).toBe(422);
  });

  it('allows exactly one concurrent void-or-post transition and hides the receipt from another tenant', async () => {
    const po = await seedPo();
    const draft = await createReceipt(po);
    const receiptId = draft.json().data.id as string;
    expect((await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${receiptId}/post`,
      headers: { authorization: `Bearer ${adminToken}` },
    })).statusCode).toBe(200);

    const concurrent = await Promise.all([
      app.inject({
        method: 'POST',
        url: `${path(orgId, projectId)}/${receiptId}/void`,
        headers: { authorization: `Bearer ${adminToken}` },
      }),
      app.inject({
        method: 'POST',
        url: `${path(orgId, projectId)}/${receiptId}/post`,
        headers: { authorization: `Bearer ${adminToken}` },
      }),
    ]);
    expect(concurrent.map((response) => response.statusCode).sort()).toEqual([200, 422]);

    const crossTenant = await app.inject({
      method: 'POST',
      url: `${path(orgId, projectId)}/${receiptId}/void`,
      headers: { authorization: `Bearer ${foreignToken}` },
    });
    expect([403, 404]).toContain(crossTenant.statusCode);
  });

  it('rolls back a receipt post when the inventory insert fails', async () => {
    const po = await seedPo();
    const draft = await createReceipt(po);
    expect(draft.statusCode).toBe(201);
    const receiptId = draft.json().data.id as string;
    const cleanup = await failInventoryFor(receiptId);
    try {
      const failed = await app.inject({
        method: 'POST',
        url: `${path(orgId, projectId)}/${receiptId}/post`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(failed.statusCode).toBe(500);
      const [persisted] = await getDb().select().from(receipts).where(eq(receipts.id, receiptId));
      expect(persisted?.status).toBe('DRAFT');
      const transactions = await getDb().select().from(inventoryTransactions).where(eq(inventoryTransactions.sourceId, receiptId));
      expect(transactions).toHaveLength(0);
      expect(await scopedOutbox('procurement.receipt.posted', receiptId)).toHaveLength(0);
    } finally {
      await cleanup();
    }
  });
});
