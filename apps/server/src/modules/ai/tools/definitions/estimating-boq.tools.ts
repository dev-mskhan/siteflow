// apps/server/src/modules/ai/tools/definitions/estimating-boq.tools.ts
//
// READ-tier tools for the estimating-BOQ agent.
// Wraps: ProjectBoqService, ProjectEstimateService, ProjectTakeoffService, ProjectCostCodeService.
// All tools are READ — no writes. The agent outputs draft BOQ lines as run output only.

import { z } from 'zod';
import { registerTool } from '../tool-registry.js';
import { projectBoqService } from '../../../project/boq/boq.service.js';
import { projectEstimateService } from '../../../project/estimate/estimate.service.js';
import { projectTakeoffService } from '../../../project/takeoff/takeoff.service.js';
import { projectCostCodeService } from '../../../project/cost-codes/project-cost-code.service.js';

// ── Shared ────────────────────────────────────────────────────────────────────

const projectIdArg = z.string().uuid().describe('The UUID of the project.');
const cursorArg = z.string().optional().describe('Pagination cursor from a previous response.');
const limitArg = z.number().int().min(1).max(50).default(25)
  .describe('Max records to return (1–50, default 25).');

// ── 1. list_boqs ──────────────────────────────────────────────────────────────

registerTool({
  name: 'list_boqs',
  description:
    'Lists Bill of Quantities (BOQs) for a project. ' +
    'Status: DRAFT, IN_REVIEW, APPROVED, LOCKED. ' +
    'Each BOQ has a number, title, currency, and current revision number.',
  argsSchema: z.object({
    projectId: projectIdArg,
    status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'LOCKED']).optional()
      .describe('Filter by BOQ status.'),
    cursor: cursorArg,
    limit: limitArg,
  }),
  riskTier: 'READ',
  requiredPermission: 'project.boq.read',
  async execute({ projectId, status, cursor, limit }, ctx) {
    return projectBoqService.listBoqs(
      { organizationId: ctx.organizationId, projectId },
      { status, cursor, limit: limit ?? 25 },
    );
  },
});

// ── 2. get_boq_revision ───────────────────────────────────────────────────────

