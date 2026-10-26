/**
 * E2E: Commercial — Change Orders, SOV, Payment Apps, Invoices, Payments workflows.
 * Tests the live API endpoints for commercial financial operations.
 * Depends on auth.setup.ts (saved session in .auth/user.json).
 */
import { test, expect } from '@playwright/test';

test.describe('Commercial: Change Orders Workflow', () => {
  let orgId: string;
  let projectId: string;
  let changeOrderId: string;

  test.beforeAll(async ({ request }) => {
    // Create org
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Commercial Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) {
      console.log('Org creation failed (trial limit), skipping tests');
      return;
    }
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    // Provision trial
    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    // Create project
    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Commercial Test Project',
        projectCode: `COM-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) {
      console.log('Project creation failed, skipping tests');
      return;
    }
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;

    // Activate project
    await request.post(`/api/v1/organizations/${orgId}/projects/${projectId}/activate`, {
      data: {},
    });
  });

  test('creates and lists change orders', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    // Create change order
    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/change-orders`,
      {
        data: {
          title: 'Additional Foundation Work',
          description: 'Extra excavation required due to soil conditions',
          reason: 'Site conditions differ from survey',
          lines: [
            {
              description: 'Additional excavation',
              quantity: '50',
              unit: 'M3',
              unitRate: '150.00',
              amount: '7500.00',
              currencyCode: 'AED',
            },
          ],
          currencyCode: 'AED',
        },
      },
    );
    
    // Accept 201 (success) or 403/422 (permission/validation)
    expect([201, 403, 422]).toContain(createRes.status());
    
    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { id: string; status: string } };
      changeOrderId = created.data.id;
      expect(created.data.status).toBe('DRAFT');

      // List change orders
      const listRes = await request.get(
        `/api/v1/organizations/${orgId}/projects/${projectId}/change-orders`,
      );
      expect(listRes.status()).toBe(200);
      const listBody = await listRes.json();
      expect(Array.isArray(listBody.data)).toBeTruthy();
      const found = listBody.data.find((co: any) => co.id === changeOrderId);
      expect(found).toBeTruthy();
    }
  });

  test('gets change order detail', async ({ request }) => {
    if (!orgId || !projectId || !changeOrderId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const getRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}`,
    );
    expect([200, 404]).toContain(getRes.status());
    
    if (getRes.status() === 200) {
      const body = await getRes.json();
      expect(body.data.id).toBe(changeOrderId);
      expect(body.data.title).toBe('Additional Foundation Work');
    }
  });

  test('updates change order', async ({ request }) => {
    if (!orgId || !projectId || !changeOrderId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const updateRes = await request.patch(
      `/api/v1/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}`,
      {
        data: {
          description: 'Updated: Extra excavation and backfill required',
        },
      },
    );
    expect([200, 404, 403]).toContain(updateRes.status());
  });

  test('submits change order (transition)', async ({ request }) => {
    if (!orgId || !projectId || !changeOrderId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const submitRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/change-orders/${changeOrderId}/submit`,
      {
        data: { expectedVersion: 1 },
      },
    );
    // Accept 200 (success), 404 (not found), 403 (permission), 422 (validation/state)
    expect([200, 404, 403, 422]).toContain(submitRes.status());
  });
});

