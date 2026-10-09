import { describe, it, expect, beforeAll } from 'vitest';
import { ScheduleMetricsRepository } from '../../../src/modules/project/schedule-metrics/schedule-metrics.repository.js';
import { getDb } from '../../../src/lib/db/index.js';
import { generateId } from '../../../src/lib/id.js';
import { createTestApp } from '../../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../../helpers/fixtures.js';

describe('F.10 Schedule Metrics Multi-Tenant Scope Regression Test', () => {
  const repo = new ScheduleMetricsRepository();
  const runId = Math.random().toString(36).substring(7);

  let app: Awaited<ReturnType<typeof createTestApp>>;
  let org1Id: string;
  let org2Id: string;
  let proj1Id: string;
  let proj2Id: string;
  // Same logical project code used for both orgs to test collision resistance
  const sharedCode = `TSM${runId.toUpperCase().slice(0, 4)}`;

  beforeAll(async () => {
    app = await createTestApp();
    const db = getDb();

    // Org 1 + project
    const u1 = await createVerifiedUser({ email: `tsm_u1_${runId}@test.dev` });
    const o1 = await createOrgWithAdmin(app, u1.token, `TenantScopeOrg1_${runId}`);
    org1Id = o1.orgId;

    const p1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects`,
      headers: { authorization: `Bearer ${u1.token}` },
      payload: { name: 'TSM Project', code: sharedCode, defaultCurrency: 'USD' },
    });
    proj1Id = p1Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org1Id}/projects/${proj1Id}/activate`,
      headers: { authorization: `Bearer ${u1.token}` },
    });

    // Org 2 + project with same code (simulates project ID collision)
    const u2 = await createVerifiedUser({ email: `tsm_u2_${runId}@test.dev` });
    const o2 = await createOrgWithAdmin(app, u2.token, `TenantScopeOrg2_${runId}`);
    org2Id = o2.orgId;

    const p2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org2Id}/projects`,
      headers: { authorization: `Bearer ${u2.token}` },
      payload: { name: 'TSM Project', code: sharedCode, defaultCurrency: 'USD' },
    });
    proj2Id = p2Res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org2Id}/projects/${proj2Id}/activate`,
      headers: { authorization: `Bearer ${u2.token}` },
    });
  }, 30000);

  it('independently stores and reads metrics for two orgs with same projectId pattern', async () => {
    const db = getDb();

    // Upsert metrics for org1/proj1
    await repo.upsert(db, {
      id: generateId(),
      organizationId: org1Id,
      projectId: proj1Id,
      totalTasks: 10,
      completedTasks: 5,
      criticalTaskCount: 2,
      scheduleRevision: 1,
    });

    // Upsert metrics for org2/proj2 (different org, different project but same code)
    await repo.upsert(db, {
      id: generateId(),
      organizationId: org2Id,
      projectId: proj2Id,
      totalTasks: 20,
      completedTasks: 10,
      criticalTaskCount: 4,
      scheduleRevision: 1,
    });

    const org1Metrics = await repo.findByProject(db, org1Id, proj1Id);
    const org2Metrics = await repo.findByProject(db, org2Id, proj2Id);

    expect(org1Metrics).toBeDefined();
    expect(org1Metrics?.organizationId).toBe(org1Id);
    expect(org1Metrics?.totalTasks).toBe(10);

    expect(org2Metrics).toBeDefined();
    expect(org2Metrics?.organizationId).toBe(org2Id);
    expect(org2Metrics?.totalTasks).toBe(20);
  });

  it('cross-tenant lookup returns undefined — org2 project is invisible to org1 scope', async () => {
    const db = getDb();
    const crossLookup = await repo.findByProject(db, org1Id, proj2Id);
    expect(crossLookup).toBeUndefined();
  });

  it('upsert overwrites correctly under org+project composite conflict target', async () => {
    const db = getDb();

    // Upsert again with new totals for org1/proj1
    await repo.upsert(db, {
      id: generateId(),
      organizationId: org1Id,
      projectId: proj1Id,
      totalTasks: 15,
      completedTasks: 7,
      criticalTaskCount: 3,
      scheduleRevision: 2,
    });

    const updated = await repo.findByProject(db, org1Id, proj1Id);
    expect(updated?.totalTasks).toBe(15);
    expect(updated?.scheduleRevision).toBe(2);

    // Org2 metrics must remain unchanged
    const org2Still = await repo.findByProject(db, org2Id, proj2Id);
    expect(org2Still?.totalTasks).toBe(20);
  });
});
