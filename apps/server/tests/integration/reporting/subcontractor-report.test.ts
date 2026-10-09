// apps/server/tests/integration/reporting/subcontractor-report.test.ts
// F.15 — Subcontractor Performance Report Engine integration tests
// Verifies: source-backed subcontractor facts, explicit unavailable coverage, and multi-tenant isolation.

import { describe, it, expect, beforeAll } from 'vitest';
import { SubcontractorReportService } from '../../../src/modules/reporting/subcontractor/subcontractor-report.service.js';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';

describe('F.15 Subcontractor Performance Report Engine', () => {
  const runId = Math.random().toString(36).substring(7);
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let org1Id: string;
  let org2Id: string;
  let proj1Id: string;
  let token1: string;

  const svc = new SubcontractorReportService();

  beforeAll(async () => {
    app = await createTestApp();

    // Org 1 + Project 1
    const u1 = await createVerifiedUser({ email: `sub_u1_${runId}@test.dev` });
    token1 = u1.token;
    const o1 = await createOrgWithAdmin(app, token1, `SUBOrg1_${runId}`);
    org1Id = o1.orgId;

    const p1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: 'Subcontractor Report Project 1', code: `SUB1${runId.slice(0, 3).toUpperCase()}`, defaultCurrency: 'USD' },
    });
    proj1Id = p1Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/activate`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Org 2
    const u2 = await createVerifiedUser({ email: `sub_u2_${runId}@test.dev` });
    const o2 = await createOrgWithAdmin(app, u2.token, `SUBOrg2_${runId}`);
    org2Id = o2.orgId;
  }, 30000);

  it('generates subcontractor report envelope for valid project', async () => {
    const report = await svc.getSubcontractorReport(org1Id, proj1Id);

    expect(report).not.toBeNull();
    expect(report!.reportType).toBe('SUBCONTRACTOR_PERFORMANCE');
    expect(report!.organizationId).toBe(org1Id);
    expect(report!.projectId).toBe(proj1Id);
    expect(report!.coverage.isAvailable).toBe(true);

    const data = report!.data as any;
    expect(typeof data.activeSubcontractorCount).toBe('number');
    expect(typeof data.totalTaskAssignments).toBe('number');
    expect(typeof data.purchaseOrderCount).toBe('number');
  });

  it('discloses unsupported commitment and rating formulas as explicitly unavailable', async () => {
    const report = await svc.getSubcontractorReport(org1Id, proj1Id);
    const data = report!.data as any;

    expect(data.subcontractCommitmentsCoverage.isAvailable).toBe(false);
    expect(data.subcontractCommitmentsCoverage.reason).toBe(
      'DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS',
    );

    expect(data.performanceScoreCoverage.isAvailable).toBe(false);
    expect(data.performanceScoreCoverage.reason).toBe(
      'UNSUPPORTED_PERFORMANCE_RATING_FORMULA',
    );
  });

  it('multi-tenant isolation — Org 2 report contains Org 2 data only', async () => {
    const report1 = await svc.getSubcontractorReport(org1Id, proj1Id);
    expect(report1!.organizationId).toBe(org1Id);

    const report2 = await svc.getSubcontractorReport(org2Id, proj1Id);
    const data2 = report2!.data as any;
    expect(data2.activeSubcontractorCount).toBe(0);
    expect(data2.totalTaskAssignments).toBe(0);
    expect(data2.purchaseOrderCount).toBe(0);
  });

  it('throws error when organizationId is missing', async () => {
    await expect(svc.getSubcontractorReport('', proj1Id)).rejects.toThrow(
      'organizationId and projectId are required',
    );
  });

  it('throws error when projectId is missing', async () => {
    await expect(svc.getSubcontractorReport(org1Id, '')).rejects.toThrow(
      'organizationId and projectId are required',
    );
  });
});
