// apps/server/src/modules/ai/tools/definitions/cost.tools.ts
//
// READ-tier tools that wrap the financial-summary and budget services.
// All tools in this file are READ — they call existing services, return data,
// and never write to any domain table.
//
// Rules enforced at this layer:
//   - organizationId + projectId always come from RunContext (injected by tool-factory)
//   - Never import from DB schema directly — always go through a domain service
//   - Numbers in results come from the service; the LLM must not do arithmetic on them

import { z } from 'zod';
import { registerTool } from '../tool-registry.js';
import { financialSummaryService } from '../../project/financial-summary/financial-summary.service.js';
import { projectBudgetService } from '../../project/budget/budget.service.js';

// ── Helper ────────────────────────────────────────────────────────────────────
// All cost tools require a projectId. The LLM provides it as an arg ONLY because
// the cost-financial agent is org-level (no projectId in RunContext). However the
// factory still enforces that it belongs to the run's org via the service call
// (the service always scopes by organizationId first).

const projectArgSchema = z.object({
  projectId: z
    .string()
    .uuid()
    .describe('The UUID of the project to query. Must belong to the current organization.'),
});

// ── 1. get_financial_summary ──────────────────────────────────────────────────
// Full financial snapshot: cost, commitments, billing, cash, retainage.

registerTool({
  name: 'get_financial_summary',
  description:
    'Returns the complete financial summary for a project: cost breakdown, ' +
    'approved contract value, billing totals, cash flow, and retainage. ' +
    'Use this as the starting point for any cost or financial question.',
  argsSchema: projectArgSchema,
  riskTier: 'READ',
  requiredPermission: 'project:read',
  async execute({ projectId }, ctx) {
    return financialSummaryService.getSummary(ctx.organizationId, projectId);
  },
});

// ── 2. get_cost_summary ───────────────────────────────────────────────────────
// Lighter call — just the cost side (budget vs actuals, committed costs).

registerTool({
  name: 'get_cost_summary',
  description:
    'Returns the cost summary for a project: original budget, approved changes, ' +
    'revised budget, actual costs to date, and committed costs. ' +
    'Prefer this over get_financial_summary when you only need cost data.',
  argsSchema: projectArgSchema,
  riskTier: 'READ',
  requiredPermission: 'project:read',
  async execute({ projectId }, ctx) {
    return financialSummaryService.getCostSummary(ctx.organizationId, projectId);
  },
});

// ── 3. get_billing_summary ────────────────────────────────────────────────────

registerTool({
  name: 'get_billing_summary',
  description:
    'Returns billing and payment application totals for a project: approved contract value, ' +
    'billed receivables and payables, approved invoice amounts, and outstanding balances. ' +
    'Also includes retainage held and released.',
  argsSchema: projectArgSchema,
  riskTier: 'READ',
  requiredPermission: 'project:read',
  async execute({ projectId }, ctx) {
    return financialSummaryService.getBillingSummary(ctx.organizationId, projectId);
  },
});

// ── 4. get_cash_summary ───────────────────────────────────────────────────────

registerTool({
  name: 'get_cash_summary',
  description:
    'Returns cash flow totals for a project: cash received from clients, ' +
    'cash paid to suppliers/subcontractors, and net cash position, broken down by currency.',
  argsSchema: projectArgSchema,
  riskTier: 'READ',
  requiredPermission: 'project:read',
  async execute({ projectId }, ctx) {
    return financialSummaryService.getCashSummary(ctx.organizationId, projectId);
  },
});

// ── 5. get_budget ─────────────────────────────────────────────────────────────

registerTool({
  name: 'get_budget',
  description:
    'Returns the current approved budget for a project, including all line items ' +
    'broken down by cost code and phase, plus the total budget amount.',
  argsSchema: z.object({
    projectId: z
      .string()
      .uuid()
      .describe('The UUID of the project to query.'),
    budgetId: z
      .string()
      .uuid()
      .describe('The UUID of the specific budget to retrieve.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project:read',
  async execute({ projectId, budgetId }, ctx) {
    return projectBudgetService.getBudget(ctx.organizationId, projectId, budgetId);
  },
});

// ── 6. get_budget_summary ─────────────────────────────────────────────────────

registerTool({
  name: 'get_budget_summary',
  description:
    'Returns a compact budget summary for a project: original budget total, ' +
    'approved change amounts, and current revised total. ' +
    'Use this instead of get_budget when you only need top-level figures.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project.'),
    budgetId: z.string().uuid().describe('The UUID of the budget.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project:read',
  async execute({ projectId, budgetId }, ctx) {
    return projectBudgetService.getSummary(ctx.organizationId, projectId, budgetId);
  },
});

// ── 7. list_financial_audit_events ───────────────────────────────────────────

registerTool({
  name: 'list_financial_audit_events',
  description:
    'Returns a chronological list of financial audit events for a project ' +
    '(budget approvals, change orders, invoice approvals, payments, etc.). ' +
    'Use this to trace the history of financial changes.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('The UUID of the project.'),
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .default(20)
      .describe('Maximum number of events to return (1–50).'),
    cursor: z
      .string()
      .optional()
      .describe('Pagination cursor from a previous response.'),
  }),
  riskTier: 'READ',
  requiredPermission: 'project:read',
  async execute({ projectId, limit, cursor }, ctx) {
    return financialSummaryService.listAuditEvents(
      ctx.organizationId,
      projectId,
      { limit, cursor },
    );
  },
});
