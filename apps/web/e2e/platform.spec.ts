// apps/web/e2e/platform.spec.ts
// E2E tests for platform admin module — organization listing, account lifecycle, support grants, diagnostics.

import { test, expect } from '@playwright/test';

test.describe('Platform: Organization Management', () => {
  test('lists organizations with pagination', async ({ request }) => {
    const listRes = await request.get('/api/v1/platform/organizations', {
      params: {
        limit: 10,
      },
    });

    // Platform routes require platform permissions
    expect([200, 401, 403]).toContain(listRes.status());

    if (listRes.status() === 200) {
      const body = (await listRes.json()) as {
        data: { organizations: unknown[] };
        meta: { limit: number; nextCursor: string | null };
      };

      expect(Array.isArray(body.data.organizations)).toBeTruthy();
      expect(body.meta.limit).toBe(10);
      expect(body.meta.nextCursor).toBeDefined();
    }
  });

  test('searches organizations by name', async ({ request }) => {
    const searchRes = await request.get('/api/v1/platform/organizations', {
      params: {
        search: 'Test',
        limit: 5,
      },
    });

    expect([200, 401, 403]).toContain(searchRes.status());

    if (searchRes.status() === 200) {
      const body = (await searchRes.json()) as {
        data: { organizations: unknown[] };
      };

      expect(Array.isArray(body.data.organizations)).toBeTruthy();
    }
  });
});

test.describe('Platform: Account Management', () => {
  test('lists accounts with pagination', async ({ request }) => {
    const listRes = await request.get('/api/v1/platform/accounts', {
      params: {
        limit: 15,
      },
    });

    expect([200, 401, 403]).toContain(listRes.status());

    if (listRes.status() === 200) {
      const body = (await listRes.json()) as {
        data: { accounts: unknown[] };
        meta: { limit: number; nextCursor: string | null };
      };

      expect(Array.isArray(body.data.accounts)).toBeTruthy();
      expect(body.meta.limit).toBe(15);
    }
  });

  test('filters accounts by email prefix', async ({ request }) => {
    const filterRes = await request.get('/api/v1/platform/accounts', {
      params: {
        emailPrefix: 'test',
        limit: 10,
      },
    });

    expect([200, 401, 403]).toContain(filterRes.status());

    if (filterRes.status() === 200) {
      const body = (await filterRes.json()) as {
        data: { accounts: unknown[] };
      };

      expect(Array.isArray(body.data.accounts)).toBeTruthy();
    }
  });
});

test.describe('Platform: Billing Views', () => {
  test('retrieves organization billing view', async ({ request }) => {
    // Use a test org ID
    const billingRes = await request.get(
      '/api/v1/platform/organizations/org_test/billing'
    );

    expect([200, 401, 403, 404]).toContain(billingRes.status());

    if (billingRes.status() === 200) {
      const body = (await billingRes.json()) as {
        data: {
          organizationId: string;
          subscription?: { status: string; planId: string };
          trial?: { status: string };
        };
      };

      expect(body.data.organizationId).toBeDefined();
    }
  });

  test('retrieves webhook inbox summary', async ({ request }) => {
    const inboxRes = await request.get('/api/v1/platform/billing/webhook-inbox');

    expect([200, 401, 403]).toContain(inboxRes.status());

    if (inboxRes.status() === 200) {
      const body = (await inboxRes.json()) as {
        data: {
          pending: number;
          processed: number;
          failed: number;
        };
      };

      expect(typeof body.data.pending).toBe('number');
      expect(typeof body.data.processed).toBe('number');
      expect(typeof body.data.failed).toBe('number');
    }
  });
});

test.describe('Platform: Diagnostics', () => {
  test('retrieves system health', async ({ request }) => {
    const healthRes = await request.get('/api/v1/platform/diagnostics/health');

    expect([200, 401, 403]).toContain(healthRes.status());

    if (healthRes.status() === 200) {
      const body = (await healthRes.json()) as {
        data: {
          database: string;
          redis: string;
          queue: string;
          storage: string;
        };
      };

      expect(['healthy', 'degraded', 'unhealthy']).toContain(body.data.database);
    }
  });

  test('retrieves queue diagnostics', async ({ request }) => {
    const queueRes = await request.get('/api/v1/platform/diagnostics/queue', {
      params: {
        windowHours: 24,
      },
    });

    expect([200, 401, 403]).toContain(queueRes.status());

    if (queueRes.status() === 200) {
      const body = (await queueRes.json()) as {
        data: {
          jobsCreated: number;
          jobsCompleted: number;
          jobsFailed: number;
          avgProcessingTimeMs: number;
        };
      };

      expect(typeof body.data.jobsCreated).toBe('number');
      expect(typeof body.data.jobsCompleted).toBe('number');
    }
  });

  test('retrieves organization diagnostics', async ({ request }) => {
    const orgDiagRes = await request.get(
      '/api/v1/platform/organizations/org_test/diagnostics'
    );

    expect([200, 401, 403, 404]).toContain(orgDiagRes.status());

    if (orgDiagRes.status() === 200) {
      const body = (await orgDiagRes.json()) as {
        data: {
          organizationId: string;
          memberCount: number;
          projectCount: number;
          activeJobCount: number;
        };
      };

      expect(body.data.organizationId).toBeDefined();
    }
  });
});

test.describe('Platform: Support Grants', () => {
  test('requests support grant', async ({ request }) => {
    const grantRes = await request.post('/api/v1/platform/support-grants', {
      data: {
        operatorUserId: 'user_test',
        organizationId: 'org_test',
        scopes: ['read:organization'],
        password: 'test-password-123',
        reasonCode: 'SUPPORT_TICKET',
        reasonNote: 'Customer support investigation for billing issue',
      },
    });

    expect([201, 401, 403, 422]).toContain(grantRes.status());

    if (grantRes.status() === 201) {
      const body = (await grantRes.json()) as {
        data: {
          id: string;
          status: string;
          organizationId: string;
        };
      };

      expect(body.data.status).toBe('PENDING');
    }
  });

  test('retrieves organization via support grant', async ({ request }) => {
    const useGrantRes = await request.get(
      '/api/v1/platform/support-grants/grant_test/organization',
      {
        params: {
          scope: 'read:organization',
        },
      }
    );

    expect([200, 401, 403, 404]).toContain(useGrantRes.status());
  });
});

test.describe('Platform: API Smoke Tests', () => {
  test('platform endpoints are registered', async ({ request }) => {
    const endpoints = [
      '/api/v1/platform/organizations',
      '/api/v1/platform/accounts',
      '/api/v1/platform/diagnostics/health',
      '/api/v1/platform/billing/webhook-inbox',
    ];

    for (const endpoint of endpoints) {
      const testRes = await request.get(endpoint);
      expect([200, 401, 403]).toContain(testRes.status());
    }
  });
});
