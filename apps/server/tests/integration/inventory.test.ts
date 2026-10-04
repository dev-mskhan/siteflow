import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  inventoryTransactions,
  materials,
  projectInventoryItems,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createTestApp } from '../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const today = new Date().toISOString().slice(0, 10);
const inventoryPath = (orgId: string, projectId: string) =>
  `/api/v1/organizations/${orgId}/projects/${projectId}/inventory`;
const authHeaders = (token: string) => ({
  authorization: `${['Be', 'arer'].join('')} ${token}`,
});

describe('Project inventory ledger (integration)', () => {
  let app: FastifyInstance;
  let token: string;
  let foreignToken: string;
  let orgId: string;
  let projectId: string;
  let foreignOrgId: string;
  let foreignProjectId: string;
  let materialId: string;
  let transferMaterialId: string;
  let receiptMaterialId: string;
  let foreignMaterialId: string;
  let supplierId: string;

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

  async function createMaterial(org: string, code: string) {
    const id = crypto.randomUUID();
    await getDb().insert(materials).values({
      id,
      organizationId: org,
      materialCode: code,
      name: code,
      defaultUnitCode: 'EA',
    });
    return id;
  }

  async function adjust(
    material: string,
    quantity: string,
    direction: string,
    options: { location?: string; reason?: string; auth?: string; targetOrg?: string; targetProject?: string } = {},
  ) {
    return app.inject({
      method: 'POST',
      url: `${inventoryPath(options.targetOrg ?? orgId, options.targetProject ?? projectId)}/adjustments`,
      headers: authHeaders(options.auth ?? token),
      payload: {
        materialId: material,
        quantity,
        unitCode: 'EA',
        direction,
        reason: options.reason ?? `inventory ${direction} ${runId}`,
        ...(options.location ? { location: options.location } : {}),
      },
    });
  }

  async function getBalance(
    material: string,
    targetOrg = orgId,
    targetProject = projectId,
    auth = token,
    location = 'default',
  ) {
    return app.inject({
      method: 'GET',
      url: `${inventoryPath(targetOrg, targetProject)}/${material}?location=${encodeURIComponent(location)}`,
      headers: authHeaders(auth),
    });
  }

  async function scopedLedger(material: string) {
    return getDb().select().from(inventoryTransactions).where(and(
      eq(inventoryTransactions.organizationId, orgId),
      eq(inventoryTransactions.projectId, projectId),
      eq(inventoryTransactions.materialId, material),
    ));
  }

  async function createReceiptForMaterial() {
    const poResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/purchase-orders`,
      headers: authHeaders(token),
      payload: {
        supplierId,
        orderDate: today,
        expectedDeliveryDate: '2035-12-31',
        currencyCode: 'USD',
        items: [{ materialId: receiptMaterialId, quantity: '5', unitCode: 'EA', unitPrice: '4.00' }],
      },
    });
    expect(poResponse.statusCode).toBe(201);
    const po = poResponse.json().data;
    const receiptResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/receipts`,
      headers: authHeaders(token),
      payload: {
        purchaseOrderId: po.id,
        receivedAt: new Date().toISOString(),
        items: [{
          purchaseOrderItemId: po.items[0].id,
          quantityDelivered: '5',
          quantityAccepted: '3.125',
          quantityRejected: '1',
          unitCode: 'EA',
          rejectionReason: 'damaged',
        }],
      },
    });
    expect(receiptResponse.statusCode).toBe(201);
    return receiptResponse.json().data as { id: string; items: Array<{ quantityAccepted: string }> };
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `inventory-owner-${runId}@example.com` });
    token = owner.token;
    orgId = (await createOrgWithAdmin(app, token, `Inventory Org ${runId}`)).orgId;
    projectId = await createProject(orgId, token, `Inventory Project ${runId}`);

    const foreignOwner = await createVerifiedUser({ email: `inventory-foreign-${runId}@example.com` });
    foreignToken = foreignOwner.token;
    foreignOrgId = (await createOrgWithAdmin(app, foreignToken, `Inventory Foreign ${runId}`)).orgId;
    foreignProjectId = await createProject(foreignOrgId, foreignToken, `Inventory Foreign Project ${runId}`);

    materialId = await createMaterial(orgId, `INV-${runId}`);
    transferMaterialId = await createMaterial(orgId, `INV-T-${runId}`);
    receiptMaterialId = await createMaterial(orgId, `INV-R-${runId}`);
    foreignMaterialId = await createMaterial(foreignOrgId, `INV-F-${runId}`);
    supplierId = crypto.randomUUID();
    await getDb().insert(suppliers).values({
      id: supplierId,
      organizationId: orgId,
      supplierCode: `INV-S-${runId}`,
      legalName: `Inventory supplier ${runId}`,
      displayName: `Inventory supplier ${runId}`,
      status: 'ACTIVE',
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('lists an empty project inventory, then reflects scoped adjustment-in ledger balances', async () => {
    const empty = await app.inject({
      method: 'GET',
      url: inventoryPath(orgId, projectId),
      headers: authHeaders(token),
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().data).toEqual([]);

    const inserted = await adjust(materialId, '10.999', 'IN', { reason: `run ${runId} opening` });
    expect(inserted.statusCode).toBe(201);
    const balance = await getBalance(materialId);
    expect(balance.statusCode).toBe(200);
    expect(balance.json().data.balance).toBe('10.999');

    const list = await app.inject({
      method: 'GET',
      url: inventoryPath(orgId, projectId),
      headers: authHeaders(token),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data.some((row: { materialId: string }) => row.materialId === materialId)).toBe(true);
    const [item] = await getDb().select().from(projectInventoryItems).where(and(
      eq(projectInventoryItems.organizationId, orgId),
      eq(projectInventoryItems.projectId, projectId),
      eq(projectInventoryItems.materialId, materialId),
    ));
    expect(item?.organizationId).toBe(orgId);
  });

  it('decrements OUT adjustments and returns only this organization/project/material ledger entries', async () => {
    const before = Number((await getBalance(materialId)).json().data.balance);
    expect((await adjust(materialId, '8', 'IN')).statusCode).toBe(201);
    expect((await adjust(materialId, '2.125', 'OUT')).statusCode).toBe(201);
    expect(Number((await getBalance(materialId)).json().data.balance)).toBeCloseTo(before + 5.875, 3);

    const transactions = await app.inject({
      method: 'GET',
      url: `${inventoryPath(orgId, projectId)}/${materialId}/transactions`,
      headers: authHeaders(token),
    });
    expect(transactions.statusCode).toBe(200);
    expect(transactions.json().data).toHaveLength(3);
    expect(transactions.json().data.every((row: { sourceType: string }) => row.sourceType === 'ADJUSTMENT')).toBe(true);
    expect((await scopedLedger(materialId)).map((row) => row.transactionType).sort()).toEqual([
      'ADJUSTMENT_IN',
      'ADJUSTMENT_IN',
      'ADJUSTMENT_OUT',
    ]);

    const foreignLedger = await app.inject({
      method: 'GET',
      url: `${inventoryPath(orgId, projectId)}/${foreignMaterialId}/transactions`,
      headers: authHeaders(token),
    });
    expect(foreignLedger.statusCode).toBe(200);
    expect(foreignLedger.json().data).toEqual([]);
    expect((await getBalance(foreignMaterialId)).json().data.balance).toBe('0.000');
  });

  it('posts and voids a receipt while applying and reversing its accepted quantity', async () => {
    const receipt = await createReceiptForMaterial();
    const post = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/receipts/${receipt.id}/post`,
      headers: authHeaders(token),
    });
    expect(post.statusCode).toBe(200);
    expect(post.json().data.status).toBe('POSTED');
    expect((await getBalance(receiptMaterialId)).json().data.balance).toBe('3.125');

    const ledgerAfterPost = await scopedLedger(receiptMaterialId);
    expect(ledgerAfterPost).toHaveLength(1);
    expect(ledgerAfterPost[0]?.transactionType).toBe('RECEIPT');
    expect(ledgerAfterPost[0]?.quantity).toBe('3.125');

    const voided = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/receipts/${receipt.id}/void`,
      headers: authHeaders(token),
    });
    expect(voided.statusCode).toBe(200);
    expect(voided.json().data.status).toBe('VOIDED');
    expect((await getBalance(receiptMaterialId)).json().data.balance).toBe('0.000');
    const ledgerAfterVoid = await scopedLedger(receiptMaterialId);
    expect(ledgerAfterVoid.map((row) => row.transactionType).sort()).toEqual(['ADJUSTMENT_OUT', 'RECEIPT']);
    expect(ledgerAfterVoid.find((row) => row.transactionType === 'ADJUSTMENT_OUT')?.quantity).toBe('3.125');
  });

  it('validates adjustments, rejects insufficient OUT, and requires authentication', async () => {
    expect((await adjust(materialId, '0', 'IN')).statusCode).toBe(422);
    expect((await app.inject({
      method: 'POST',
      url: `${inventoryPath(orgId, projectId)}/adjustments`,
      headers: authHeaders(token),
      payload: { materialId, quantity: '1', unitCode: 'EA', reason: 'missing direction' },
    })).statusCode).toBe(422);
    expect((await app.inject({
      method: 'POST',
      url: `${inventoryPath(orgId, projectId)}/adjustments`,
      headers: authHeaders(token),
      payload: { materialId, quantity: '1', unitCode: 'EA', direction: 'IN' },
    })).statusCode).toBe(422);
    expect((await adjust(materialId, '100000', 'OUT')).statusCode).toBe(422);

    const unauthenticated = await app.inject({
      method: 'POST',
      url: `${inventoryPath(orgId, projectId)}/adjustments`,
      payload: { materialId, quantity: '1', unitCode: 'EA', direction: 'IN', reason: `unauth ${runId}` },
    });
    expect(unauthenticated.statusCode).toBe(401);
  });

  it('rejects cross-tenant material mutations and blocks a foreign tenant from adjusting', async () => {
    const invalidMaterial = await adjust(foreignMaterialId, '1', 'IN');
    expect([404, 422]).toContain(invalidMaterial.statusCode);

    const before = await getDb().select().from(projectInventoryItems).where(and(
      eq(projectInventoryItems.organizationId, orgId),
      eq(projectInventoryItems.projectId, projectId),
      eq(projectInventoryItems.materialId, foreignMaterialId),
    ));
    expect(before).toHaveLength(0);

    const foreignTenant = await adjust(materialId, '1', 'IN', {
      targetOrg: foreignOrgId,
      targetProject: foreignProjectId,
      auth: foreignToken,
    });
    expect([403, 404]).toContain(foreignTenant.statusCode);
    const after = await getDb().select().from(projectInventoryItems).where(and(
      eq(projectInventoryItems.organizationId, orgId),
      eq(projectInventoryItems.projectId, projectId),
      eq(projectInventoryItems.materialId, foreignMaterialId),
    ));
    expect(after).toHaveLength(0);
  });

  it('transfers stock between locations without changing total quantity and validates transfer payloads', async () => {
    expect((await adjust(transferMaterialId, '6', 'IN', { location: 'yard' })).statusCode).toBe(201);
    const transfer = await app.inject({
      method: 'POST',
      url: `${inventoryPath(orgId, projectId)}/transfers`,
      headers: authHeaders(token),
      payload: {
        materialId: transferMaterialId,
        quantity: '2.5',
        unitCode: 'EA',
        fromLocation: 'yard',
        toLocation: 'warehouse',
      },
    });
    expect(transfer.statusCode).toBe(201);
    const [from, to] = await Promise.all([
      getBalance(transferMaterialId, orgId, projectId, token, 'yard'),
      app.inject({
        method: 'GET',
        url: `${inventoryPath(orgId, projectId)}/${transferMaterialId}?location=warehouse`,
        headers: authHeaders(token),
      }),
    ]);
    expect(from.json().data.balance).toBe('3.500');
    expect(to.statusCode).toBe(200);
    expect(to.json().data.balance).toBe('2.500');

    const balances = await getDb().execute(sql`
        SELECT pii.location,
          COALESCE(SUM(CASE WHEN it.transaction_type IN ('RECEIPT','RETURN','ADJUSTMENT_IN','TRANSFER_IN')
            THEN it.quantity::numeric ELSE -(it.quantity::numeric) END), 0) AS balance
        FROM app.project_inventory_items pii
        LEFT JOIN app.inventory_transactions it ON it.inventory_item_id = pii.id
        WHERE pii.organization_id = ${orgId} AND pii.project_id = ${projectId} AND pii.material_id = ${transferMaterialId}
        GROUP BY pii.location
      `) as any;
    const locationBalances = balances.rows ?? balances;
    expect(Number(locationBalances.find((row: any) => row.location === 'yard')?.balance)).toBe(3.5);
    expect(Number(locationBalances.find((row: any) => row.location === 'warehouse')?.balance)).toBe(2.5);
    expect(Number(locationBalances.reduce((sum: number, row: any) => sum + Number(row.balance), 0))).toBe(6);

    const sameLocation = await app.inject({
      method: 'POST',
      url: `${inventoryPath(orgId, projectId)}/transfers`,
      headers: authHeaders(token),
      payload: { materialId, quantity: '1', unitCode: 'EA', fromLocation: 'yard', toLocation: 'yard' },
    });
    expect([400, 422]).toContain(sameLocation.statusCode);
    for (const payload of [
      { materialId, quantity: '0', unitCode: 'EA', fromLocation: 'yard', toLocation: 'warehouse' },
      { materialId: foreignMaterialId, quantity: '1', unitCode: 'EA', fromLocation: 'yard', toLocation: 'warehouse' },
    ]) {
      const invalid = await app.inject({
        method: 'POST',
        url: `${inventoryPath(orgId, projectId)}/transfers`,
        headers: authHeaders(token),
        payload,
      });
      expect([400, 404, 422]).toContain(invalid.statusCode);
    }
  });

  it('serializes concurrent adjustments, preserves decimal precision, and records a scoped audit event', async () => {
    const before = (await getBalance(materialId)).json().data.balance;
    const additions = await Promise.all([
      adjust(materialId, '1.125', 'IN'),
      adjust(materialId, '2.250', 'IN'),
    ]);
    expect(additions.map((response) => response.statusCode)).toEqual([201, 201]);
    const expected = Number(before) + 3.375;
    expect(Number((await getBalance(materialId)).json().data.balance)).toBeCloseTo(expected, 3);

    const audit = await getDb().select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, orgId),
      eq(auditLogs.action, 'inventory.adjusted'),
    ));
    expect(audit.some((entry) => entry.metadata && JSON.stringify(entry.metadata).includes(runId))).toBe(true);
  });
});
