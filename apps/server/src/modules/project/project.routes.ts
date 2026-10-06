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
import { documentRoutes } from './documents/document.routes.js';
import { complianceRoutes } from './compliance/compliance.routes.js';
import { rfiRoutes } from './rfi/rfi.routes.js';
import { submittalRoutes } from './submittal/submittal.routes.js';
import { qualityRoutes } from './quality/quality.routes.js';
import { safetyRoutes } from './safety/safety.routes.js';
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
  handleCreateAmendment,
  handleListAmendments,
  handleGetAmendment,
} from './field-log/field-log-amendment.handler.js';
import {
  handleCreateIssue,
  handleGetIssue,
  handleListIssues,
  handleUpdateIssue,
  handleTransitionIssue,
} from './issue/issue.handler.js';
import {
  handleListProjectSubcontractors,
  handleAssignSubcontractorToProject,
  handleGetProjectSubcontractor,
  handleUpdateProjectSubcontractor,
  handleCreateContact,
  handleUpdateContact,
  handleAssignTask,
  handleRemoveTaskAssignment,
} from './subcontractor/subcontractor.handler.js';
import {
  handleListMaterialRequests,
  handleCreateMaterialRequest,
  handleGetMaterialRequest,
  handleUpdateMaterialRequest,
  handleSubmitMaterialRequest,
  handleCancelMaterialRequest,
} from './material-request/material-request.handler.js';
import {
  handleListQuotes,
  handleCreateQuote,
  handleGetQuote,
  handleUpdateQuote,
  handleSubmitQuote,
  handleAcceptQuote,
  handleRejectQuote,
} from './quote/quote.handler.js';
import {
  handleListPurchaseOrders,
  handleCreatePurchaseOrder,
  handleGetPurchaseOrder,
  handleUpdatePurchaseOrder,
  handleSubmitPurchaseOrder,
  handleApprovePurchaseOrder,
  handleSendPurchaseOrder,
  handleCancelPurchaseOrder,
} from './purchase-order/purchase-order.handler.js';
import { setCommittedCostHooks } from './purchase-order/purchase-order.service.js';
import { committedCostService } from './committed-cost/committed-cost.service.js';
import {
  handleListCommittedCosts,
  handleGetCommittedCost,
} from './committed-cost/committed-cost.handler.js';
import {
  handleListApprovals,
  handleCreateApproval,
  handleGetApproval,
  handleApproveApproval,
  handleRejectApproval,
  handleCancelApproval,
} from './procurement-approval/procurement-approval.handler.js';
import { handleListScheduleHistory } from './schedule-history/schedule-history.handler.js';
import { handleGetScheduleMetrics } from './schedule-metrics/schedule-metrics.handler.js';
import {
  handleListDeliveries,
  handleCreateDelivery,
  handleGetDelivery,
  handleUpdateDelivery,
  handleListReceipts,
  handleCreateReceipt,
  handleGetReceipt,
  handlePostReceipt,
  handleVoidReceipt,
} from './delivery/delivery.handler.js';
import { setDeliveryHooks } from './delivery/delivery.service.js';
import {
  handleListInventory,
  handleGetInventoryBalance,
  handleListInventoryTransactions,
  handleAdjustInventory,
  handleTransferInventory,
} from './inventory/inventory.handler.js';
import { inventoryService } from './inventory/inventory.service.js';
import {
  handleGetSupplierPerformance,
  handleGetSubcontractorPerformance,
} from './performance/performance.handler.js';
import { partnerPerformanceService } from './performance/performance.service.js';
import { projectBudgetRoutes } from './budget/budget.routes.js';
import { costTransactionRoutes } from './cost-transaction/cost-transaction.routes.js';

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
import {
  listSubcontractorsSchemaDoc,
  assignSubcontractorSchemaDoc,
  getSubcontractorSchemaDoc,
  updateSubcontractorSchemaDoc,
  createSubcontractorContactSchemaDoc,
  updateSubcontractorContactSchemaDoc,
  assignSubcontractorTaskSchemaDoc,
  removeSubcontractorTaskSchemaDoc,
  listMaterialRequestsSchemaDoc,
  createMaterialRequestSchemaDoc,
  getMaterialRequestSchemaDoc,
  updateMaterialRequestSchemaDoc,
  submitMaterialRequestSchemaDoc,
  cancelMaterialRequestSchemaDoc,
  listQuotesSchemaDoc,
  createQuoteSchemaDoc,
  getQuoteSchemaDoc,
  updateQuoteSchemaDoc,
  submitQuoteSchemaDoc,
  acceptQuoteSchemaDoc,
  rejectQuoteSchemaDoc,
  listApprovalsSchemaDoc,
  createApprovalSchemaDoc,
  getApprovalSchemaDoc,
  approveApprovalSchemaDoc,
  rejectApprovalSchemaDoc,
  cancelApprovalSchemaDoc,
  listPurchaseOrdersSchemaDoc,
  createPurchaseOrderSchemaDoc,
  getPurchaseOrderSchemaDoc,
  updatePurchaseOrderSchemaDoc,
  submitPurchaseOrderSchemaDoc,
  approvePurchaseOrderSchemaDoc,
  sendPurchaseOrderSchemaDoc,
  cancelPurchaseOrderSchemaDoc,
  listCommittedCostsSchemaDoc,
  getCommittedCostSchemaDoc,
  listDeliveriesSchemaDoc,
  createDeliverySchemaDoc,
  getDeliverySchemaDoc,
  updateDeliverySchemaDoc,
  listReceiptsSchemaDoc,
  createReceiptSchemaDoc,
  getReceiptSchemaDoc,
  postReceiptSchemaDoc,
  voidReceiptSchemaDoc,
  listInventorySchemaDoc,
  getInventoryBalanceSchemaDoc,
  listInventoryTransactionsSchemaDoc,
  adjustInventorySchemaDoc,
  transferInventorySchemaDoc,
  getSupplierPerformanceSchemaDoc,
  getSubcontractorPerformanceSchemaDoc,
} from './docs/procurement.api.schemas.js';

