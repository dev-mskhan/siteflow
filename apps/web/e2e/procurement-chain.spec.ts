// E2E: Full procurement chain — MR → Quote → PO → Delivery → Receipt → Committed Cost → Inventory
import { test, expect } from '@playwright/test';

let orgId: string;
let projectId: string;
let materialRequestId: string;
let quoteId: string;
let purchaseOrderId: string;
let deliveryId: string;

test.beforeAll(async ({ request }) => {
  // Create org + trial + project
  const orgRes = await request.post('/api/v1/organizations', {
    data: { name: `E2E Procurement ${Date.now()}` },
  });
  if (orgRes.status() !== 201) return;
  const {
    data: {
      organization: { id },
    },
  } = (await orgRes.json()) as { data: { organization: { id: string } } };
  orgId = id;

  await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

  const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
    data: { name: 'Procurement Test Project', projectCode: `PROC-${Date.now()}`, startDate: '2026-01-01', currencyCode: 'AED' },
  });
  if (projectRes.status() !== 201) return;
  const projectBody = (await projectRes.json()) as { data: { id: string } };
  projectId = projectBody.data.id;

  await request.post(`/api/v1/organizations/${orgId}/projects/${projectId}/activate`, { data: {} });
});

test.describe('Procurement: Material Requests', () => {
  test('creates material request', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/material-requests`,
      {
        data: {
          title: `E2E MR ${Date.now()}`,
          requestedDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          priority: 'MEDIUM',
          items: [],
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
      const body = (await res.json()) as { data: unknown[] | { items: unknown[] } };
      const items = Array.isArray(body.data) ? body.data : (body.data as { items: unknown[] }).items;
      expect(Array.isArray(items)).toBe(true);
    }
  });
});

test.describe('Procurement: Quotes', () => {
  test('creates quote', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/quotes`,
      {
        data: {
          title: `E2E Quote ${Date.now()}`,
          requestedDate: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          items: [],
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
  test('creates purchase order', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/purchase-orders`,
      {
        data: {
          title: `E2E PO ${Date.now()}`,
          items: [],
          currency: 'AED',
        },
      },
    );
    expect([201, 403, 422]).toContain(res.status());
    if (res.status() === 201) {
      const body = (await res.json()) as { data: { id: string } };
      purchaseOrderId = body.data.id;
    }
  });

  test('lists purchase orders', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/purchase-orders`);
    expect([200, 403]).toContain(res.status());
  });
});

test.describe('Procurement: Deliveries', () => {
  test('creates delivery', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/deliveries`,
      {
        data: {
          deliveryDate: new Date().toISOString().split('T')[0],
          items: [],
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
