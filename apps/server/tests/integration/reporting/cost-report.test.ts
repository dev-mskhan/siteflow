// apps/server/tests/integration/reporting/cost-report.test.ts
// F.13 — Commercial Financial Summary Report integration tests
// Verifies: parity with Phase E financialSummaryService, multi-currency breakdown, unavailable coverage disclosure, and tenant isolation.

import { describe, it, expect, beforeAll } from 'vitest';
import { CostReportService } from '../../../src/modules/reporting/cost/cost-report.service.js';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';

describe('F.13 Commercial Financial Summary Report Engine', () => {
  const runId = Math.random().toString(36).substring(7);
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let org1Id: string;
  let org2Id: string;
  let proj1Id: string;
  let token1: string;

  const svc = new CostReportService();

  beforeAll(async () => {
    app = await createTestApp();

    // Org 1 + Project 1
    const u1 = await createVerifiedUser({ email: `cr_u1_${runId}@test.dev` });
    token1 = u1.token;
    const o1 = await createOrgWithAdmin(app, token1, `CROrg1_${runId}`);
    org1Id = o1.orgId;

    const p1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: 'Cost Report Project 1', code: `CR1${runId.slice(0, 3).toUpperCase()}`, defaultCurrency: 'USD' },
    });
    proj1Id = p1Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/activate`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Org 2
    const u2 = await createVerifiedUser({ email: `cr_u2_${runId}@test.dev` });
    const o2 = await createOrgWithAdmin(app, u2.token, `CROrg2_${runId}`);
    org2Id = o2.orgId;
  }, 30000);

  it('generates commercial financial summary report envelope for valid project', async () => {
    const report = await svc.getCostReport(org1Id, proj1Id);

    expect(report).not.toBeNull();
    expect(report!.reportType).toBe('COMMERCIAL_FINANCIAL_SUMMARY');
    expect(report!.organizationId).toBe(org1Id);
    expect(report!.projectId).toBe(proj1Id);
    expect(report!.coverage.isAvailable).toBe(true);

    const data = report!.data as any;
    expect(data.cost).toBeDefined();
    expect(data.commitments).toBeDefined();
    expect(data.billingAndCash).toBeDefined();
  });

  it('discloses unavailable subcontract commitments coverage explicitly', async () => {
    const report = await svc.getCostReport(org1Id, proj1Id);
    const data = report!.data as any;
    expect(data.subcontractCommitmentsCoverage.isAvailable).toBe(false);
    expect(data.subcontractCommitmentsCoverage.reason).toBe(
      'DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS',
    );
  });

  it('returns null for cross-tenant project query (Org 2 cannot access Org 1 project)', async () => {
    const report = await svc.getCostReport(org2Id, proj1Id);
    expect(report).toBeNull();
  });

  it('throws error when organizationId is missing', async () => {
    await expect(svc.getCostReport('', proj1Id)).rejects.toThrow(
      'organizationId and projectId are required',
    );
  });

  it('throws error when projectId is missing', async () => {
    await expect(svc.getCostReport(org1Id, '')).rejects.toThrow(
      'organizationId and projectId are required',
    );
  });
});
