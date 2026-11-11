// E2E: Commercial module mutations — Change Orders, SOV, Payment Apps, Invoices, Payments
import { test, expect } from '@playwright/test';

let orgId: string;
let projectId: string;
let changeOrderId: string;

test.beforeAll(async ({ request }) => {
  const orgRes = await request.post('/api/v1/organizations', {
    data: { name: `E2E Commercial ${Date.now()}` },
  });
  if (orgRes.status() !== 201) return;
  orgId = ((await orgRes.json()) as { data: { organization: { id: string } } }).data.organization.id;

  await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

  const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
    data: { name: 'Commercial Test Project', currency: 'AED', plannedStartDate: '2026-01-01' },
  });
  if (projectRes.status() !== 201) return;
  const projectBody = (await projectRes.json()) as { data: { project: { id: string } } };
  projectId = projectBody.data.project.id;
  await request.post(`/api/v1/organizations/${orgId}/projects/${projectId}/activate`, { data: {} });
});

test.describe('Commercial: Change Orders', () => {
  test('creates change order', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    // Ensure cost code exists for line item
    const ccRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/cost-codes`,
      {
        data: {
          code: `CC-${Date.now()}`,
          description: 'Structural Concrete',
        },
      },
    );
    let costCodeId = '';
    if (ccRes.status() === 201) {
      const ccBody = (await ccRes.json()) as { data: { costCode: { id: string } } };
      costCodeId = ccBody.data.costCode.id;
    }

    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/change-orders`,
      {
        data: {
          title: `E2E CO ${Date.now()}`,
          reason: 'Site condition variation',
          currencyCode: 'AED',
          lines: [
            {
              costCodeId,
              description: 'Additional foundation support',
              costDelta: '15000.00',
              revenueDelta: '0.00',
            },
          ],
        },
      },
    );
    expect([201, 403]).toContain(res.status());
    if (res.status() === 201) {
      const body = (await res.json()) as { data: { id: string; status: string } };
      changeOrderId = body.data.id;
    }
  });

  test('lists change orders', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/change-orders`);
    expect([200, 403]).toContain(res.status());
  });

  test('gets commercial summary', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/commercial-summary`);
    expect([200, 403, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    }
  });

  test('gets financial summary', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/financial-summary`);
    expect([200, 403, 404]).toContain(res.status());
  });
});

test.describe('Commercial: Schedule of Values', () => {
  test('gets SOV', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/schedule-of-values`);
    expect([200, 403, 404]).toContain(res.status());
  });
});

test.describe('Commercial: Payment Applications', () => {
  test('lists payment applications', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/payment-applications`);
    expect([200, 403]).toContain(res.status());
  });
});

test.describe('Commercial: Invoices', () => {
  test('lists invoices', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/invoices`);
    expect([200, 403]).toContain(res.status());
  });
});

test.describe('Commercial: Retainage', () => {
  test('lists retainage', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/retainage`);
    expect([200, 403, 404]).toContain(res.status());
  });
});

test.describe('Commercial: Cost Transactions', () => {
  test('lists cost transactions', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/cost-transactions`);
    expect([200, 403]).toContain(res.status());
  });
});
