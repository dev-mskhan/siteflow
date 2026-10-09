// apps/server/tests/integration/reporting/project-health.test.ts
// F.11 — Project Health Report integration tests
// Verifies: source-backed indicators, two-tenant isolation, unavailable coverage reporting

import { describe, it, expect, beforeAll } from 'vitest';
import { ProjectHealthService } from '../../../src/modules/reporting/project-health/project-health.service.js';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';

describe('F.11 Project Health Report — Source-Backed Indicators', () => {
  const runId = Math.random().toString(36).substring(7);
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let org1Id: string;
  let org2Id: string;
  let proj1Id: string;
  let token1: string;
  const svc = new ProjectHealthService();

  beforeAll(async () => {
    app = await createTestApp();

    // Org 1 + project
    const u1 = await createVerifiedUser({ email: `ph_u1_${runId}@test.dev` });
    token1 = u1.token;
    const o1 = await createOrgWithAdmin(app, token1, `PHOrg1_${runId}`);
    org1Id = o1.orgId;

    const p1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects`,
      headers: { authorization: `Bearer ${token1}` },
      payload: { name: 'Health Test Project', code: `PH${runId.slice(0, 4).toUpperCase()}`, defaultCurrency: 'USD' },
    });
    proj1Id = p1Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/activate`,
      headers: { authorization: `Bearer ${token1}` },
    });

    // Org 2 — separate tenant
    const u2 = await createVerifiedUser({ email: `ph_u2_${runId}@test.dev` });
    const o2 = await createOrgWithAdmin(app, u2.token, `PHOrg2_${runId}`);
    org2Id = o2.orgId;
  }, 30000);

  it('returns project health for a valid org/project — all coverage available', async () => {
    const health = await svc.getProjectHealth(org1Id, proj1Id);

    expect(health).not.toBeNull();
    expect(health!.organizationId).toBe(org1Id);
    expect(health!.projectId).toBe(proj1Id);
    expect(health!.projectName).toBe('Health Test Project');
    expect(health!.projectStatus).toBe('ACTIVE');
    expect(health!.defaultCurrency).toBe('USD');
    expect(health!.asOf).toBeDefined();

    // Issues and RFIs and tasks coverage should be available (0 counts, not unavailable)
    expect(health!.issues.coverage.isAvailable).toBe(true);
    expect(health!.rfis.coverage.isAvailable).toBe(true);
    expect(health!.tasks.coverage.isAvailable).toBe(true);

    // No tasks seeded → counts are 0
    expect(health!.issues.openIssues).toBe(0);
    expect(health!.rfis.openRfis).toBe(0);
    expect(health!.tasks.totalTasks).toBe(0);
  });

  it('schedule metrics coverage is unavailable until metrics are calculated', async () => {
    // No schedule metrics computed for proj1 yet
    const health = await svc.getProjectHealth(org1Id, proj1Id);
    expect(health!.schedule.coverage.isAvailable).toBe(false);
    expect(health!.schedule.coverage.reason).toBeDefined();
    expect(health!.schedule.coverage.sourceModule).toBe('schedule-metrics');
  });

  it('returns null for cross-tenant project access — org2 cannot see org1 project', async () => {
    const health = await svc.getProjectHealth(org2Id, proj1Id);
    expect(health).toBeNull();
  });

  it('returns null for non-existent project', async () => {
    const health = await svc.getProjectHealth(org1Id, 'non-existent-proj-id');
    expect(health).toBeNull();
  });

  it('throws for missing organizationId', async () => {
    await expect(svc.getProjectHealth('', proj1Id)).rejects.toThrow(
      'organizationId and projectId are required',
    );
  });

  it('throws for missing projectId', async () => {
    await expect(svc.getProjectHealth(org1Id, '')).rejects.toThrow(
      'organizationId and projectId are required',
    );
  });

  it('task completion rate is 0 when no tasks exist', async () => {
    const health = await svc.getProjectHealth(org1Id, proj1Id);
    expect(health!.tasks.completionRate).toBe(0);
    expect(health!.schedule.completionRate).toBe(0);
  });
});
