// apps/server/tests/integration/schedule_engine.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import type { TaskDTO } from '../../src/modules/project/task/task.types.js';
import type { RecalculationResponse } from '../../src/modules/project/engine/schedule.service.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';

describe('Schedule Engine Module (Integration)', () => {
  let app: FastifyInstance;
  let authToken: string;
  let orgId: string;
  let projectId: string;

  let taskAId: string;
  let taskBId: string;
  let taskCId: string;

  const runId = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    app = await createTestApp();

    const ownerResult = await createVerifiedUser({ email: `engine_owner_${runId}@example.com` });
    authToken = ownerResult.token;
    const orgResult = await createOrgWithAdmin(app, authToken, `Engine Test Org ${runId}`);
    orgId = orgResult.orgId;

    // Create project with plannedStartDate = 2026-10-05 (Monday)
    const projRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: `Engine Test Project ${runId}`,
        currency: 'USD',
        plannedStartDate: '2026-10-05',
      },
    });
    expect(projRes.statusCode).toBe(201);
    projectId = projRes.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project.id;

    // Create Task A (5 days: Mon Oct 5 -> Fri Oct 9)
    const resA = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Task A (Excavation)',
        taskType: 'TASK',
        currentStartDate: '2026-10-05',
        currentFinishDate: '2026-10-09',
        currentDurationDays: 5,
      },
    });
    expect(resA.statusCode).toBe(201);
    taskAId = resA.json<ApiSuccessResponse<TaskDTO>>().data.id;

    // Create Task B (3 days: Mon Oct 12 -> Wed Oct 14)
    const resB = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Task B (Foundation)',
        taskType: 'TASK',
        currentStartDate: '2026-10-12',
        currentFinishDate: '2026-10-14',
        currentDurationDays: 3,
      },
    });
    expect(resB.statusCode).toBe(201);
    taskBId = resB.json<ApiSuccessResponse<TaskDTO>>().data.id;

    // Create Task C (Milestone: Wed Oct 14)
    const resC = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Milestone C (Foundation Complete)',
        taskType: 'MILESTONE',
        currentStartDate: '2026-10-14',
        currentFinishDate: '2026-10-14',
        currentDurationDays: 0,
      },
    });
    expect(resC.statusCode).toBe(201);
    taskCId = resC.json<ApiSuccessResponse<TaskDTO>>().data.id;

    // Add dependencies: A -> B (FS, 0 lag) and B -> C (FS, 0 lag)
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { taskId: taskBId, predecessorId: taskAId, dependencyType: 'FS', lagDays: 0 },
    });

    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { taskId: taskCId, predecessorId: taskBId, dependencyType: 'FS', lagDays: 0 },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  // ── 1. Recalculate schedule ────────────────────────────────────────────────
  it('1. POST /schedule/recalculate — computes dates, float, and critical path', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/schedule/recalculate`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<RecalculationResponse>>();
    expect(body.success).toBe(true);
    expect(body.data.queued).toBe(false);
    expect(body.data.revision).toBe(2); // Initial revision was 1, now incremented to 2
    expect(body.data.criticalPathCount).toBeGreaterThan(0);

    // Verify task dates after recalculation
    const getARes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${taskAId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    const taskA = getARes.json<ApiSuccessResponse<TaskDTO>>().data;
    expect(taskA.currentStartDate).toBe('2026-10-05');
    expect(taskA.currentFinishDate).toBe('2026-10-09');
    expect(taskA.isCritical).toBe(true);

    const getBRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${taskBId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    const taskB = getBRes.json<ApiSuccessResponse<TaskDTO>>().data;
    // Task A finishes Fri Oct 9, Task B starts Mon Oct 12
    expect(taskB.currentStartDate).toBe('2026-10-12');
    expect(taskB.currentFinishDate).toBe('2026-10-14');
    expect(taskB.isCritical).toBe(true);
  });

  // ── 2. Revision conflict test ─────────────────────────────────────────────
  it('2. POST /schedule/recalculate?expectedRevision=1 — returns 409 conflict when revision mismatched', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/schedule/recalculate?expectedRevision=1`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(409);
    const body = res.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe('CONFLICT');
    expect(body.error.message).toContain('revision conflict');
  });

  // ── 3. Recalculate with expectedRevision=2 succeeds ───────────────────────
  it('3. POST /schedule/recalculate?expectedRevision=2 — succeeds and increments revision to 3', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/schedule/recalculate?expectedRevision=2`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<RecalculationResponse>>();
    expect(body.data.revision).toBe(3);
  });
});
