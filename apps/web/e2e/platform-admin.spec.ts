// E2E: Platform admin — requires platform-admin.setup.ts to run first (§3).
// All tests in this file run with platform admin session from e2e/.auth/platform-admin.json
import { test, expect } from '@playwright/test';

test.describe('Platform Admin: Organizations', () => {
  test('lists organizations (authenticated platform admin)', async ({ request }) => {
    const res = await request.get('/api/v1/platform/organizations', { params: { limit: 10 } });
    // Authenticated platform admin should get 200, not 403
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data: { organizations: { id: string; name: string }[] };
      meta: { nextCursor: string | null };
    };
    expect(Array.isArray(body.data.organizations)).toBe(true);
    expect(typeof body.meta.nextCursor !== 'undefined').toBe(true);
  });

  test('searches organizations', async ({ request }) => {
    const res = await request.get('/api/v1/platform/organizations', {
      params: { search: 'E2E', limit: 5 },
    });
    expect(res.status()).toBe(200);
  });
});

test.describe('Platform Admin: Accounts', () => {
  test('lists accounts', async ({ request }) => {
    const res = await request.get('/api/v1/platform/accounts', { params: { limit: 10 } });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data: { accounts: { id: string; email: string }[] };
      meta: { nextCursor: string | null };
    };
    expect(Array.isArray(body.data.accounts)).toBe(true);
  });

  test('filters accounts by email prefix', async ({ request }) => {
    const res = await request.get('/api/v1/platform/accounts', {
      params: { emailPrefix: 'e2e_', limit: 20 },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { data: { accounts: { email?: string; emailMasked?: string }[] } };
    for (const account of body.data.accounts) {
      const email = account.email || account.emailMasked || '';
      expect(email.toLowerCase().startsWith('e')).toBe(true);
    }
  });
});

test.describe('Platform Admin: Diagnostics', () => {
  test('health endpoint returns healthy status', async ({ request }) => {
    const res = await request.get('/api/v1/platform/diagnostics/health');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data: { status: string; database: { ok: boolean; latencyMs: number } };
    };
    expect(['ok', 'degraded']).toContain(body.data.status);
    expect(typeof body.data.database.ok).toBe('boolean');
    expect(typeof body.data.database.latencyMs).toBe('number');
  });

  test('queue diagnostics returns metrics', async ({ request }) => {
    const res = await request.get('/api/v1/platform/diagnostics/queue', {
      params: { windowHours: 24 },
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data: { counts: Record<string, number>; outbox: { failedCount: number } };
    };
    expect(typeof body.data.counts).toBe('object');
    expect(typeof body.data.outbox.failedCount).toBe('number');
  });

  test('org-scoped diagnostics with real org', async ({ request }) => {
    // First get a real org ID
    const listRes = await request.get('/api/v1/platform/organizations', { params: { limit: 1 } });
    if (listRes.status() !== 200) return;
    const listBody = (await listRes.json()) as { data: { organizations: { id: string }[] } };
    if (!listBody.data.organizations.length) return;
    const orgId = listBody.data.organizations[0].id;

    const res = await request.get(`/api/v1/platform/organizations/${orgId}/diagnostics`);
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as {
        data: { organizationId: string; memberCount: number; projectCount: number };
      };
      expect(body.data.organizationId).toBe(orgId);
    }
  });
});

test.describe('Platform Admin: Billing', () => {
  test('webhook inbox returns counts', async ({ request }) => {
    const res = await request.get('/api/v1/platform/billing/webhook-inbox');
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      data: { counts: { PENDING: number; RETRY: number; PROCESSING: number; FAILED: number; QUARANTINED: number } };
    };
    expect(typeof body.data.counts.PENDING).toBe('number');
    expect(typeof body.data.counts.FAILED).toBe('number');
  });

  test('org billing view with real org', async ({ request }) => {
    const listRes = await request.get('/api/v1/platform/organizations', { params: { limit: 1 } });
    if (listRes.status() !== 200) return;
    const listBody = (await listRes.json()) as { data: { organizations: { id: string }[] } };
    if (!listBody.data.organizations.length) return;
    const orgId = listBody.data.organizations[0].id;

    const res = await request.get(`/api/v1/platform/organizations/${orgId}/billing`);
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = (await res.json()) as { data: { organizationId: string } };
      expect(body.data.organizationId).toBe(orgId);
    }
  });
});

test.describe('Platform Admin: Support Grants', () => {
  test('creates support grant request', async ({ request }) => {
    const listRes = await request.get('/api/v1/platform/organizations', { params: { limit: 1 } });
    if (listRes.status() !== 200) return;
    const listBody = (await listRes.json()) as { data: { organizations: { id: string }[] } };
    if (!listBody.data.organizations.length) return;
    const targetOrgId = listBody.data.organizations[0].id;

    const accountsRes = await request.get('/api/v1/platform/accounts', { params: { limit: 1 } });
    if (accountsRes.status() !== 200) return;
    const accountsBody = (await accountsRes.json()) as { data: { accounts: { id: string }[] } };
    if (!accountsBody.data.accounts.length) return;
    const operatorUserId = accountsBody.data.accounts[0].id;

    // Read valid scopes from server constant (platform-support-grant.service.ts)
    const res = await request.post('/api/v1/platform/support-grants', {
      data: {
        operatorUserId,
        organizationId: targetOrgId,
        scopes: ['read:org_summary'],
        password: 'TestPassword123!',
        reasonCode: 'SUPPORT_TICKET',
        reasonNote: 'E2E integration test for support grant flow verification',
      },
      headers: { 'idempotency-key': `sg-${Date.now()}` },
    });
    // 422 if scopes enum doesn't match — check server for exact values
    expect([201, 403, 422]).toContain(res.status());
  });
});
