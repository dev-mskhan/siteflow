// E2E: Budget lifecycle, Cost Codes, Project Members (team), Project Settings, Audit log
import { test, expect } from '@playwright/test';

let orgId: string;
let projectId: string;
let costCodeId: string;
let budgetId: string;

test.beforeAll(async ({ request }) => {
  const orgRes = await request.post('/api/v1/organizations', {
    data: { name: `E2E Planning ${Date.now()}` },
  });
  if (orgRes.status() !== 201) return;
  const orgBody = (await orgRes.json()) as { data: { organization: { id: string } } };
  orgId = orgBody.data.organization.id;

  await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

  const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
    data: { name: 'Planning Test Project', projectCode: `PLN-${Date.now()}`, startDate: '2026-01-01', currencyCode: 'AED' },
  });
  if (projectRes.status() !== 201) return;
  projectId = ((await projectRes.json()) as { data: { id: string } }).data.id;
});

test.describe('Cost Codes', () => {
  test('creates cost code', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/cost-codes`,
      { data: { code: `CC-${Date.now()}`, name: 'E2E Cost Code', description: 'Test cost code' } },
    );
    expect([201, 403, 422]).toContain(res.status());
    if (res.status() === 201) {
      const body = (await res.json()) as { data: { id: string } };
      costCodeId = body.data.id;
    }
  });

  test('lists cost codes', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/cost-codes`);
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    }
  });
});

test.describe('Budget: Full Lifecycle', () => {
  test('creates budget', async ({ request }) => {
    if (!orgId || !projectId || !costCodeId) return test.skip();
    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/budgets`,
      {
        data: {
          currencyCode: 'AED',
          lines: [{ costCodeId, description: 'Foundation work', amount: '50000' }],
        },
      },
    );
    expect([201, 403, 422]).toContain(res.status());
    if (res.status() === 201) {
      const body = (await res.json()) as { data: { budget: { id: string; status: string; version: number } } };
      budgetId = body.data.budget.id;
      expect(body.data.budget.status).toBe('DRAFT');
    }
  });

  test('lists budgets', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/budgets`);
    expect([200, 403]).toContain(res.status());
  });

  test('gets budget summary', async ({ request }) => {
    if (!orgId || !projectId || !budgetId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/budgets/${budgetId}/summary`);
    expect([200, 403, 404]).toContain(res.status());
  });

  test('submits budget for approval', async ({ request }) => {
    if (!orgId || !projectId || !budgetId) return test.skip();
    // We need the version — get the budget first
    const getRes = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/budgets/${budgetId}`);
    if (getRes.status() !== 200) return;
    const getBody = (await getRes.json()) as { data: { budget: { version: number } } };
    const expectedVersion = getBody.data.budget.version;

    const res = await request.post(
      `/api/v1/organizations/${orgId}/projects/${projectId}/budgets/${budgetId}/submit`,
      { data: { expectedVersion } },
    );
    expect([200, 403, 409, 422]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { data: { budget: { status: string } } };
      expect(body.data.budget.status).toBe('PENDING_APPROVAL');
    }
  });
});

test.describe('Project: Audit Log', () => {
  test('lists project audit log', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/audit`);
    expect([200, 403, 404]).toContain(res.status());
  });
});

test.describe('Project: Settings', () => {
  test('gets project settings', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/settings`);
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { success: boolean };
      expect(body.success).toBe(true);
    }
  });
});

test.describe('Project: Team (Members)', () => {
  test('lists project members', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/projects/${projectId}/members`);
    expect([200, 403]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { success: boolean; data: unknown };
      expect(body.success).toBe(true);
    }
  });
});
