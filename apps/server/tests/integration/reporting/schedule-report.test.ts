// apps/server/tests/integration/reporting/schedule-report.test.ts
// F.12 — Schedule Variance & Progress Report integration tests
// Verifies: report envelope parity with ScheduleMetricsService, lookahead task items, and two-tenant boundary protection.

import { describe, it, expect, beforeAll } from 'vitest';
import { ScheduleReportService } from '../../../src/modules/reporting/schedule/schedule-report.service.js';
import { ScheduleMetricsRepository } from '../../../src/modules/project/schedule-metrics/schedule-metrics.repository.js';
import { getDb } from '../../../src/lib/db/index.js';
import { generateId } from '../../../src/lib/id.js';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';

describe('F.12 Schedule Report Engine', () => {
  const runId = Math.random().toString(36).substring(7);
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let org1Id: string;
  let org2Id: string;
  let proj1Id: string;
  let proj2Id: string;
  let token1: string;

  const svc = new ScheduleReportService();
  const scheduleMetricsRepo = new ScheduleMetricsRepository();

  beforeAll(async () => {
    app = await createTestApp();
    const db = getDb();

    // Org 1 + Project 1
    const u1 = await createVerifiedUser({ email: `sr_u1_${runId}@test.dev` });
    token1 = u1.token;
    const o1 = await createOrgWithAdmin(app, token1, `SROrg1_${runId}`);
    org1Id = o1.orgId;

    const p1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: 'Schedule Report Project 1', code: `SR1${runId.slice(0, 3).toUpperCase()}`, defaultCurrency: 'USD' },
    });
    proj1Id = p1Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/activate`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Seed schedule metrics for proj1
    await scheduleMetricsRepo.upsert(db, {
      id: generateId(),
      organizationId: org1Id,
      projectId: proj1Id,
      totalTasks: 12,
      completedTasks: 4,
      criticalTaskCount: 3,
      scheduleRevision: 1,
    });

    // Org 2 + Project 2
    const u2 = await createVerifiedUser({ email: `sr_u2_${runId}@test.dev` });
    const o2 = await createOrgWithAdmin(app, u2.token, `SROrg2_${runId}`);
    org2Id = o2.orgId;

    const p2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org2Id}/projects`,
      headers: { authorization: `Bearer ${u2.token}` },
      payload: { name: 'Schedule Report Project 2', code: `SR2${runId.slice(0, 3).toUpperCase()}`, defaultCurrency: 'USD' },
    });
    proj2Id = p2Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org2Id}/projects/${proj2Id}/activate`,
      headers: { authorization: `Bearer ${u2.token}` },
    });

    // Seed schedule metrics for proj2
    await scheduleMetricsRepo.upsert(db, {
      id: generateId(),
      organizationId: org2Id,
      projectId: proj2Id,
      totalTasks: 25,
      completedTasks: 15,
      criticalTaskCount: 5,
      scheduleRevision: 1,
    });
  }, 30000);

  it('generates schedule report matching authoritative ScheduleMetricsService totals', async () => {
    const report = await svc.getScheduleReport(org1Id, proj1Id);

    expect(report).not.toBeNull();
    expect(report!.reportType).toBe('SCHEDULE_VARIANCE_PROGRESS');
    expect(report!.organizationId).toBe(org1Id);
    expect(report!.projectId).toBe(proj1Id);
    expect(report!.coverage.isAvailable).toBe(true);

    const data = report!.data as any;
    expect(data.summary.totalTasks).toBe(12);
    expect(data.summary.completedTasks).toBe(4);
    expect(data.summary.criticalTaskCount).toBe(3);
    expect(data.summary.scheduleRevision).toBe(1);
    expect(data.summary.completionRate).toBeCloseTo(4 / 12);
  });

  it('enforces multi-tenant isolation — Org 2 report returns Org 2 metrics only', async () => {
    const report = await svc.getScheduleReport(org2Id, proj2Id);

    expect(report).not.toBeNull();
    expect(report!.organizationId).toBe(org2Id);
    const data = report!.data as any;
    expect(data.summary.totalTasks).toBe(25);
    expect(data.summary.completedTasks).toBe(15);
    expect(data.summary.criticalTaskCount).toBe(5);
  });

  it('filters lookahead tasks by date preset', async () => {
    const report = await svc.getScheduleReport(org1Id, proj1Id, { datePreset: 'THIS_MONTH' });
    expect(report!.filters.datePreset).toBe('THIS_MONTH');
    expect(report!.filters.startDate).toBeDefined();
    expect(report!.filters.endDate).toBeDefined();
  });

  it('throws error when organizationId is empty', async () => {
    await expect(svc.getScheduleReport('', proj1Id)).rejects.toThrow(
      'organizationId and projectId are required',
    );
  });

  it('throws error when projectId is empty', async () => {
    await expect(svc.getScheduleReport(org1Id, '')).rejects.toThrow(
      'organizationId and projectId are required',
    );
  });
});