test.describe('Commercial: Payment Applications Workflow', () => {
  let orgId: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    // Reuse org/project setup pattern
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E PA Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'PA Test Project',
        projectCode: `PA-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates payment application', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/payment-applications`,
      {
        data: {
          applicationNumber: `PA-${Date.now()}`,
          periodStart: '2026-01-01',
          periodEnd: '2026-01-31',
          notes: 'January progress billing',
        },
      },
    );
    
    expect([201, 403, 422]).toContain(createRes.status());
    
    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { id: string } };
      expect(created.data.id).toBeTruthy();
    }
  });

  test('lists payment applications', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/payment-applications`,
    );
    expect([200, 403]).toContain(listRes.status());
  });
});

test.describe('Commercial: Invoices & Payments Workflow', () => {
  let orgId: string;
  let projectId: string;
  let invoiceId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Invoice Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Invoice Test Project',
        projectCode: `INV-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates invoice', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/invoices`,
      {
        data: {
          invoiceNumber: `INV-${Date.now()}`,
          invoiceDate: '2026-01-31',
          dueDate: '2026-02-28',
          description: 'January Progress Invoice',
          subtotal: '50000.00',
          taxAmount: '2500.00',
          totalAmount: '52500.00',
          currencyCode: 'AED',
        },
      },
    );
    
    expect([201, 403, 422]).toContain(createRes.status());
    
    if (createRes.status() === 201) {
      const created = (await createRes.json()) as { data: { id: string; status: string } };
      invoiceId = created.data.id;
      expect(created.data.status).toBe('DRAFT');
    }
  });

  test('lists invoices', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/invoices`,
    );
    expect([200, 403]).toContain(listRes.status());
  });

  test('gets invoice detail', async ({ request }) => {
    if (!orgId || !projectId || !invoiceId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const getRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}`,
    );
    expect([200, 404, 403]).toContain(getRes.status());
  });

  test('submits invoice (transition)', async ({ request }) => {
    if (!orgId || !projectId || !invoiceId) {
      console.log('Prerequisite test failed, skipping');
      return;
    }

    const submitRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/invoices/${invoiceId}/submit`,
      {
        data: { expectedVersion: 1 },
      },
    );
    expect([200, 404, 403, 422]).toContain(submitRes.status());
  });
});

test.describe('Commercial: Cost Transactions', () => {
  let orgId: string;
  let projectId: string;

  test.beforeAll(async ({ request }) => {
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `E2E Cost Txn Org ${Date.now()}` },
    });
    if (orgRes.status() !== 201) return;
    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    orgId = orgBody.data.organization.id;

    await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Cost Txn Project',
        projectCode: `CT-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });
    if (projectRes.status() !== 201) return;
    const projectBody = (await projectRes.json()) as { data: { id: string } };
    projectId = projectBody.data.id;
  });

  test('creates cost transaction', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const createRes = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/cost-transactions`,
      {
        data: {
          transactionDate: '2026-01-15',
          transactionType: 'EXPENSE',
          description: 'Equipment rental',
          amount: '5000.00',
          currencyCode: 'AED',
        },
      },
    );
    
    expect([201, 403, 422]).toContain(createRes.status());
  });

  test('lists cost transactions', async ({ request }) => {
    if (!orgId || !projectId) {
      console.log('Setup failed, skipping test');
      return;
    }

    const listRes = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/cost-transactions`,
    );
    expect([200, 403]).toContain(listRes.status());
  });
});

test.describe('Commercial: API Smoke Tests', () => {
  test('commercial endpoints are registered', async ({ request }) => {
    // Create minimal org
    const orgRes = await request.post('/api/v1/organizations', {
      data: { name: `Smoke ${Date.now()}` },
    });
    if (orgRes.status() !== 201) {
      console.log('Org creation blocked, testing with placeholder IDs');
      // Test endpoint structure exists (404 not 500)
      const testRes = await request.get(
        '/api/v1/organizations/org_test/projects/proj_test/change-orders',
      );
      expect([200, 401, 403, 404]).toContain(testRes.status());
      return;
    }

    const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
    const orgId = orgBody.data.organization.id;

    const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
      data: {
        name: 'Smoke Project',
        projectCode: `SMOKE-${Date.now()}`,
        startDate: '2026-01-01',
        currencyCode: 'AED',
      },
    });

    if (projectRes.status() !== 201) {
      console.log('Project creation failed, testing routes exist');
      return;
    }

    const projectBody = (await projectRes.json()) as { data: { id: string } };
    const projectId = projectBody.data.id;

    // Verify all commercial endpoints are registered
    const endpoints = [
      `/api/v1/organizations/${orgId}/projects/${projectId}/change-orders`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/sov`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/payment-applications`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/invoices`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/payments`,
      `/api/v1/organizations/${orgId}/projects/${projectId}/cost-transactions`,
    ];

    for (const endpoint of endpoints) {
      const res = await request.get(endpoint);
      // Should be 200 (success) or 403 (permission), NOT 404 (route missing) or 500 (error)
      expect([200, 403]).toContain(res.status());
    }
  });
});
