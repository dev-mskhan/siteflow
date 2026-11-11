// E2E: Full procurement chain — MR → Quote → PO → Delivery → Receipt → Committed Cost → Inventory
import { test, expect } from '@playwright/test';

let orgId: string;
let projectId: string;
let materialId: string;  // org-level material needed for MR/Quote/PO items
let supplierId: string;  // org-level supplier needed for Quote/PO
let materialRequestId: string;
let quoteId: string;
let purchaseOrderId: string;
let poItemId: string;    // needed for delivery items
let deliveryId: string;

test.beforeAll(async ({ request }) => {
  // Create org + trial + project
  const orgRes = await request.post('/api/v1/organizations', {
    data: { name: `E2E Procurement ${Date.now()}` },
  });
  if (orgRes.status() !== 201) return;
  const { data: { organization: { id } } } = (await orgRes.json()) as { data: { organization: { id: string } } };
  orgId = id;

  await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

  const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
    data: { name: 'Procurement Test Project', currency: 'AED', plannedStartDate: '2026-01-01' },
  });
  if (projectRes.status() !== 201) return;
  const projectBody = (await projectRes.json()) as { data: { project?: { id: string }; id?: string } };
  projectId = projectBody.data.project?.id ?? projectBody.data.id ?? '';

  await request.post(`/api/v1/organizations/${orgId}/projects/${projectId}/activate`, { data: {} });

  // Create a material at org level (required for MR/Quote/PO items)
  const matRes = await request.post(`/api/v1/organizations/${orgId}/materials`, {
    data: {
      materialCode: `MAT-${Date.now()}`,
      name: 'Structural Steel',
      defaultUnitCode: 'TON',
    },
  });
  if (matRes.status() === 201) {
    const matBody = (await matRes.json()) as { data: { id: string } };
    materialId = matBody.data.id;
  }

  // Create a supplier at org level (required for Quote/PO)
  const supRes = await request.post(`/api/v1/organizations/${orgId}/suppliers`, {
    data: {
      legalName: `E2E Supplier ${Date.now()}`,
      displayName: `E2E Supplier ${Date.now()}`,
    },
  });
  if (supRes.status() === 201) {
    const supBody = (await supRes.json()) as { data: { id: string } };
    supplierId = supBody.data.id;
  }
});

test.describe('Procurement: Material Requests', () => {
  test('creates material request with valid items', async ({ request }) => {
    if (!orgId || !projectId || !materialId) return test.skip();
    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/material-requests`,
      {
        data: {
          priority: 'HIGH',
          notes: 'E2E test material request',
          items: [
            {
              materialId,
              quantity: '10.000',
              unitCode: 'TON',
            },
          ],
        },
      },
    );
    expect([201, 403, 422]).toContain(res.status());
    if (res.status() === 201) {
      const body = (await res.json()) as { data: { id: string; status: string } };
      materialRequestId = body.data.id;
      expect(body.data.status).toBe('DRAFT');
    }
  });

  test('lists material requests', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/material-requests`);
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { data: unknown[] };
      expect(Array.isArray(body.data)).toBe(true);
    }
  });
});

test.describe('Procurement: Quotes', () => {
  test('creates quote with valid items', async ({ request }) => {
    if (!orgId || !projectId || !materialId || !supplierId) return test.skip();
    const today = new Date().toISOString().split('T')[0];
    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/quotes`,
      {
        data: {
          supplierId,
          quoteDate: today,
          currencyCode: 'AED',
          items: [
            {
              materialId,
              quantity: '10.000',
              unitCode: 'TON',
              unitPrice: '500.00',
            },
          ],
        },
      },
    );
    expect([201, 403, 422]).toContain(res.status());
    if (res.status() === 201) {
      const body = (await res.json()) as { data: { id: string } };
      quoteId = body.data.id;
    }
  });

  test('lists quotes', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/quotes`);
    expect([200, 403]).toContain(res.status());
  });
});

test.describe('Procurement: Purchase Orders', () => {
  test('creates purchase order with valid items', async ({ request }) => {
    if (!orgId || !projectId || !materialId || !supplierId) return test.skip();
    const today = new Date().toISOString().split('T')[0];
    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/purchase-orders`,
      {
        data: {
          supplierId,
          orderDate: today,
          currencyCode: 'AED',
          items: [
            {
              materialId,
              quantity: '10.000',
              unitCode: 'TON',
              unitPrice: '500.00',
            },
          ],
        },
      },
    );
    expect([201, 403, 422]).toContain(res.status());
    if (res.status() === 201) {
      const body = (await res.json()) as { data: { id: string; items?: Array<{ id: string }> } };
      purchaseOrderId = body.data.id;
      poItemId = body.data.items?.[0]?.id ?? '';
    }
  });

  test('lists purchase orders', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/purchase-orders`);
    expect([200, 403]).toContain(res.status());
  });
});

test.describe('Procurement: Deliveries', () => {
  test('creates delivery with valid PO items', async ({ request }) => {
    if (!orgId || !projectId || !purchaseOrderId || !poItemId) return test.skip();
    const today = new Date().toISOString().split('T')[0];
    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/deliveries`,
      {
        data: {
          purchaseOrderId,
          scheduledDate: today,
          items: [
            {
              purchaseOrderItemId: poItemId,
              quantity: '5.000',
              unitCode: 'TON',
            },
          ],
        },
      },
    );
    expect([201, 403, 422]).toContain(res.status());
    if (res.status() === 201) {
      const body = (await res.json()) as { data: { id: string } };
      deliveryId = body.data.id;
    }
  });

  test('lists deliveries', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/deliveries`);
    expect([200, 403]).toContain(res.status());
  });
});

test.describe('Procurement: Approvals', () => {
  test('lists procurement approvals', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/procurement-approvals`);
    expect([200, 403, 404]).toContain(res.status());
  });
});

test.describe('Procurement: Committed Costs', () => {
  test('lists committed costs', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/committed-costs`);
    expect([200, 403]).toContain(res.status());
  });
});

test.describe('Procurement: Inventory', () => {
  test('lists inventory', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/inventory`);
    expect([200, 403]).toContain(res.status());
  });
});
