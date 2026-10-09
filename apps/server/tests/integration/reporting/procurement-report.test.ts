// apps/server/tests/integration/reporting/procurement-report.test.ts
// F.14 — Procurement Report Engine integration tests
// Verifies: source-backed procurement facts, explicit unavailable schedule impact coverage, and multi-tenant isolation.

import { describe, it, expect, beforeAll } from 'vitest';
import { ProcurementReportService } from '../../../src/modules/reporting/procurement/procurement-report.service.js';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';

describe('F.14 Procurement Report Engine', () => {
  const runId = Math.random().toString(36).substring(7);
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let org1Id: string;
  let org2Id: string;
  let proj1Id: string;
  let token1: string;

  const svc = new ProcurementReportService();

  beforeAll(async () => {
    app = await createTestApp();

    // Org 1 + Project 1
    const u1 = await createVerifiedUser({ email: `pr_u1_${runId}@test.dev` });
    token1 = u1.token;
    const o1 = await createOrgWithAdmin(app, token1, `PROrg1_${runId}`);
    org1Id = o1.orgId;

    const p1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: 'Procurement Report Project 1', code: `PR1${runId.slice(0, 3).toUpperCase()}`, defaultCurrency: 'USD' },
    });
    proj1Id = p1Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/activate`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Org 2
    const u2 = await createVerifiedUser({ email: `pr_u2_${runId}@test.dev` });
    const o2 = await createOrgWithAdmin(app, u2.token, `PROrg2_${runId}`);
    org2Id = o2.orgId;
  }, 30000);

  it('generates procurement report envelope for valid project', async () => {
    const report = await svc.getProcurementReport(org1Id, proj1Id);

    expect(report).not.toBeNull();
    expect(report!.reportType).toBe('SUBCONTRACTOR_PERFORMANCE');
    expect(report!.organizationId).toBe(org1Id);
    expect(report!.projectId).toBe(proj1Id);
    expect(report!.coverage.isAvailable).toBe(true);

    const data = report!.data as any;
    expect(data.materialRequests).toBeDefined();
    expect(data.purchaseOrders).toBeDefined();
    expect(data.deliveries).toBeDefined();
    expect(data.receipts).toBeDefined();
    expect(typeof data.inventoryItemCount).toBe('number');
  });

  it('discloses unsupported material-to-task schedule impact as explicitly unavailable', async () => {
    const report = await svc.getProcurementReport(org1Id, proj1Id);
    const data = report!.data as any;
    expect(data.materialScheduleImpactCoverage.isAvailable).toBe(false);
    expect(data.materialScheduleImpactCoverage.reason).toBe(
      'UNSUPPORTED_MATERIAL_SCHEDULE_IMPACT_FORMULA',
    );
  });

  it('multi-tenant isolation — Org 2 report contains Org 2 data only', async () => {
    const report1 = await svc.getProcurementReport(org1Id, proj1Id);
    expect(report1!.organizationId).toBe(org1Id);

    // Cross tenant check
    const report2 = await svc.getProcurementReport(org2Id, proj1Id);
    // Returns 0 counts for org2 (no rows match org2 + proj1)
    const data2 = report2!.data as any;
    expect(data2.inventoryItemCount).toBe(0);
  });

  it('throws error when organizationId is missing', async () => {
    await expect(svc.getProcurementReport('', proj1Id)).rejects.toThrow(
      'organizationId and projectId are required',
    );
  });

  it('throws error when projectId is missing', async () => {
    await expect(svc.getProcurementReport(org1Id, '')).rejects.toThrow(
      'organizationId and projectId are required',
    );
  });
});
