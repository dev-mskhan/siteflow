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
  handleCreateTask,
  handleGetTask,
  handleListTasks,
  handleUpdateTask,
  handleTransitionTaskStatus,
  handleDeleteTask,
} from './task/task.handler.js';
import {
  handleGetCalendar,
  handleUpdateCalendar,
  handleAddCalendarException,
  handleRemoveCalendarException,
} from './calendar/calendar.handler.js';
import {
  handleCreateDependency,
  handleDeleteDependency,
  handleListDependencies,
} from './dependency/dependency.handler.js';
import { handleRecalculateSchedule } from './engine/schedule.handler.js';
import {
  handleCreateBaseline,
  handleActivateBaseline,
  handleGetBaseline,
  handleListBaselines,
  handleCompareBaseline,
  handleDeleteBaseline,
} from './baseline/baseline.handler.js';
import {
  handleCreateFieldLog,
  handleGetFieldLog,
  handleListFieldLogs,
  handleUpdateFieldLog,
  handleSubmitFieldLog,
  handleLockFieldLog,
} from './field-log/field-log.handler.js';
import {
  handleCreateIssue,
  handleGetIssue,
  handleListIssues,
  handleUpdateIssue,
  handleTransitionIssue,
} from './issue/issue.handler.js';
import { handleListScheduleHistory } from './schedule-history/schedule-history.handler.js';
import { handleGetScheduleMetrics } from './schedule-metrics/schedule-metrics.handler.js';

