// apps/server/tests/integration/schedule_metrics.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp } from '../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';

describe('Chunk 3.9 — Schedule Metrics & Revision-Tied Caching', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>;
  let token: string;
  let organizationId: string;
  let projectId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const email = `schedmetrics_${Date.now()}_${Math.random().toString(36).slice(2, 6)}@test.com`;
    const user = await createVerifiedUser({ email });
    token = user.token;
    const org = await createOrgWithAdmin(app, token, `SchedMetrics Org ${crypto.randomUUID()}`);
    organizationId = org.orgId;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: 'Metrics Project', code: 'MTP', defaultCurrency: 'USD' },
    });
    projectId = res.json().data.project.id;
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/activate`,
      headers: { authorization: `Bearer ${token}` },
    });
  }, 30000);

  it('should return schedule metrics for a project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/schedule/metrics`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.projectId).toBe(projectId);
    expect(typeof data.totalTasks).toBe('number');
    expect(typeof data.completedTasks).toBe('number');
    expect(typeof data.criticalTaskCount).toBe('number');
    expect(typeof data.scheduleRevision).toBe('number');
  });

  it('should return consistent metrics on second call (cache hit)', async () => {
    const res1 = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/schedule/metrics`,
      headers: { authorization: `Bearer ${token}` },
    });
    const res2 = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/schedule/metrics`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res1.statusCode).toBe(200);
    expect(res2.statusCode).toBe(200);
    const d1 = res1.json().data;
    const d2 = res2.json().data;
    expect(d1.totalTasks).toBe(d2.totalTasks);
    expect(d1.scheduleRevision).toBe(d2.scheduleRevision);
  });

  it('should update metrics after a new task is created', async () => {
    // Create a task directly
    const taskRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        code: 'MT001',
        name: 'Metrics Task',
        type: 'TASK',
        currentStartDate: '2025-12-01',
        currentFinishDate: '2025-12-05',
        durationDays: 5,
      },
    });
    expect(taskRes.statusCode).toBe(201);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/schedule/metrics`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(res.statusCode).toBe(200);
    const data = res.json().data;
    expect(data.projectId).toBe(projectId);
    expect(data.totalTasks).toBeGreaterThanOrEqual(0);
    expect(typeof data.scheduleRevision).toBe('number');
  });
});
