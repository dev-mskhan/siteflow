// apps/server/src/modules/project/project.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import { projectContext, requireProjectPermission } from './core/project.middleware.js';
import {
  handleCreateProject,
  handleListProjects,
  handleGetProject,
  handleUpdateProject,
  handleActivateProject,
  handleHoldProject,
  handleResumeProject,
  handleCompleteProject,
  handleCancelProject,
  handleArchiveProject,
  handleListMembers,
  handleAddMember,
  handleUpdateMemberRole,
  handleRemoveMember,
  handleGetSettings,
  handleUpdateSettings,
  handleListPhases,
  handleCreatePhase,
  handleUpdatePhase,
  handleArchivePhase,
  handleReorderPhases,
  handleListCostCodes,
  handleCreateCostCode,
  handleUpdateCostCode,
  handleDeactivateCostCode,
  handleListProjectAudit,
} from './project.handler.js';
import {
  createProjectSchemaDoc,
  listProjectsSchemaDoc,
  getProjectSchemaDoc,
  updateProjectSchemaDoc,
  lifecycleSchemaDoc,
} from './docs/project.api.schemas.js';

export const projectRoutes: FastifyPluginAsync = async (fastify) => {
  // ── Shared auth + org-context hooks ────────────────────────────────────────
  fastify.addHook('preHandler', authenticate);
  fastify.addHook('preHandler', organizationContext);

  // ── Collection routes (no projectId in path) ────────────────────────────────
  fastify.post(
    '/:organizationId/projects',
    {
      schema: createProjectSchemaDoc,
      preHandler: [requirePermission('project:create')],
    },
    handleCreateProject,
  );

  fastify.get(
    '/:organizationId/projects',
    {
      schema: listProjectsSchemaDoc,
      preHandler: [requirePermission('project:read')],
    },
    handleListProjects,
  );

  // ── Item routes (projectId in path — projectContext required) ───────────────
  fastify.register(async (projectScoped) => {
    projectScoped.addHook('preHandler', projectContext);

    projectScoped.get(
      '/:organizationId/projects/:projectId',
      {
        schema: getProjectSchemaDoc,
        preHandler: [requireProjectPermission('project:read')],
      },
      handleGetProject,
    );

    projectScoped.patch(
      '/:organizationId/projects/:projectId',
      {
        schema: updateProjectSchemaDoc,
        preHandler: [requireProjectPermission('project:update')],
      },
      handleUpdateProject,
    );

    // ── Lifecycle transitions ─────────────────────────────────────────────────
    const lifecyclePreHandlers = [requireProjectPermission('project:lifecycle')];

    projectScoped.post(
      '/:organizationId/projects/:projectId/activate',
      { schema: { ...lifecycleSchemaDoc, summary: 'Activate project (DRAFT→ACTIVE)' }, preHandler: lifecyclePreHandlers },
      handleActivateProject,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/hold',
      { schema: { ...lifecycleSchemaDoc, summary: 'Put project on hold (ACTIVE→ON_HOLD)' }, preHandler: lifecyclePreHandlers },
      handleHoldProject,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/resume',
      { schema: { ...lifecycleSchemaDoc, summary: 'Resume project (ON_HOLD→ACTIVE)' }, preHandler: lifecyclePreHandlers },
      handleResumeProject,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/complete',
      { schema: { ...lifecycleSchemaDoc, summary: 'Complete project (ACTIVE→COMPLETED)' }, preHandler: lifecyclePreHandlers },
      handleCompleteProject,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/cancel',
      { schema: { ...lifecycleSchemaDoc, summary: 'Cancel project' }, preHandler: lifecyclePreHandlers },
      handleCancelProject,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/archive',
      { schema: { ...lifecycleSchemaDoc, summary: 'Archive project (COMPLETED|CANCELLED→ARCHIVED)' }, preHandler: lifecyclePreHandlers },
      handleArchiveProject,
    );

    // ── Member routes ─────────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/members',
      { preHandler: [requireProjectPermission('project:read')] },
      handleListMembers,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/members',
      { preHandler: [requireProjectPermission('project:member:manage')] },
      handleAddMember,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/members/:userId',
      { preHandler: [requireProjectPermission('project:member:manage')] },
      handleUpdateMemberRole,
    );
    projectScoped.delete(
      '/:organizationId/projects/:projectId/members/:userId',
      { preHandler: [requireProjectPermission('project:member:manage')] },
      handleRemoveMember,
    );

    // ── Settings routes ───────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/settings',
      { preHandler: [requireProjectPermission('project:read')] },
      handleGetSettings,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/settings',
      { preHandler: [requireProjectPermission('project:settings:update')] },
      handleUpdateSettings,
    );

    // ── Phase routes ──────────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/phases',
      { preHandler: [requireProjectPermission('project:read')] },
      handleListPhases,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/phases',
      { preHandler: [requireProjectPermission('project:phase:manage')] },
      handleCreatePhase,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/phases/:phaseId',
      { preHandler: [requireProjectPermission('project:phase:manage')] },
      handleUpdatePhase,
    );
    projectScoped.delete(
      '/:organizationId/projects/:projectId/phases/:phaseId',
      { preHandler: [requireProjectPermission('project:phase:manage')] },
      handleArchivePhase,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/phases/reorder',
      { preHandler: [requireProjectPermission('project:phase:manage')] },
      handleReorderPhases,
    );

    // ── Cost-Code routes ──────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/cost-codes',
      { preHandler: [requireProjectPermission('project:read')] },
      handleListCostCodes,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/cost-codes',
      { preHandler: [requireProjectPermission('project:cost-code:manage')] },
      handleCreateCostCode,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/cost-codes/:codeId',
      { preHandler: [requireProjectPermission('project:cost-code:manage')] },
      handleUpdateCostCode,
    );
    projectScoped.delete(
      '/:organizationId/projects/:projectId/cost-codes/:codeId',
      { preHandler: [requireProjectPermission('project:cost-code:manage')] },
      handleDeactivateCostCode,
    );

    // ── Audit route ───────────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/audit',
      { preHandler: [requireProjectPermission('project:audit:read')] },
      handleListProjectAudit,
    );
  });
};
