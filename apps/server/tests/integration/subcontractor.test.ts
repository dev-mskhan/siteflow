import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq, and, sql } from 'drizzle-orm';
import { getDb } from '../../src/lib/db/index.js';
import { createTestApp } from '../helpers/test-app.js';
import {
  auditLogs,
  outboxEvents,
  projectMembers,
  projectSubcontractors,
  subcontractorContacts,
  subcontractors,
  subcontractorTaskAssignments,
} from '@siteflow/database/schema';
import {
  addMemberDirectly,
  createOrgWithAdmin,
  createVerifiedUser,
} from '../helpers/fixtures.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import type { TaskDTO } from '../../src/modules/project/task/task.types.js';

describe('Project subcontractor module (integration)', () => {
  let app: FastifyInstance;
  let ownerToken: string;
  let ownerUserId: string;
  let orgId: string;
  let projectId: string;
  let otherOrgId: string;
  let otherProjectId: string;
  let otherUserToken: string;
  let memberToken: string;
  let memberUserId: string;
  let subcontractorId: string;
  let subcontractorContactId: string;
  let taskId: string;

  const runId = crypto.randomUUID().replace(/-/g, '').slice(0, 10);

  const createProject = async (token: string, targetOrgId: string, name: string) => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${targetOrgId}/projects`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name, currency: 'USD' },
    });
    expect(res.statusCode).toBe(201);
    return res.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project;
  };

  const createTask = async (targetProjectId: string, taskName: string) => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${targetProjectId}/tasks`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: taskName,
        taskType: 'TASK',
        currentStartDate: '2026-10-01',
        currentFinishDate: '2026-10-05',
        currentDurationDays: 5,
      },
    });
    expect(res.statusCode).toBe(201);
    return res.json<ApiSuccessResponse<TaskDTO>>().data;
  };

  const createSubcontractorRecord = async (targetOrgId: string, legalName: string, status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' = 'ACTIVE') => {
    const db = getDb();
    const row = await db
      .insert(subcontractors)
      .values({
        id: crypto.randomUUID(),
        organizationId: targetOrgId,
        legalName,
        displayName: legalName,
        status,
        primaryEmail: `${legalName.toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/\.$/, '')}@example.com`,
      })
      .returning();
    return row[0]!;
  };

  const ensureProjectMembership = async (targetProjectId: string, targetOrgId: string, userId: string, role: 'PROJECT_MEMBER' | 'PROJECT_MANAGER' = 'PROJECT_MEMBER') => {
    const db = getDb();
    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      projectId: targetProjectId,
      organizationId: targetOrgId,
      userId,
      role,
      status: 'ACTIVE',
      addedBy: ownerUserId,
    });
  };

  beforeAll(async () => {
    app = await createTestApp();

    const owner = await createVerifiedUser({ email: `sub_owner_${runId}@example.com` });
    ownerToken = owner.token;
    ownerUserId = owner.user.id;

    const org = await createOrgWithAdmin(app, ownerToken, `Subcontractor Test Org ${runId}`);
    orgId = org.orgId;

    const project = await createProject(ownerToken, orgId, `Subcontractor Project ${runId}`);
    projectId = project.id;

    const otherOwner = await createVerifiedUser({ email: `sub_other_${runId}@example.com` });
    otherUserToken = otherOwner.token;
    const otherOrg = await createOrgWithAdmin(app, otherUserToken, `Other Org ${runId}`);
    otherOrgId = otherOrg.orgId;

    const otherProject = await createProject(otherUserToken, otherOrgId, `Other Project ${runId}`);
    otherProjectId = otherProject.id;

    const member = await createVerifiedUser({ email: `sub_member_${runId}@example.com` });
    memberToken = member.token;
    memberUserId = member.user.id;
    await addMemberDirectly(orgId, memberUserId, org.roleMap.get('Client')!);
    await ensureProjectMembership(projectId, orgId, memberUserId, 'PROJECT_MEMBER');
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('1. POST /projects/:projectId/subcontractors assigns a valid subcontractor to the project', async () => {
    const subcontractor = await createSubcontractorRecord(orgId, `Alpha Subcontractor ${runId}`);
    subcontractorId = subcontractor.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        subcontractorId,
        scopeDescription: 'Masonry package',
        contractValue: '15000.00',
        currencyCode: 'USD',
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ApiSuccessResponse<any>>();
    expect(body.success).toBe(true);
    expect(body.data.subcontractorId).toBe(subcontractorId);
    expect(body.data.projectId).toBe(projectId);
    expect(body.data.status).toBe('ACTIVE');

    const row = await getDb()
      .select()
      .from(projectSubcontractors)
      .where(and(eq(projectSubcontractors.projectId, projectId), eq(projectSubcontractors.subcontractorId, subcontractorId)));
    expect(row).toHaveLength(1);
    expect(row[0]?.organizationId).toBe(orgId);
  });

  it('2. POST /projects/:projectId/subcontractors rejects duplicate project assignment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { subcontractorId },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('3. POST /projects/:projectId/subcontractors rejects inactive subcontractor assignment', async () => {
    const inactive = await createSubcontractorRecord(orgId, `Inactive Subcontractor ${runId}`, 'INACTIVE');
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { subcontractorId: inactive.id },
    });

    expect(res.statusCode).toBe(422);
    expect(res.json().error.code).toBe('UNPROCESSABLE_ENTITY');
  });

  it('4. POST /projects/:projectId/subcontractors rejects subcontractor from another org', async () => {
    const foreignSub = await createSubcontractorRecord(otherOrgId, `Foreign Subcontractor ${runId}`);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { subcontractorId: foreignSub.id },
    });

    expect([403, 404]).toContain(res.statusCode);
  });

  it('5. POST /projects/:projectId/subcontractors rejects another org project access', async () => {
    const foreignSub = await createSubcontractorRecord(orgId, `Local For Other Project ${runId}`);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${otherProjectId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { subcontractorId: foreignSub.id },
    });

    expect([403, 404]).toContain(res.statusCode);
  });

  it('6. GET /projects/:projectId/subcontractors returns only this project assignments', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<any[]>>();
    expect(body.success).toBe(true);
    expect(body.data.some((entry: any) => entry.subcontractorId === subcontractorId)).toBe(true);
  });

  it('7. GET /projects/:projectId/subcontractors/:subcontractorId returns assignment details', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<any>>();
    expect(body.data.subcontractorId).toBe(subcontractorId);
    expect(body.data.projectId).toBe(projectId);
  });

  it('8. PATCH /projects/:projectId/subcontractors/:subcontractorId updates project assignment state', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        status: 'INACTIVE',
        scopeDescription: 'Updated masonry package',
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<any>>();
    expect(body.data.status).toBe('INACTIVE');
    expect(body.data.scopeDescription).toBe('Updated masonry package');

    const reactivated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: 'ACTIVE' },
    });
    expect(reactivated.statusCode).toBe(200);
    expect(reactivated.json<ApiSuccessResponse<any>>().data.status).toBe('ACTIVE');
  });

  it('9. POST /projects/:projectId/subcontractors/:subcontractorId/contacts creates a primary contact', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/contacts`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: `Primary Contact ${runId}`,
        email: `primary.${runId}@example.com`,
        isPrimary: true,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ApiSuccessResponse<any>>();
    subcontractorContactId = body.data.id;
    expect(body.data.isPrimary).toBe(true);
    expect(body.data.email).toBe(`primary.${runId}@example.com`);
  });

  it('10. POST /projects/:projectId/subcontractors/:subcontractorId/contacts rejects duplicate primary contacts', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/contacts`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        name: `Backup Contact ${runId}`,
        email: `backup.${runId}@example.com`,
        isPrimary: true,
      },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('11. PATCH /.../contacts/:contactId updates contact status and promotes a new primary', async () => {
    const secondContact = await getDb()
      .insert(subcontractorContacts)
      .values({
        id: crypto.randomUUID(),
        subcontractorId,
        organizationId: orgId,
        name: `Backup Contact ${runId}`,
        email: `backup.${runId}@example.com`,
        isPrimary: false,
        isActive: true,
      })
      .returning();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/contacts/${secondContact[0]!.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isPrimary: true },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<any>>();
    expect(body.data.isPrimary).toBe(true);

    const oldPrimary = await getDb()
      .select()
      .from(subcontractorContacts)
      .where(eq(subcontractorContacts.id, subcontractorContactId));
    expect(oldPrimary[0]?.isPrimary).toBe(false);
  });

  it('12. POST /projects/:projectId/subcontractors/:subcontractorId/task-assignments creates a task assignment and writes an outbox event', async () => {
    const task = await createTask(projectId, `Subcontractor Task ${runId}`);
    taskId = task.id;

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/task-assignments`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { taskId, assignmentRole: 'MASONRY' },
    });

    expect(res.statusCode).toBe(201);
    const body = res.json<ApiSuccessResponse<any>>();
    expect(body.data.taskId).toBe(taskId);
    expect(body.data.subcontractorId).toBe(subcontractorId);

    const assignmentRow = await getDb()
      .select()
      .from(subcontractorTaskAssignments)
      .where(and(eq(subcontractorTaskAssignments.taskId, taskId), eq(subcontractorTaskAssignments.subcontractorId, subcontractorId)));
    expect(assignmentRow).toHaveLength(1);

    const outbox = await getDb()
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.organizationId, orgId),
          eq(outboxEvents.eventType, 'procurement.subcontractor.assigned'),
          sql`${outboxEvents.payload} ->> 'taskId' = ${taskId}`,
        ),
      );
    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.payload).toMatchObject({ taskId, organizationId: orgId });

    const audit = await getDb()
      .select()
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.organizationId, orgId),
          eq(auditLogs.action, 'subcontractor.task.assigned'),
          eq(auditLogs.resourceId, assignmentRow[0]!.id),
        ),
      );
    expect(audit).toHaveLength(1);
  });

  it('13. POST /.../task-assignments rejects duplicate task assignment', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/task-assignments`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { taskId, assignmentRole: 'MASONRY' },
    });

    expect(res.statusCode).toBe(409);
    expect(res.json().error.code).toBe('CONFLICT');
  });

  it('14. unauthenticated project subcontractor access is rejected with 401', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
    });

    expect(res.statusCode).toBe(401);
  });

  it('15. project members without subcontractor permissions receive 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { subcontractorId },
    });

    expect(res.statusCode).toBe(403);
  });

  it('16. list route omits another org assignment by explicit ID', async () => {
    const foreignSub = await createSubcontractorRecord(otherOrgId, `Other Org Sub ${runId}`);
    await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${otherOrgId}/projects/${otherProjectId}/subcontractors`,
      headers: { authorization: `Bearer ${otherUserToken}` },
      payload: { subcontractorId: foreignSub.id },
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json<ApiSuccessResponse<any[]>>().data.some((entry) => entry.subcontractorId === foreignSub.id)).toBe(false);
  });

  it('17. GET /projects/:projectId/subcontractors/:subcontractorId rejects a foreign org assignment', async () => {
    const foreignSub = await createSubcontractorRecord(otherOrgId, `Foreign Get ${runId}`);
    const assignment = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${otherOrgId}/projects/${otherProjectId}/subcontractors`,
      headers: { authorization: `Bearer ${otherUserToken}` },
      payload: { subcontractorId: foreignSub.id },
    });
    expect(assignment.statusCode).toBe(201);

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${foreignSub.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect([403, 404]).toContain(res.statusCode);
  });

  it('18. org-scoped subcontractor CRUD routes are not registered in the current app surface', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        legalName: 'Org-level subcontractor',
        displayName: 'Org-level subcontractor',
      },
    });

    expect(res.statusCode).toBe(404);
  });

  it('19. rejects malformed project assignment values without writing a row', async () => {
    const candidate = await createSubcontractorRecord(orgId, `Invalid Assignment ${runId}`);
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { subcontractorId: candidate.id, contractValue: 'not-a-currency-value' },
    });

    expect(res.statusCode).toBe(422);
    const rows = await getDb()
      .select()
      .from(projectSubcontractors)
      .where(
        and(
          eq(projectSubcontractors.projectId, projectId),
          eq(projectSubcontractors.subcontractorId, candidate.id),
        ),
      );
    expect(rows).toHaveLength(0);
  });

  it('20. returns not found when assigning an unknown subcontractor', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { subcontractorId: crypto.randomUUID() },
    });

    expect(res.statusCode).toBe(404);
  });

  it('21. returns not found when reading a subcontractor not assigned to the project', async () => {
    const unassigned = await createSubcontractorRecord(orgId, `Unassigned ${runId}`);
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${unassigned.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(res.statusCode).toBe(404);
  });

  it('22. returns not found when updating a subcontractor not assigned to the project', async () => {
    const unassigned = await createSubcontractorRecord(orgId, `Unassigned Update ${runId}`);
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${unassigned.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: 'INACTIVE' },
    });

    expect(res.statusCode).toBe(404);
  });

  it('23. rejects malformed contact input without persisting a contact', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/contacts`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { name: `Invalid Contact ${runId}`, email: 'not-an-email' },
    });

    expect(res.statusCode).toBe(422);
    const rows = await getDb()
      .select()
      .from(subcontractorContacts)
      .where(
        and(
          eq(subcontractorContacts.organizationId, orgId),
          eq(subcontractorContacts.subcontractorId, subcontractorId),
          eq(subcontractorContacts.name, `Invalid Contact ${runId}`),
        ),
      );
    expect(rows).toHaveLength(0);
  });

  it('24. prevents updating a contact through a different subcontractor route', async () => {
    const secondSubcontractor = await createSubcontractorRecord(
      orgId,
      `Contact Scope Subcontractor ${runId}`,
    );
    const [foreignContact] = await getDb()
      .insert(subcontractorContacts)
      .values({
        id: crypto.randomUUID(),
        organizationId: orgId,
        subcontractorId: secondSubcontractor.id,
        name: `Scoped Contact ${runId}`,
        isPrimary: false,
        isActive: true,
      })
      .returning();

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/contacts/${foreignContact!.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { isActive: false },
    });

    expect(res.statusCode).toBe(404);
    const persisted = await getDb()
      .select()
      .from(subcontractorContacts)
      .where(eq(subcontractorContacts.id, foreignContact!.id));
    expect(persisted[0]?.isActive).toBe(true);
  });

  it('25. rejects task assignment when the project subcontractor assignment is inactive', async () => {
    const inactiveSub = await createSubcontractorRecord(orgId, `Inactive Assignment ${runId}`);
    const assignRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { subcontractorId: inactiveSub.id },
    });
    expect(assignRes.statusCode).toBe(201);

    const deactivateRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${inactiveSub.id}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { status: 'INACTIVE' },
    });
    expect(deactivateRes.statusCode).toBe(200);

    const res = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${inactiveSub.id}/task-assignments`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { taskId, assignmentRole: 'MASONRY' },
    });
    expect(res.statusCode).toBe(404);

    const assignments = await getDb()
      .select()
      .from(subcontractorTaskAssignments)
      .where(
        and(
          eq(subcontractorTaskAssignments.organizationId, orgId),
          eq(subcontractorTaskAssignments.projectId, projectId),
          eq(subcontractorTaskAssignments.subcontractorId, inactiveSub.id),
          eq(subcontractorTaskAssignments.taskId, taskId),
        ),
      );
    expect(assignments).toHaveLength(0);
  });

  it('26. removes a task assignment and reports a repeated removal as not found', async () => {
    const assignment = await getDb()
      .select()
      .from(subcontractorTaskAssignments)
      .where(
        and(
          eq(subcontractorTaskAssignments.organizationId, orgId),
          eq(subcontractorTaskAssignments.projectId, projectId),
          eq(subcontractorTaskAssignments.subcontractorId, subcontractorId),
          eq(subcontractorTaskAssignments.taskId, taskId),
        ),
      );
    expect(assignment).toHaveLength(1);

    const url = `/api/v1/organizations/${orgId}/projects/${projectId}/subcontractors/${subcontractorId}/task-assignments/${taskId}`;
    const removed = await app.inject({
      method: 'DELETE',
      url,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(removed.statusCode).toBe(204);

    const rowsAfterDelete = await getDb()
      .select()
      .from(subcontractorTaskAssignments)
      .where(
        and(
          eq(subcontractorTaskAssignments.organizationId, orgId),
          eq(subcontractorTaskAssignments.projectId, projectId),
          eq(subcontractorTaskAssignments.subcontractorId, subcontractorId),
          eq(subcontractorTaskAssignments.taskId, taskId),
        ),
      );
    expect(rowsAfterDelete).toHaveLength(0);

    const repeatedRemoval = await app.inject({
      method: 'DELETE',
      url,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(repeatedRemoval.statusCode).toBe(404);
  });
});
