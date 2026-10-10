// apps/server/tests/integration/reporting/report-routes.test.ts
// F.16 — Fastify HTTP route integration tests for all reporting endpoints.
// Verifies: app.inject() response envelopes, 200 success, 401 unauth, 403/404 cross-tenant boundary protection, and portfolio aggregation.

import { afterAll, describe, it, expect, beforeAll } from 'vitest';
import { createTestApp } from '../../helpers/test-app.js';
import {
  addMemberDirectly,
  createVerifiedUser,
  createOrgWithAdmin,
} from '../../helpers/fixtures.js';
import { getDb } from '../../../src/lib/db/index.js';
import { projectMembers } from '@siteflow/database/schema';

describe('F.16 Reporting HTTP Query API Routes', () => {
  const runId = Math.random().toString(36).substring(7);
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let org1Id: string;
  let org2Id: string;
  let proj1Id: string;
  let proj2Id: string;
  let foreignProjectId: string;
  let token1: string;
  let token2: string;
  let noProjectMembershipToken: string;
  let scopedPortfolioToken: string;

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
    const p2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects`,
      headers: { authorization: `Bearer ${token1}` },
      payload: {
        name: 'Report Route Project 2',
        code: `RR2${runId.slice(0, 3).toUpperCase()}`,
        defaultCurrency: 'USD',
      },
    });
    proj2Id = p2Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects/${proj2Id}/activate`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // An organization member without project membership must not inherit
    // access to project reports merely from organization membership.
    const reportViewer = await createVerifiedUser({
      email: `rr_viewer_${runId}@test.dev`,
    });
    noProjectMembershipToken = reportViewer.token;
    const viewerRoleId =
      o1.roleMap.get('CLIENT') ?? o1.roleMap.get('Client');
    if (!viewerRoleId) {
      throw new Error('Expected the seeded CLIENT organization role');
    }
    await addMemberDirectly(org1Id, reportViewer.user.id, viewerRoleId);

    const scopedPortfolioUser = await createVerifiedUser({
      email: `rr_scoped_${runId}@test.dev`,
    });
    scopedPortfolioToken = scopedPortfolioUser.token;
    await addMemberDirectly(org1Id, scopedPortfolioUser.user.id, viewerRoleId);
    await getDb()
      .insert(projectMembers)
      .values({
        id: crypto.randomUUID(),
        projectId: proj1Id,
        organizationId: org1Id,
        userId: scopedPortfolioUser.user.id,
        role: 'PROJECT_MANAGER',
        status: 'ACTIVE',
        addedBy: u1.user.id,
      });

    // Org 2
    const u2 = await createVerifiedUser({ email: `rr_u2_${runId}@test.dev` });
    token2 = u2.token;
    const o2 = await createOrgWithAdmin(app, token2, `RROrg2_${runId}`);
    org2Id = o2.orgId;
    const foreignProjectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org2Id}/projects`,
      headers: { authorization: `Bearer ${token2}` },
      payload: {
        name: 'Foreign Report Route Project',
        code: `RRF${runId.slice(0, 3).toUpperCase()}`,
        defaultCurrency: 'USD',
      },
    });
    foreignProjectId = foreignProjectRes.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org2Id}/projects/${foreignProjectId}/activate`,
      headers: { authorization: `Bearer ${token2}` },
    });
  }, 30000);

  afterAll(async () => {
    await app?.close();
  });

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
    expect(body.data.data.projects.map((project: { id: string }) => project.id))
      .toEqual(expect.arrayContaining([proj1Id, proj2Id]));
    expect(body.data.data.projects.map((project: { id: string }) => project.id))
      .not.toContain(foreignProjectId);
  });

  it('limits portfolio aggregates and rows to projects the caller can read', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/reports/portfolio`,
      headers: { authorization: `Bearer ${noProjectMembershipToken}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data.data;
    expect(data.projects).toEqual([]);
    expect(data.totalProjects).toBe(0);
    expect(data.statusCounts).toEqual({});
    expect(data.contractValueByCurrency).toEqual({});
  });

  it('uses the same authorized project set for portfolio rows and aggregates', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/reports/portfolio`,
      headers: { authorization: `Bearer ${scopedPortfolioToken}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data.data;
    expect(data.projects.map((project: { id: string }) => project.id)).toEqual([
      proj1Id,
    ]);
    expect(data.projects.map((project: { id: string }) => project.id)).not.toContain(
      proj2Id,
    );
    expect(data.totalProjects).toBe(1);
    expect(data.statusCounts).toEqual({ ACTIVE: 1 });
  });

  it('uses bounded cursor pagination for portfolio comparison rows', async () => {
    const firstPage = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/reports/portfolio?limit=1`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(firstPage.statusCode).toBe(200);
    const firstData = firstPage.json().data.data;
    expect(firstData.projects).toHaveLength(1);
    expect(firstData.nextCursor).toEqual(expect.any(String));

    const secondPage = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${org1Id}/reports/portfolio?limit=1&cursor=${encodeURIComponent(firstData.nextCursor)}`,
      headers: { authorization: `Bearer ${token1}` },
    });
    expect(secondPage.statusCode).toBe(200);
    const secondData = secondPage.json().data.data;
    expect(secondData.projects).toHaveLength(1);
    expect(secondData.projects[0].id).not.toBe(firstData.projects[0].id);
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

  it('denies project reports to an organization member without project-read authority', async () => {
    const reportPaths = [
      'health',
      'schedule',
      'cost',
      'procurement',
      'subcontractor',
      'executive-summary',
    ];

    for (const report of reportPaths) {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/reports/${report}`,
        headers: { authorization: `Bearer ${noProjectMembershipToken}` },
      });
      expect(
        [403, 404],
        `${report} must fail closed without project-read authority`,
      ).toContain(res.statusCode);
    }
  });
});
