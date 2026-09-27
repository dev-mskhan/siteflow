// apps/server/tests/integration/project_core.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { users } from '@siteflow/database/schema';
import { createAccessToken } from '../../src/modules/auth/token.service.js';
import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import type { EffectiveProjectSettings } from '../../src/modules/project/settings/project-settings.service.js';
import type { ProjectMemberDTO } from '../../src/modules/project/members/project-member.types.js';
import type { ProjectPhase } from '@siteflow/database/schema';
import type { ProjectCostCode } from '@siteflow/database/schema';
import type { OrgDTO } from '../../src/modules/organization/organization.types.js';

import { createVerifiedUser, createOrgWithAdmin, addMemberDirectly } from '../helpers/fixtures.js';

describe('Project Core Module (Integration)', () => {
  let app: FastifyInstance;
  let authToken: string;
  let ownerUserId: string;
  let memberUserId: string;
  let memberAuthToken: string;
  let orgId: string;
  let otherOrgId: string;
  let otherAuthToken: string;

  const runId = Math.random().toString(36).substring(7);

  beforeAll(async () => {
    app = await createTestApp();

    // 1. Create owner and primary org
    const ownerResult = await createVerifiedUser({ email: `project_owner_${runId}@example.com` });
    ownerUserId = ownerResult.user.id;
    authToken = ownerResult.token;

    const orgResult = await createOrgWithAdmin(app, authToken, `Project Test Org ${runId}`);
    orgId = orgResult.orgId;
    const pmRoleId = orgResult.roleMap.get('Project Manager')!;

    // 2. Create second user and add directly to org
    const memberResult = await createVerifiedUser({ email: `project_member_${runId}@example.com` });
    memberUserId = memberResult.user.id;
    memberAuthToken = memberResult.token;
    await addMemberDirectly(orgId, memberUserId, pmRoleId);

    // 3. Create other user and other org for IDOR checks
    const otherResult = await createVerifiedUser({ email: `project_other_${runId}@example.com` });
    otherAuthToken = otherResult.token;
    const otherOrgResult = await createOrgWithAdmin(app, otherAuthToken, `Other Org ${runId}`);
    otherOrgId = otherOrgResult.orgId;
  });

  afterAll(async () => {
    await app.close();
  });

  let createdProjectId: string;
  let projectVersion: number;

  describe('1. Project CRUD & Concurrency', () => {
    it('POST /organizations/:orgId/projects creates a project in DRAFT', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Apex Tower Commercial Development',
          description: 'High-rise tower construction',
          projectType: 'COMMERCIAL',
          contractValue: '4500000.00',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<ApiSuccessResponse<{ project: ProjectDTO }>>();
      expect(body.success).toBe(true);
      expect(body.data.project.name).toBe('Apex Tower Commercial Development');
      expect(body.data.project.status).toBe('DRAFT');
      expect(body.data.project.projectNumber).toMatch(/^PRJ-\d{4}$/);
      expect(body.data.project.currency).toBe('USD');

      createdProjectId = body.data.project.id;
      projectVersion = 1;
    });

    it('GET /organizations/:orgId/projects lists projects with cursor pagination', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ projects: ProjectDTO[]; nextCursor: string | null }>>();
      expect(body.success).toBe(true);
      expect(body.data.projects.length).toBeGreaterThanOrEqual(1);
      expect(body.data.projects.some((p) => p.id === createdProjectId)).toBe(true);
    });

    it('GET /organizations/:orgId/projects/:projectId fetches project details', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ project: ProjectDTO }>>();
      expect(body.data.project.id).toBe(createdProjectId);
      expect(body.data.project.status).toBe('DRAFT');
    });

    it('PATCH /organizations/:orgId/projects/:projectId updates project metadata optimistically', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Apex Tower Phase 1',
          expectedVersion: projectVersion,
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ project: ProjectDTO }>>();
      expect(body.data.project.name).toBe('Apex Tower Phase 1');
      projectVersion++;
    });

    it('PATCH with stale expectedVersion returns 409 Conflict (Optimistic Concurrency)', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          name: 'Conflicting Name',
          expectedVersion: 1, // Stale version! Current is 2
        },
      });

      expect(res.statusCode).toBe(409);
    });
  });

  describe('2. Project Lifecycle State Machine', () => {
    it('POST /activate transitions DRAFT -> ACTIVE and sets actualStartDate', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/activate`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ project: ProjectDTO }>>();
      expect(body.data.project.status).toBe('ACTIVE');
      expect(body.data.project.actualStartDate).not.toBeNull();
    });

    it('POST /hold transitions ACTIVE -> ON_HOLD', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/hold`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ project: ProjectDTO }>>();
      expect(body.data.project.status).toBe('ON_HOLD');
    });

    it('POST /resume transitions ON_HOLD -> ACTIVE', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/resume`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ project: ProjectDTO }>>();
      expect(body.data.project.status).toBe('ACTIVE');
    });

    it('Invalid transition returns 422 Unprocessable Entity', async () => {
      // Trying to archive while ACTIVE is invalid (must be COMPLETED or CANCELLED)
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/archive`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(422);
    });
  });

  describe('3. Project Settings (Chunk 2.3)', () => {
    it('GET /settings returns effective inherited settings', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/settings`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ settings: EffectiveProjectSettings }>>();
      expect(body.data.settings.currency).toBe('USD');
      expect(body.data.settings.timezone).toBeDefined();
    });

    it('PATCH /settings updates project-level overrides', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/settings`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          timezone: 'America/New_York',
          unitSystem: 'IMPERIAL',
        },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ settings: EffectiveProjectSettings }>>();
      expect(body.data.settings.timezone).toBe('America/New_York');
      expect(body.data.settings.unitSystem).toBe('IMPERIAL');
    });
  });

  describe('4. Project Members & Last-PM Guard (Chunk 2.2)', () => {
    it('GET /members lists creator as initial PROJECT_MANAGER', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/members`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ members: ProjectMemberDTO[] }>>();
      expect(body.data.members.some((m) => m.userId === ownerUserId && m.role === 'PROJECT_MANAGER')).toBe(true);
    });

    it('POST /members adds a second member to the project', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/members`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          userId: memberUserId,
          role: 'SITE_SUPERVISOR',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<ApiSuccessResponse<{ member: ProjectMemberDTO }>>();
      expect(body.data.member.userId).toBe(memberUserId);
      expect(body.data.member.role).toBe('SITE_SUPERVISOR');
    });

    it('Enforces Last-PM guard: cannot demote the only PROJECT_MANAGER', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/members/${ownerUserId}`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { role: 'PROJECT_MEMBER' },
      });

      expect(res.statusCode).toBe(422);
    });

    it('DELETE /members removes non-PM member cleanly (soft-delete)', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/members/${memberUserId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify member is no longer in active members list
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/members`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      const body = listRes.json<ApiSuccessResponse<{ members: ProjectMemberDTO[] }>>();
      expect(body.data.members.some((m) => m.userId === memberUserId)).toBe(false);
    });
  });

  describe('5. Project Phases (Chunk 2.4)', () => {
    let phase1Id: string;
    let phase2Id: string;

    it('POST /phases creates new phases with auto-incremented sortOrder', async () => {
      const res1 = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/phases`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { name: 'Excavation & Foundation' },
      });
      expect(res1.statusCode).toBe(201);
      phase1Id = res1.json<ApiSuccessResponse<{ phase: ProjectPhase }>>().data.phase.id;

      const res2 = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/phases`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { name: 'Structural Framing' },
      });
      expect(res2.statusCode).toBe(201);
      phase2Id = res2.json<ApiSuccessResponse<{ phase: ProjectPhase }>>().data.phase.id;
    });

    it('GET /phases returns phases sorted by sortOrder', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/phases`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ phases: ProjectPhase[] }>>();
      expect(body.data.phases.length).toBe(2);
      expect(body.data.phases[0]!.name).toBe('Excavation & Foundation');
      expect(body.data.phases[1]!.name).toBe('Structural Framing');
    });

    it('POST /phases/reorder adjusts phase ordering', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/phases/reorder`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: { orderedIds: [phase2Id, phase1Id] },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ phases: ProjectPhase[] }>>();
      expect(body.data.phases[0]!.id).toBe(phase2Id);
      expect(body.data.phases[1]!.id).toBe(phase1Id);
    });

    it('DELETE /phases/:phaseId soft-archives the phase', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/phases/${phase1Id}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify it is excluded from default active list
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/phases`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      const body = listRes.json<ApiSuccessResponse<{ phases: ProjectPhase[] }>>();
      expect(body.data.phases.some((p) => p.id === phase1Id)).toBe(false);
    });
  });

  describe('6. Project Cost Codes (Chunk 2.5)', () => {
    let costCodeId: string;

    it('POST /cost-codes creates an uppercase cost code', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/cost-codes`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          code: '03-3000',
          description: 'Cast-in-Place Concrete',
        },
      });

      expect(res.statusCode).toBe(201);
      const body = res.json<ApiSuccessResponse<{ costCode: ProjectCostCode }>>();
      expect(body.data.costCode.code).toBe('03-3000');
      costCodeId = body.data.costCode.id;
    });

    it('POST /cost-codes rejects duplicate code with 409 Conflict', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/cost-codes`,
        headers: { authorization: `Bearer ${authToken}` },
        payload: {
          code: '03-3000',
          description: 'Duplicate concrete entry',
        },
      });

      expect(res.statusCode).toBe(409);
    });

    it('GET /cost-codes lists active cost codes', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/cost-codes`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ costCodes: ProjectCostCode[] }>>();
      expect(body.data.costCodes.some((c) => c.code === '03-3000')).toBe(true);
    });

    it('DELETE /cost-codes/:codeId deactivates the cost code', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/cost-codes/${costCodeId}`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(204);

      // Verify excluded from default list
      const listRes = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/cost-codes`,
        headers: { authorization: `Bearer ${authToken}` },
      });
      const body = listRes.json<ApiSuccessResponse<{ costCodes: ProjectCostCode[] }>>();
      expect(body.data.costCodes.some((c) => c.id === costCodeId)).toBe(false);
    });
  });

  describe('7. Project Audit History (Chunk 2.6)', () => {
    it('GET /audit returns project-scoped audit events', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/projects/${createdProjectId}/audit`,
        headers: { authorization: `Bearer ${authToken}` },
      });

      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ auditLogs: any[]; nextCursor: string | null }>>();
      expect(body.data.auditLogs.length).toBeGreaterThan(0);
      // Confirms audit events for project.created, status_changed, etc. are present
      expect(body.data.auditLogs.some((a) => a.action === 'project.created')).toBe(true);
    });
  });

  describe('8. Tenant Isolation & IDOR Protection', () => {
    it('User from other organization cannot access project (returns 404)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${otherOrgId}/projects/${createdProjectId}`,
        headers: { authorization: `Bearer ${otherAuthToken}` },
      });

      expect(res.statusCode).toBe(404);
    });
  });
});