import {
  createProjectSchemaDoc,
  listProjectsSchemaDoc,
  getProjectSchemaDoc,
  updateProjectSchemaDoc,
  lifecycleSchemaDoc,
} from './docs/project.api.schemas.js';
import {
  createTaskSchemaDoc,
  listTasksSchemaDoc,
  getTaskSchemaDoc,
  updateTaskSchemaDoc,
  transitionTaskSchemaDoc,
  getCalendarSchemaDoc,
  updateCalendarSchemaDoc,
  createDependencySchemaDoc,
  recalculateScheduleSchemaDoc,
  createBaselineSchemaDoc,
  activateBaselineSchemaDoc,
  createFieldLogSchemaDoc,
  createIssueSchemaDoc,
  getScheduleHistorySchemaDoc,
  getScheduleMetricsSchemaDoc,
} from './docs/schedule.api.schemas.js';

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

    // ── Task routes ────────────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/tasks',
      { schema: listTasksSchemaDoc, preHandler: [requireProjectPermission('project.task.read')] },
      handleListTasks,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/tasks',
      { schema: createTaskSchemaDoc, preHandler: [requireProjectPermission('project.task.create')] },
      handleCreateTask,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/tasks/:taskId',
      { schema: getTaskSchemaDoc, preHandler: [requireProjectPermission('project.task.read')] },
      handleGetTask,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/tasks/:taskId',
      { schema: updateTaskSchemaDoc, preHandler: [requireProjectPermission('project.task.update')] },
      handleUpdateTask,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/tasks/:taskId/transition',
      { schema: transitionTaskSchemaDoc, preHandler: [requireProjectPermission('project.task.update')] },
      handleTransitionTaskStatus,
    );
    projectScoped.delete(
      '/:organizationId/projects/:projectId/tasks/:taskId',
      { preHandler: [requireProjectPermission('project.task.delete')] },
      handleDeleteTask,
    );

    // ── Calendar routes ────────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/calendar',
      { schema: getCalendarSchemaDoc, preHandler: [requireProjectPermission('project:read')] },
      handleGetCalendar,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/calendar',
      { schema: updateCalendarSchemaDoc, preHandler: [requireProjectPermission('project.calendar.manage')] },
      handleUpdateCalendar,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/calendar/exceptions',
      { preHandler: [requireProjectPermission('project.calendar.manage')] },
      handleAddCalendarException,
    );
    projectScoped.delete(
      '/:organizationId/projects/:projectId/calendar/exceptions/:exceptionId',
      { preHandler: [requireProjectPermission('project.calendar.manage')] },
      handleRemoveCalendarException,
    );

    // ── Dependency routes ──────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/dependencies',
      { preHandler: [requireProjectPermission('project.task.read')] },
      handleListDependencies,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/dependencies',
      { schema: createDependencySchemaDoc, preHandler: [requireProjectPermission('project.dependency.create')] },
      handleCreateDependency,
    );
    projectScoped.delete(
      '/:organizationId/projects/:projectId/dependencies/:dependencyId',
      { preHandler: [requireProjectPermission('project.dependency.delete')] },
      handleDeleteDependency,
    );

    // ── Schedule Engine routes ────────────────────────────────────────────────
    projectScoped.post(
      '/:organizationId/projects/:projectId/schedule/recalculate',
      { schema: recalculateScheduleSchemaDoc, preHandler: [requireProjectPermission('project.schedule.recalculate')] },
      handleRecalculateSchedule,
    );

    // ── Schedule Baseline routes ──────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/baselines',
      { preHandler: [requireProjectPermission('project.baseline.read')] },
      handleListBaselines,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/baselines',
      { schema: createBaselineSchemaDoc, preHandler: [requireProjectPermission('project.baseline.create')] },
      handleCreateBaseline,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/baselines/:baselineId',
      { preHandler: [requireProjectPermission('project.baseline.read')] },
      handleGetBaseline,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/baselines/:baselineId/activate',
      { schema: activateBaselineSchemaDoc, preHandler: [requireProjectPermission('project.baseline.activate')] },
      handleActivateBaseline,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/baselines/:baselineId/compare',
      { preHandler: [requireProjectPermission('project.baseline.read')] },
      handleCompareBaseline,
    );
    projectScoped.delete(
      '/:organizationId/projects/:projectId/baselines/:baselineId',
      { preHandler: [requireProjectPermission('project.baseline.delete')] },
      handleDeleteBaseline,
    );

    // ── Field Log routes ──────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/field-logs',
      { preHandler: [requireProjectPermission('project.field-log.read')] },
      handleListFieldLogs,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/field-logs',
      { schema: createFieldLogSchemaDoc, preHandler: [requireProjectPermission('project.field-log.create')] },
      handleCreateFieldLog,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/field-logs/:logId',
      { preHandler: [requireProjectPermission('project.field-log.read')] },
      handleGetFieldLog,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/field-logs/:logId',
      { preHandler: [requireProjectPermission('project.field-log.update')] },
      handleUpdateFieldLog,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/field-logs/:logId/submit',
      { preHandler: [requireProjectPermission('project.field-log.submit')] },
      handleSubmitFieldLog,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/field-logs/:logId/lock',
      { preHandler: [requireProjectPermission('project.field-log.lock')] },
      handleLockFieldLog,
    );

    // ── Issue routes ──────────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/issues',
      { preHandler: [requireProjectPermission('project.issue.read')] },
      handleListIssues,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/issues',
      { schema: createIssueSchemaDoc, preHandler: [requireProjectPermission('project.issue.create')] },
      handleCreateIssue,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/issues/:issueId',
      { preHandler: [requireProjectPermission('project.issue.read')] },
      handleGetIssue,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/issues/:issueId',
      { preHandler: [requireProjectPermission('project.issue.update')] },
      handleUpdateIssue,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/issues/:issueId/transition',
      { preHandler: [requireProjectPermission('project.issue.transition')] },
      handleTransitionIssue,
    );

    // ── Schedule History routes ───────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/schedule/history',
      { schema: getScheduleHistorySchemaDoc, preHandler: [requireProjectPermission('project:read')] },
      handleListScheduleHistory,
    );

    // ── Schedule Metrics routes ───────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/schedule/metrics',
      { schema: getScheduleMetricsSchemaDoc, preHandler: [requireProjectPermission('project:read')] },
      handleGetScheduleMetrics,
    );
  });
};
