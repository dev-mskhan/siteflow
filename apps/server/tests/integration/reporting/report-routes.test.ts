// apps/server/tests/integration/reporting/report-routes.test.ts
// F.16 — Fastify HTTP route integration tests for all reporting endpoints.
// Verifies: app.inject() response envelopes, 200 success, 401 unauth, 403/404 cross-tenant boundary protection, and portfolio aggregation.

import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';

describe('F.16 Reporting HTTP Query API Routes', () => {
  const runId = Math.random().toString(36).substring(7);
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let org1Id: string;
  let org2Id: string;
  let proj1Id: string;
  let token1: string;
  let token2: string;

  beforeAll(async () => {
    app = await createTestApp();

    // Org 1 + Project 1
    const u1 = await createVerifiedUser({ email: `rr_u1_${runId}@test.dev` });
    token1 = u1.token;
    const o1 = await createOrgWithAdmin(app, token1, `RROrg1_${runId}`);
    org1Id = o1.orgId;

    const p1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: 'Report Route Project 1', code: `RR1${runId.slice(0, 3).toUpperCase()}`, defaultCurrency: 'USD' },
    });
    proj1Id = p1Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/activate`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Org 2
    const u2 = await createVerifiedUser({ email: `rr_u2_${runId}@test.dev` });
    token2 = u2.token;
    const o2 = await createOrgWithAdmin(app, token2, `RROrg2_${runId}`);
    org2Id = o2.orgId;
  }, 30000);

  it('GET /health report returns 200 and valid report envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/health`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.organizationId).toBe(org1Id);
    expect(body.data.projectId).toBe(proj1Id);
  });

  it('GET /schedule report returns 200 with schedule envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/schedule?datePreset=THIS_MONTH`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.reportType).toBe('SCHEDULE_VARIANCE_PROGRESS');
  });

  it('GET /cost report returns 200 with cost envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/cost`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.reportType).toBe('COMMERCIAL_FINANCIAL_SUMMARY');
  });

  it('GET /procurement report returns 200 with procurement envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/procurement`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.reportType).toBe('SUBCONTRACTOR_PERFORMANCE');
  });

  it('GET /subcontractor report returns 200 with subcontractor envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/subcontractor`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.reportType).toBe('SUBCONTRACTOR_PERFORMANCE');
  });

  it('GET /executive-summary report returns 200 composed executive envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/executive-summary`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.reportType).toBe('PROJECT_EXECUTIVE_SUMMARY');
    expect(body.data.data.health).toBeDefined();
  });

  it('GET /portfolio report returns 200 organization portfolio envelope', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/reports/portfolio`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.success).toBe(true);
    expect(body.data.reportType).toBe('ORGANIZATION_PORTFOLIO');
    expect(body.data.data.totalProjects).toBeGreaterThanOrEqual(1);
  });

  it('returns 401 Unauthorized when missing authentication token', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/health`,
    });
    expect(res.statusCode).toBe(401);
  });

  it('enforces multi-tenant isolation — Org 2 user calling Org 1 report returns 403 or 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/health`,
      headers: { authorization: `Bearer ${token2}` },
    });
    // Organization middleware blocks cross-tenant member or project lookup returns 403/404
    expect([403, 404]).toContain(res.statusCode);
  });
});
