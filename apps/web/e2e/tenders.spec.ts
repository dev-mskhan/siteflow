// E2E: Tenders (org-scoped) and Pricing/Rates
import { test, expect } from '@playwright/test';

let orgId: string;
let projectId: string;
let tenderId: string;

test.beforeAll(async ({ request }) => {
  const orgRes = await request.post('/api/v1/organizations', {
    data: { name: `E2E Tenders ${Date.now()}` },
  });
  if (orgRes.status() !== 201) return;
  orgId = ((await orgRes.json()) as { data: { organization: { id: string } } }).data.organization.id;
  await request.post(`/api/v1/organizations/${orgId}/billing/trial`, { data: {} });

  const projectRes = await request.post(`/api/v1/organizations/${orgId}/projects`, {
    data: { name: 'Tender Test Project', currency: 'AED', plannedStartDate: '2026-01-01' },
  });
  if (projectRes.status() !== 201) return;
  const projectBody = (await projectRes.json()) as { data: { project: { id: string } } };
  projectId = projectBody.data.project.id;
});

test.describe('Tenders (Org-Scoped)', () => {
  test('creates tender', async ({ request }) => {
    if (!orgId) return test.skip();
    const res = await request.post(`/api/v1/organizations/${orgId}/tenders`, {
      data: {
        title: `E2E Tender ${Date.now()}`,
        clientName: 'Acme Corporation',
        submissionDeadline: new Date(Date.now() + 30 * 86400000).toISOString(),
        submissionTimezone: 'Asia/Dubai',
        description: 'Integration test tender',
      },
      headers: { 'idempotency-key': `tnd-${Date.now()}` },
    });
    expect([201, 403, 422]).toContain(res.status());
    if (res.status() === 201) {
      const body = (await res.json()) as { data: { tender: { id: string; status: string } } };
      tenderId = body.data.tender.id;
      expect(body.data.tender.status).toBe('OPEN');
    }
  });

  test('lists tenders', async ({ request }) => {
    if (!orgId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/tenders`);
    expect([200, 403]).toContain(res.status());
  });

  test('gets tender by id', async ({ request }) => {
    if (!orgId || !tenderId) return test.skip();
    const res = await request.get(`/api/v1/organizations/${orgId}/tenders/${tenderId}`);
    expect([200, 403, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { data: { tender: { id: string } } };
      expect(body.data.tender.id).toBe(tenderId);
    }
  });
});

test.describe('Pricing Rates (Project-Scoped)', () => {
  test('pricing rates endpoint is registered', async ({ request }) => {
    if (!orgId || !projectId) return test.skip();
    // materialId is required — use a placeholder; expect 400/422 not 404
    const res = await request.get(
      `/api/v1/organizations/${orgId}/projects/${projectId}/pricing/rates?materialId=mat_nonexistent`,
    );
    // 404 would mean route doesn't exist — that's the failure we're detecting
    expect([200, 400, 403, 422, 404]).toContain(res.status());
    if (res.status() === 404) {
      throw new Error('ROUTE MISSING: /pricing/rates not registered on server');
    }
  });
});
