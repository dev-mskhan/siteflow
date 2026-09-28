// apps/server/tests/integration/task_core.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import type { TaskDTO, TaskListDTO } from '../../src/modules/project/task/task.types.js';
import { createVerifiedUser, createOrgWithAdmin, addMemberDirectly } from '../helpers/fixtures.js';

describe('Task Core Module (Integration)', () => {
  let app: FastifyInstance;
  let authToken: string;
  let ownerUserId: string;
  let orgId: string;
  let projectId: string;

  let otherOrgId: string;
  let otherAuthToken: string;

  const runId = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    app = await createTestApp();

    // 1. Create owner and primary org
    const ownerResult = await createVerifiedUser({ email: `task_owner_${runId}@example.com` });
    ownerUserId = ownerResult.user.id;
    authToken = ownerResult.token;

    const orgResult = await createOrgWithAdmin(app, authToken, `Task Test Org ${runId}`);
    orgId = orgResult.orgId;

    // 2. Create a project
    const createProjectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: `Task Test Project ${runId}`,
        currency: 'USD',
      },
    });
    expect(createProjectRes.statusCode).toBe(201);
    const projBody = createProjectRes.json<ApiSuccessResponse<{ project: ProjectDTO }>>();
    projectId = projBody.data.project.id;

    // 3. Create second org for IDOR checks
    const otherResult = await createVerifiedUser({ email: `task_other_${runId}@example.com` });
    otherAuthToken = otherResult.token;
    const otherOrgResult = await createOrgWithAdmin(app, otherAuthToken, `Other Org ${runId}`);
    otherOrgId = otherOrgResult.orgId;
  });

  afterAll(async () => {
    await app.close();
  });

  let createdTaskId: string;
  let createdTaskVersion: number;
  let summaryTaskId: string;

  it('1. POST /tasks — should create a standard TASK with auto taskCode (T-001)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Site Excavation',
        description: 'Excavate foundation pit',
        taskType: 'TASK',
        priority: 'HIGH',
        currentStartDate: '2026-10-01',
        currentFinishDate: '2026-10-05',
        currentDurationDays: 5,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ApiSuccessResponse<TaskDTO>>();
    expect(body.success).toBe(true);
    expect(body.data.name).toBe('Site Excavation');
    expect(body.data.taskCode).toBe('T-001');
    expect(body.data.taskType).toBe('TASK');
    expect(body.data.status).toBe('NOT_STARTED');
    expect(body.data.currentDurationDays).toBe(5);

    createdTaskId = body.data.id;
    createdTaskVersion = body.data.version;
  });

  it('2. POST /tasks — should create a MILESTONE task with 0 duration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Foundation Approval Milestone',
        taskType: 'MILESTONE',
        currentStartDate: '2026-10-05',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ApiSuccessResponse<TaskDTO>>();
    expect(body.data.taskType).toBe('MILESTONE');
    expect(body.data.currentDurationDays).toBe(0);
    expect(body.data.taskCode).toBe('T-002');
  });

  it('3. GET /tasks — should list created tasks for project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<TaskDTO[]>>();
    expect(body.data.length).toBe(2);
  });

  it('4. GET /tasks/:taskId — should fetch single task by ID', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${createdTaskId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<TaskDTO>>();
    expect(body.data.id).toBe(createdTaskId);
    expect(body.data.name).toBe('Site Excavation');
  });

  it('5. PATCH /tasks/:taskId — should update task metadata and increment version', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${createdTaskId}`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Deep Site Excavation',
        description: 'Updated excavation scope',
        expectedVersion: createdTaskVersion,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<TaskDTO>>();
    expect(body.data.name).toBe('Deep Site Excavation');
    expect(body.data.version).toBe(createdTaskVersion + 1);
    createdTaskVersion = body.data.version;
  });

  it('6. PATCH /tasks/:taskId — should fail with 409 Conflict if expectedVersion is stale', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${createdTaskId}`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Stale Edit',
        expectedVersion: createdTaskVersion - 1,
      },
    });

    expect(res.statusCode).toBe(409);
  });

  it('7. Parent-Child Summary Rules — should auto-aggregate dates and progress from child tasks', async () => {
    // A. Create SUMMARY task
    const summaryRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Substructure Summary',
        taskType: 'SUMMARY',
      },
    });
    expect(summaryRes.statusCode).toBe(201);
    summaryTaskId = summaryRes.json<ApiSuccessResponse<TaskDTO>>().data.id;

    // B. Create Child Task 1 (Oct 01 to Oct 10, 50% complete)
    const child1Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Piling Work',
        parentTaskId: summaryTaskId,
        taskType: 'TASK',
        currentStartDate: '2026-10-01',
        currentFinishDate: '2026-10-10',
        progressPercent: 50,
      },
    });
    expect(child1Res.statusCode).toBe(201);

    // C. Create Child Task 2 (Oct 05 to Oct 20, 0% complete)
    const child2Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: 'Footing Concrete',
        parentTaskId: summaryTaskId,
        taskType: 'TASK',
        currentStartDate: '2026-10-05',
        currentFinishDate: '2026-10-20',
        progressPercent: 0,
      },
    });
    expect(child2Res.statusCode).toBe(201);

    // D. Check SUMMARY task derived values: min start = Oct 01, max finish = Oct 20, avg progress = 25%
    const getSummaryRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${summaryTaskId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(getSummaryRes.statusCode).toBe(200);
    const summaryDTO = getSummaryRes.json<ApiSuccessResponse<TaskDTO>>().data;
    expect(summaryDTO.currentStartDate).toBe('2026-10-01');
    expect(summaryDTO.currentFinishDate).toBe('2026-10-20');
    expect(summaryDTO.progressPercent).toBe(25);
  });

  it('8. Parent-Child Summary Rules — direct date mutation on SUMMARY task must throw 400/422', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${summaryTaskId}`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        currentStartDate: '2026-12-01',
        expectedVersion: 1,
      },
    });

    expect(res.statusCode).toBe(422);
  });

  it('9. POST /tasks/:taskId/transition — status transition NOT_STARTED -> IN_PROGRESS -> COMPLETED', async () => {
    // A. Transition to IN_PROGRESS
    const res1 = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${createdTaskId}/transition`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        status: 'IN_PROGRESS',
        expectedVersion: createdTaskVersion,
      },
    });

    expect(res1.statusCode).toBe(200);
    const body1 = res1.json<ApiSuccessResponse<TaskDTO>>();
    expect(body1.data.status).toBe('IN_PROGRESS');
    expect(body1.data.actualStartDate).toBeTruthy();
    createdTaskVersion = body1.data.version;

    // B. Transition to COMPLETED
    const res2 = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${createdTaskId}/transition`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        status: 'COMPLETED',
        expectedVersion: createdTaskVersion,
      },
    });

    expect(res2.statusCode).toBe(200);
    const body2 = res2.json<ApiSuccessResponse<TaskDTO>>();
    expect(body2.data.status).toBe('COMPLETED');
    expect(body2.data.actualFinishDate).toBeTruthy();
    expect(body2.data.progressPercent).toBe(100);
    createdTaskVersion = body2.data.version;
  });

  it('10. DELETE /tasks/:taskId — soft delete task by setting status to CANCELLED', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${createdTaskId}`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        expectedVersion: createdTaskVersion,
      },
    });

    expect(res.statusCode).toBe(200);

    const checkRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks/${createdTaskId}`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    expect(checkRes.statusCode).toBe(200);
    expect(checkRes.json<ApiSuccessResponse<TaskDTO>>().data.status).toBe('CANCELLED');
  });

  it('11. IDOR Check — cannot access tasks across organizations (returns 404)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${otherOrgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${otherAuthToken}` },
    });

    expect(res.statusCode).toBe(404);
  });
});
