// apps/server/tests/integration/dependency_core.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import type { TaskDTO } from '../../src/modules/project/task/task.types.js';
import type { DependencyDTO } from '../../src/modules/project/dependency/dependency.types.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';

describe('Dependency Core Module (Integration)', () => {
  let app: FastifyInstance;
  let authToken: string;
  let orgId: string;
  let projectId: string;

  let taskAId: string; // Task A — predecessor
  let taskBId: string; // Task B — successor of A
  let taskCId: string; // Task C — successor of B (for cycle tests)

  const runId = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    app = await createTestApp();

    // 1. Create owner + org
    const ownerResult = await createVerifiedUser({ email: `dep_owner_${runId}@example.com` });
    authToken = ownerResult.token;
    const orgResult = await createOrgWithAdmin(app, authToken, `Dep Test Org ${runId}`);
    orgId = orgResult.orgId;

    // 2. Create project
    const projRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: `Dep Test Project ${runId}`, currency: 'USD' },
    });
    expect(projRes.statusCode).toBe(201);
    projectId = projRes.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project.id;

    // 3. Create three tasks for dependency tests
    const createTask = async (name: string) => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name,
          taskType: 'TASK',
          currentStartDate: '2026-10-01',
          currentFinishDate: '2026-10-05',
          currentDurationDays: 5,
        },
      });
      expect(res.statusCode).toBe(201);
      return res.json<ApiSuccessResponse<TaskDTO>>().data.id;
    };

    taskAId = await createTask(`Task A ${runId}`);
    taskBId = await createTask(`Task B ${runId}`);
    taskCId = await createTask(`Task C ${runId}`);
  });

  afterAll(async () => {
    await app.close();
  });

  let depAtoB_id: string;

  // ── 1. Create FS dependency A → B ─────────────────────────────────────────
  it('1. POST /dependencies — creates FS dependency A→B', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        taskId: taskBId,
        predecessorId: taskAId,
        dependencyType: 'FS',
        lagDays: 0,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ApiSuccessResponse<DependencyDTO>>();
    expect(body.success).toBe(true);
    expect(body.data.taskId).toBe(taskBId);
    expect(body.data.predecessorId).toBe(taskAId);
    expect(body.data.dependencyType).toBe('FS');
    expect(body.data.lagDays).toBe(0);
    expect(body.data.projectId).toBe(projectId);
    depAtoB_id = body.data.id;
  });

  // ── 2. Create SS dependency B → C with positive lag ───────────────────────
  it('2. POST /dependencies — creates SS dependency B→C with lag=2', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        taskId: taskCId,
        predecessorId: taskBId,
        dependencyType: 'SS',
        lagDays: 2,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ApiSuccessResponse<DependencyDTO>>();
    expect(body.data.dependencyType).toBe('SS');
    expect(body.data.lagDays).toBe(2);
  });

  // ── 3. List dependencies for project ──────────────────────────────────────
  it('3. GET /dependencies — lists all project dependencies', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<DependencyDTO[]>>();
    expect(body.success).toBe(true);
    expect(body.data.length).toBeGreaterThanOrEqual(2);
    const ids = body.data.map((d) => d.id);
    expect(ids).toContain(depAtoB_id);
  });

  // ── 4. Duplicate dependency → 409 ─────────────────────────────────────────
  it('4. POST /dependencies — duplicate A→B returns 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        taskId: taskBId,
        predecessorId: taskAId,
        dependencyType: 'FS',
      },
    });

    expect(res.statusCode).toBe(409);
  });

  // ── 5. Self-reference → 422 ────────────────────────────────────────────────
  it('5. POST /dependencies — self-reference returns 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        taskId: taskAId,
        predecessorId: taskAId,
        dependencyType: 'FS',
      },
    });

    expect(res.statusCode).toBe(422);
  });

  // ── 6. Cycle detection: adding C → A would create A→B→C→A cycle → 422 ────
  it('6. POST /dependencies — cycle detection prevents C→A (would close A→B→C→A)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        taskId: taskAId,       // task (successor side)
        predecessorId: taskCId, // predecessor — but C is already a successor of A transitively
        dependencyType: 'FS',
      },
    });

    expect(res.statusCode).toBe(422);
    // Error handler maps 422 → UNPROCESSABLE_ENTITY code; cycle message is in .error.message
    const body = res.json<{ error: { code: string; message: string } }>();
    expect(body.error.code).toBe('UNPROCESSABLE_ENTITY');
    expect(body.error.message.toLowerCase()).toContain('cycle');
  });

  // ── 7. FF and SF dependency types are accepted ─────────────────────────────
  it('7. POST /dependencies — FF type is accepted', async () => {
    // Create a fourth task for this test to avoid conflicts
    const t4Res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/tasks`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        name: `Task D ${runId}`,
        taskType: 'TASK',
        currentStartDate: '2026-11-01',
        currentFinishDate: '2026-11-10',
        currentDurationDays: 10,
      },
    });
    const taskDId = t4Res.json<ApiSuccessResponse<TaskDTO>>().data.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        taskId: taskDId,
        predecessorId: taskCId,
        dependencyType: 'FF',
        lagDays: -1, // lead = -1 day
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ApiSuccessResponse<DependencyDTO>>();
    expect(body.data.dependencyType).toBe('FF');
    expect(body.data.lagDays).toBe(-1);
  });

  // ── 8. Delete dependency → 204 ────────────────────────────────────────────
  it('8. DELETE /dependencies/:id — removes A→B', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies/${depAtoB_id}`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(204);

    // Verify it's gone from the list
    const listRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    const list = listRes.json<ApiSuccessResponse<DependencyDTO[]>>().data;
    expect(list.map((d) => d.id)).not.toContain(depAtoB_id);
  });

  // ── 9. Delete non-existent dependency → 404 ───────────────────────────────
  it('9. DELETE /dependencies/:id — non-existent returns 404', async () => {
    const res = await app.inject({
      method: 'DELETE',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies/nonexistent_id`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(404);
  });

  // ── 10. Task not in project → 422 ─────────────────────────────────────────
  it('10. POST /dependencies — task not in this project returns 422', async () => {
    // Use a random non-existent task ID
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/dependencies`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        taskId: 'fake_task_that_does_not_exist',
        predecessorId: taskAId,
        dependencyType: 'FS',
      },
    });

    expect(res.statusCode).toBe(422);
  });
});