// Wire committed-cost hooks into the PO service (avoids circular imports at module level)
setCommittedCostHooks(
  (tx, po) => committedCostService.createFromPO(tx, po),
  (tx, poId, organizationId, actorUserId) =>
    committedCostService.cancelFromPO(tx, poId, organizationId, actorUserId),
);

// Wire delivery hooks into the delivery service (avoids circular imports at module level)
setDeliveryHooks(
  (tx, args) => inventoryService.recordReceipt(tx, args),
  (tx, receiptId, orgId, projectId) => inventoryService.reverseReceipt(tx, receiptId, orgId, projectId),
  (tx, args) => partnerPerformanceService.recordEvent(tx, args),
);

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
    projectScoped.register(documentRoutes);
    projectScoped.register(complianceRoutes);
    projectScoped.register(rfiRoutes);
    projectScoped.register(submittalRoutes);
    projectScoped.register(qualityRoutes);
    projectScoped.register(safetyRoutes);
    projectScoped.register(projectBudgetRoutes);
    projectScoped.register(costTransactionRoutes);

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

    // ── Field Log Amendment routes ─────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/field-logs/:logId/amendments',
      { preHandler: [requireProjectPermission('project.field-log.read')] },
      handleListAmendments,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/field-logs/:logId/amendments',
      { preHandler: [requireProjectPermission('project.field-log.lock')] },
      handleCreateAmendment,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/field-logs/:logId/amendments/:amendmentId',
      { preHandler: [requireProjectPermission('project.field-log.read')] },
      handleGetAmendment,
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

    // ── Subcontractor routes ──────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/subcontractors',
      { schema: listSubcontractorsSchemaDoc, preHandler: [requireProjectPermission('project.subcontractor.read')] },
      handleListProjectSubcontractors,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/subcontractors',
      { schema: assignSubcontractorSchemaDoc, preHandler: [requireProjectPermission('project.subcontractor.create')] },
      handleAssignSubcontractorToProject,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/subcontractors/:subcontractorId',
      { schema: getSubcontractorSchemaDoc, preHandler: [requireProjectPermission('project.subcontractor.read')] },
      handleGetProjectSubcontractor,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/subcontractors/:subcontractorId',
      { schema: updateSubcontractorSchemaDoc, preHandler: [requireProjectPermission('project.subcontractor.update')] },
      handleUpdateProjectSubcontractor,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/subcontractors/:subcontractorId/contacts',
      { schema: createSubcontractorContactSchemaDoc, preHandler: [requireProjectPermission('project.subcontractor.update')] },
      handleCreateContact,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/subcontractors/:subcontractorId/contacts/:contactId',
      { schema: updateSubcontractorContactSchemaDoc, preHandler: [requireProjectPermission('project.subcontractor.update')] },
      handleUpdateContact,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/subcontractors/:subcontractorId/task-assignments',
      { schema: assignSubcontractorTaskSchemaDoc, preHandler: [requireProjectPermission('project.subcontractor.assign')] },
      handleAssignTask,
    );
    projectScoped.delete(
      '/:organizationId/projects/:projectId/subcontractors/:subcontractorId/task-assignments/:taskId',
      { schema: removeSubcontractorTaskSchemaDoc, preHandler: [requireProjectPermission('project.subcontractor.assign')] },
      handleRemoveTaskAssignment,
    );

    // ── Material Request routes ───────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/material-requests',
      { schema: listMaterialRequestsSchemaDoc, preHandler: [requireProjectPermission('project.material_request.read')] },
      handleListMaterialRequests,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/material-requests',
      { schema: createMaterialRequestSchemaDoc, preHandler: [requireProjectPermission('project.material_request.create')] },
      handleCreateMaterialRequest,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/material-requests/:requestId',
      { schema: getMaterialRequestSchemaDoc, preHandler: [requireProjectPermission('project.material_request.read')] },
      handleGetMaterialRequest,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/material-requests/:requestId',
      { schema: updateMaterialRequestSchemaDoc, preHandler: [requireProjectPermission('project.material_request.update')] },
      handleUpdateMaterialRequest,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/material-requests/:requestId/submit',
      { schema: submitMaterialRequestSchemaDoc, preHandler: [requireProjectPermission('project.material_request.submit')] },
      handleSubmitMaterialRequest,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/material-requests/:requestId/cancel',
      { schema: cancelMaterialRequestSchemaDoc, preHandler: [requireProjectPermission('project.material_request.cancel')] },
      handleCancelMaterialRequest,
    );

    // ── Quote routes ──────────────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/quotes',
      { schema: listQuotesSchemaDoc, preHandler: [requireProjectPermission('project.quote.read')] },
      handleListQuotes,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/quotes',
      { schema: createQuoteSchemaDoc, preHandler: [requireProjectPermission('project.quote.create')] },
      handleCreateQuote,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/quotes/:quoteId',
      { schema: getQuoteSchemaDoc, preHandler: [requireProjectPermission('project.quote.read')] },
      handleGetQuote,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/quotes/:quoteId',
      { schema: updateQuoteSchemaDoc, preHandler: [requireProjectPermission('project.quote.update')] },
      handleUpdateQuote,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/quotes/:quoteId/submit',
      { schema: submitQuoteSchemaDoc, preHandler: [requireProjectPermission('project.quote.submit')] },
      handleSubmitQuote,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/quotes/:quoteId/accept',
      { schema: acceptQuoteSchemaDoc, preHandler: [requireProjectPermission('project.quote.accept')] },
      handleAcceptQuote,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/quotes/:quoteId/reject',
      { schema: rejectQuoteSchemaDoc, preHandler: [requireProjectPermission('project.quote.reject')] },
      handleRejectQuote,
    );

    // ── Procurement Approval routes ───────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/procurement-approvals',
      { schema: listApprovalsSchemaDoc, preHandler: [requireProjectPermission('project.procurement_approval.read')] },
      handleListApprovals,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/procurement-approvals',
      { schema: createApprovalSchemaDoc, preHandler: [requireProjectPermission('project.procurement_approval.create')] },
      handleCreateApproval,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/procurement-approvals/:approvalId',
      { schema: getApprovalSchemaDoc, preHandler: [requireProjectPermission('project.procurement_approval.read')] },
      handleGetApproval,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/procurement-approvals/:approvalId/approve',
      { schema: approveApprovalSchemaDoc, preHandler: [requireProjectPermission('project.procurement_approval.approve')] },
      handleApproveApproval,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/procurement-approvals/:approvalId/reject',
      { schema: rejectApprovalSchemaDoc, preHandler: [requireProjectPermission('project.procurement_approval.reject')] },
      handleRejectApproval,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/procurement-approvals/:approvalId/cancel',
      { schema: cancelApprovalSchemaDoc, preHandler: [requireProjectPermission('project.procurement_approval.create')] },
      handleCancelApproval,
    );

    // ── Purchase Order routes ─────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/purchase-orders',
      { schema: listPurchaseOrdersSchemaDoc, preHandler: [requireProjectPermission('project.purchase_order.read')] },
      handleListPurchaseOrders,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/purchase-orders',
      { schema: createPurchaseOrderSchemaDoc, preHandler: [requireProjectPermission('project.purchase_order.create')] },
      handleCreatePurchaseOrder,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/purchase-orders/:poId',
      { schema: getPurchaseOrderSchemaDoc, preHandler: [requireProjectPermission('project.purchase_order.read')] },
      handleGetPurchaseOrder,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/purchase-orders/:poId',
      { schema: updatePurchaseOrderSchemaDoc, preHandler: [requireProjectPermission('project.purchase_order.update')] },
      handleUpdatePurchaseOrder,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/purchase-orders/:poId/submit',
      { schema: submitPurchaseOrderSchemaDoc, preHandler: [requireProjectPermission('project.purchase_order.submit')] },
      handleSubmitPurchaseOrder,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/purchase-orders/:poId/approve',
      { schema: approvePurchaseOrderSchemaDoc, preHandler: [requireProjectPermission('project.purchase_order.approve')] },
      handleApprovePurchaseOrder,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/purchase-orders/:poId/send',
      { schema: sendPurchaseOrderSchemaDoc, preHandler: [requireProjectPermission('project.purchase_order.send')] },
      handleSendPurchaseOrder,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/purchase-orders/:poId/cancel',
      { schema: cancelPurchaseOrderSchemaDoc, preHandler: [requireProjectPermission('project.purchase_order.cancel')] },
      handleCancelPurchaseOrder,
    );

    // ── Committed Cost routes (read-only) ─────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/committed-costs',
      { schema: listCommittedCostsSchemaDoc, preHandler: [requireProjectPermission('project.committed_cost.read')] },
      handleListCommittedCosts,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/committed-costs/:committedCostId',
      { schema: getCommittedCostSchemaDoc, preHandler: [requireProjectPermission('project.committed_cost.read')] },
      handleGetCommittedCost,
    );

    // ── Delivery routes ───────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/deliveries',
      { schema: listDeliveriesSchemaDoc, preHandler: [requireProjectPermission('project.delivery.read')] },
      handleListDeliveries,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/deliveries',
      { schema: createDeliverySchemaDoc, preHandler: [requireProjectPermission('project.delivery.create')] },
      handleCreateDelivery,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/deliveries/:deliveryId',
      { schema: getDeliverySchemaDoc, preHandler: [requireProjectPermission('project.delivery.read')] },
      handleGetDelivery,
    );
    projectScoped.patch(
      '/:organizationId/projects/:projectId/deliveries/:deliveryId',
      { schema: updateDeliverySchemaDoc, preHandler: [requireProjectPermission('project.delivery.update')] },
      handleUpdateDelivery,
    );

    // ── Receipt routes ────────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/receipts',
      { schema: listReceiptsSchemaDoc, preHandler: [requireProjectPermission('project.receipt.read')] },
      handleListReceipts,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/receipts',
      { schema: createReceiptSchemaDoc, preHandler: [requireProjectPermission('project.receipt.create')] },
      handleCreateReceipt,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/receipts/:receiptId',
      { schema: getReceiptSchemaDoc, preHandler: [requireProjectPermission('project.receipt.read')] },
      handleGetReceipt,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/receipts/:receiptId/post',
      { schema: postReceiptSchemaDoc, preHandler: [requireProjectPermission('project.receipt.post')] },
      handlePostReceipt,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/receipts/:receiptId/void',
      { schema: voidReceiptSchemaDoc, preHandler: [requireProjectPermission('project.receipt.void')] },
      handleVoidReceipt,
    );

    // ── Inventory routes ──────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/inventory',
      { schema: listInventorySchemaDoc, preHandler: [requireProjectPermission('project.inventory.read')] },
      handleListInventory,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/inventory/:materialId',
      { schema: getInventoryBalanceSchemaDoc, preHandler: [requireProjectPermission('project.inventory.read')] },
      handleGetInventoryBalance,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/inventory/:materialId/transactions',
      { schema: listInventoryTransactionsSchemaDoc, preHandler: [requireProjectPermission('project.inventory.read')] },
      handleListInventoryTransactions,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/inventory/adjustments',
      { schema: adjustInventorySchemaDoc, preHandler: [requireProjectPermission('project.inventory.adjust')] },
      handleAdjustInventory,
    );
    projectScoped.post(
      '/:organizationId/projects/:projectId/inventory/transfers',
      { schema: transferInventorySchemaDoc, preHandler: [requireProjectPermission('project.inventory.adjust')] },
      handleTransferInventory,
    );

    // ── Performance routes ────────────────────────────────────────────────────
    projectScoped.get(
      '/:organizationId/projects/:projectId/performance/suppliers/:supplierId',
      { schema: getSupplierPerformanceSchemaDoc, preHandler: [requireProjectPermission('project.performance.read')] },
      handleGetSupplierPerformance,
    );
    projectScoped.get(
      '/:organizationId/projects/:projectId/performance/subcontractors/:subcontractorId',
      { schema: getSubcontractorPerformanceSchemaDoc, preHandler: [requireProjectPermission('project.performance.read')] },
      handleGetSubcontractorPerformance,
    );
  });
};
