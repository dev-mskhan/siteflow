import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { projectMembers, projects } from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createTestApp } from '../helpers/test-app.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);

describe('Project list access scope (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let ownerToken: string;
  let ownerUserId: string;
  let memberToken: string;
  let memberUserId: string;
  let assignedProjectId: string;
  let unassignedProjectId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `project_list_owner_${runId}@example.com` });
    ownerToken = owner.token;
    ownerUserId = owner.user.id;
    const org = await createOrgWithAdmin(app, owner.token, `Project List Scope ${runId}`);
    organizationId = org.orgId;

    const projectManager = await createVerifiedUser({
      email: `project_list_member_${runId}@example.com`,
    });
    memberToken = projectManager.token;
    memberUserId = projectManager.user.id;
    await addMemberDirectly(
      organizationId,
      memberUserId,
      org.roleMap.get('Project Manager')!,
    );

    assignedProjectId = crypto.randomUUID();
    unassignedProjectId = crypto.randomUUID();
    await getDb()
      .insert(projects)
      .values([
        {
          id: assignedProjectId,
          organizationId,
          projectNumber: `PL-${runId}`,
          name: `Assigned Project ${runId}`,
          currency: 'USD',
        },
        {
          id: unassignedProjectId,
          organizationId,
          projectNumber: `PU-${runId}`,
          name: `Unassigned Project ${runId}`,
          currency: 'USD',
        },
      ]);
    await getDb()
      .insert(projectMembers)
      .values({
        id: crypto.randomUUID(),
        projectId: assignedProjectId,
        organizationId,
        userId: memberUserId,
        role: 'PROJECT_MANAGER',
        status: 'ACTIVE',
        addedBy: ownerUserId,
      });
  }, 30_000);

  afterAll(async () => {
    await app?.close();
  });

  it('lists only assigned projects to organization members without cross-project authority', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects`,
      headers: { authorization: `Bearer ${memberToken}` },
    });

    expect(response.statusCode).toBe(200);
    const visibleProjectIds = response
      .json()
      .data.projects.map((project: { id: string }) => project.id);
    expect(visibleProjectIds).toContain(assignedProjectId);
    expect(visibleProjectIds).not.toContain(unassignedProjectId);
  });

  it('preserves organization-wide project visibility for administrators', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });

    expect(response.statusCode).toBe(200);
    const visibleProjectIds = response
      .json()
      .data.projects.map((project: { id: string }) => project.id);
    expect(visibleProjectIds).toContain(assignedProjectId);
    expect(visibleProjectIds).toContain(unassignedProjectId);
  });
});
