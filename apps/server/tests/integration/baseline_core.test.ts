// apps/server/tests/integration/baseline_core.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import type { TaskDTO } from '../../src/modules/project/task/task.types.js';
import type { BaselineDTO, BaselineComparisonDTO } from '../../src/modules/project/baseline/baseline.types.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';

describe('Schedule Baseline Module (Integration)', () => {
  let app: FastifyInstance;
  let authToken: string;
  let orgId: string;
  let projectId: string;
  let taskId: string;

  let baseline1Id: string;
  let baseline2Id: string;
  let draftBaselineId: string;

  const runId = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    app = await createTestApp();

    const ownerResult = await createVerifiedUser({ email: `baseline_owner_${runId}@example.com` });
    authToken = ownerResult.token;
    const orgResult = await createOrgWithAdmin(app, authToken, `Baseline Test Org ${runId}`);
    orgId = orgResult.orgId;

    const projRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: `Baseline Test Project ${runId}`, currency: 'USD' },
    });
    expect(projRes.statusCode).toBe(201);
    projectId = projRes.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project.id;

    const taskRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Foundation Concrete',
        taskType: 'TASK',
        currentStartDate: '2026-10-01',
        currentFinishDate: '2026-10-05',
        currentDurationDays: 5,
      },
    });
    expect(taskRes.statusCode).toBe(201);
    taskId = taskRes.json<ApiSuccessResponse<TaskDTO>>().data.id;
  }, 30000);


  afterAll(async () => {
    await app.close();
  });

  // ── 1. Create baseline ────────────────────────────────────────────────────
  it('1. POST /baselines — creates snapshot baseline in DRAFT status', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/baselines`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Initial Baseline v1',
        description: 'Approved contract schedule',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ApiSuccessResponse<BaselineDTO>>();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Initial Baseline v1');
    expect(body.data.status).toBe('DRAFT');
    expect(body.data.taskCount).toBe(1);
    baseline1Id = body.data.id;
  });

  // ── 2. Activate baseline ──────────────────────────────────────────────────
  it('2. POST /baselines/:id/activate — activates DRAFT baseline', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/baselines/${baseline1Id}/activate`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<BaselineDTO>>();
    expect(body.data.status).toBe('ACTIVE');
    expect(body.data.activatedAt).toBeDefined();
  });

  // ── 3. Activate new baseline supersedes previous active baseline ─────────
  it('3. POST /baselines — create & activate second baseline supersedes baseline 1', async () => {
    // Create second baseline
    const createRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/baselines`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: 'Revised Baseline v2' },
    });
    expect(createRes.statusCode).toBe(201);
    baseline2Id = createRes.json<ApiSuccessResponse<BaselineDTO>>().data.id;

    // Activate second baseline
    const actRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/baselines/${baseline2Id}/activate`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(actRes.statusCode).toBe(200);
    expect(actRes.json<ApiSuccessResponse<BaselineDTO>>().data.status).toBe('ACTIVE');

    // Verify baseline 1 status is now SUPERSEDED
    const get1Res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/baselines/${baseline1Id}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(get1Res.json<ApiSuccessResponse<BaselineDTO>>().data.status).toBe('SUPERSEDED');
  });

  // ── 4. Immutability enforcement ────────────────────────────────────────────
  it('4. DELETE /baselines/:id — deleting ACTIVE or SUPERSEDED baseline returns 422', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/baselines/${baseline1Id}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(422);
    const body = res.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(body.error.message.toLowerCase()).toContain('draft');
  });


  // ── 5. Delete DRAFT baseline succeeds ──────────────────────────────────────
  it('5. DELETE /baselines/:id — deleting DRAFT baseline returns 204', async () => {
    // Create a temporary DRAFT baseline
    const draftRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/baselines`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: 'Temp Draft Baseline' },
    });
    draftBaselineId = draftRes.json<ApiSuccessResponse<BaselineDTO>>().data.id;

    const deleteRes = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/baselines/${draftBaselineId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(deleteRes.statusCode).toBe(204);
  });

  // ── 6. Baseline variance comparison ───────────────────────────────────────
  it('6. GET /baselines/:id/compare — returns task date variance comparison', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/baselines/${baseline2Id}/compare`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<BaselineComparisonDTO[]>>();
    expect(body.success).toBe(true);
    expect(body.data.length).toBe(1);
    expect(body.data[0]!.taskId).toBe(taskId);
    expect(body.data[0]!.baselineStart).toBe('2026-10-01');
    expect(body.data[0]!.baselineFinish).toBe('2026-10-05');
  });
});