registerTool({
  name: 'get_boq_revision',
  description:
    'Returns a specific BOQ revision including all sections and line items. ' +
    'Each item has: itemKey, description, unit, quantity, unitRate, amount, currencyCode, costCodeId (if mapped). ' +
    'Use this to read the full BOQ content for extraction and mapping.',
  argsSchema: z.object({
    projectId: projectIdArg,
    boqId: z.string().uuid().describe('The UUID of the BOQ.'),
    revisionId: z.string().uuid().describe('The UUID of the revision to read.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.boq.read',
  async execute({ projectId, boqId, revisionId }, ctx) {
    return projectBoqService.getRevision(
      { organizationId: ctx.organizationId, projectId },
      boqId,
      revisionId,
    );
  },
});

// ── 3. list_estimates ─────────────────────────────────────────────────────────

registerTool({
  name: 'list_estimates',
  description:
    'Lists estimates for a project. ' +
    'Status: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED. ' +
    'Each estimate has a title, status, current revision number, and timestamps.',
  argsSchema: z.object({
    projectId: projectIdArg,
    status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional()
      .describe('Filter by estimate status.'),
    limit: limitArg,
  }),
  riskTier: 'READ',
  requiredPermission: 'project.estimate.read',
  async execute({ projectId, status, limit }, ctx) {
    return projectEstimateService.list(
      { organizationId: ctx.organizationId, projectId },
      { status, limit: limit ?? 25 },
    );
  },
});

// ── 4. get_estimate ───────────────────────────────────────────────────────────

registerTool({
  name: 'get_estimate',
  description:
    'Returns a full estimate with all sections, lines, and resources for the current revision. ' +
    'Each line has: category (MATERIAL/LABOR/EQUIPMENT/SUBCONTRACTOR/OTHER), description, unit, quantity, unitRate, directAmount, costCodeId. ' +
    'Also includes revision totals: directCostTotal, overheadAmount, contingencyAmount, markupAmount, totalAmount.',
  argsSchema: z.object({
    projectId: projectIdArg,
    estimateId: z.string().uuid().describe('The UUID of the estimate.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.estimate.read',
  async execute({ projectId, estimateId }, ctx) {
    return projectEstimateService.getById(
      { organizationId: ctx.organizationId, projectId },
      estimateId,
    );
  },
});

// ── 5. list_takeoff_sheets ────────────────────────────────────────────────────

registerTool({
  name: 'list_takeoff_sheets',
  description:
    'Lists takeoff sheets for a project. ' +
    'Status: DRAFT, PENDING_APPROVAL, APPROVED, REJECTED. ' +
    'Each sheet has a title, status, and current revision number.',
  argsSchema: z.object({
    projectId: projectIdArg,
    status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED']).optional()
      .describe('Filter by sheet status.'),
    limit: limitArg,
  }),
  riskTier: 'READ',
  requiredPermission: 'project.takeoff.read',
  async execute({ projectId, status, limit }, ctx) {
    return projectTakeoffService.listSheets(
      { organizationId: ctx.organizationId, projectId, actorUserId: ctx.userId },
      { status, limit: limit ?? 25 },
    );
  },
});

// ── 6. get_takeoff_measurements ───────────────────────────────────────────────

registerTool({
  name: 'get_takeoff_measurements',
  description:
    'Returns all measurements for a takeoff sheet (current revision by default). ' +
    'Each measurement has: description, dimension (LENGTH/AREA/VOLUME/COUNT), unit, ' +
    'measurementMode (MANUAL/FORMULA), resultQuantity, boqItemId (if linked), costCodeId (if linked). ' +
    'Use this to see how quantities were derived from drawings.',
  argsSchema: z.object({
    projectId: projectIdArg,
    sheetId: z.string().uuid().describe('The UUID of the takeoff sheet.'),
    revisionNumber: z.number().int().positive().optional()
      .describe('Specific revision to read (default: current revision).'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.takeoff.read',
  async execute({ projectId, sheetId, revisionNumber }, ctx) {
    return projectTakeoffService.listMeasurements(
      { organizationId: ctx.organizationId, projectId, actorUserId: ctx.userId },
      sheetId,
      revisionNumber,
    );
  },
});

// ── 7. get_takeoff_summary ────────────────────────────────────────────────────

registerTool({
  name: 'get_takeoff_summary',
  description:
    'Returns aggregated takeoff quantities grouped by BOQ item, cost code, or sheet. ' +
    'Only includes APPROVED sheets. Each group shows the total result quantity and measurement count. ' +
    'Use groupBy="COST_CODE" to see quantities by cost code, "BOQ_ITEM" to see by BOQ line item.',
  argsSchema: z.object({
    projectId: projectIdArg,
    groupBy: z.enum(['BOQ_ITEM', 'COST_CODE', 'SHEET']).default('COST_CODE')
      .describe('How to group the results.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.takeoff.read',
  async execute({ projectId, groupBy }, ctx) {
    return projectTakeoffService.summary(
      { organizationId: ctx.organizationId, projectId, actorUserId: ctx.userId },
      groupBy ?? 'COST_CODE',
    );
  },
});

// ── 8. list_cost_codes ────────────────────────────────────────────────────────

registerTool({
  name: 'list_cost_codes',
  description:
    'Lists all active cost codes for a project. ' +
    'Cost codes are free-text per project (e.g. "03.21.10", "05.12.00"). ' +
    'Each code has: id, code, description, isActive. ' +
    'Use this to validate extracted BOQ items against available cost codes.',
  argsSchema: z.object({
    projectId: projectIdArg,
    includeInactive: z.boolean().default(false)
      .describe('Set true to include inactive/deactivated cost codes.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project.boq.read',
  async execute({ projectId, includeInactive }, ctx) {
    return projectCostCodeService.listCostCodes(
      ctx.organizationId,
      projectId,
      includeInactive ?? false,
    );
  },
});

// Note: search_knowledge_base and read_okf_page are in knowledge.tools.ts
// and included in the estimating-boq agent's ALLOWED_TOOLS list.
