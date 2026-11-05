// apps/server/src/modules/ai/core/agent-registry.ts
//
// Central registry for agent declarations and manifests.
// Validates agent identity, versioning, input schemas, and channel capabilities.

import { z } from 'zod';
import type { AgentName, ModelTier, RunLimits } from './types.js';
import { costFinancialOutputSchema } from '../agents/cost-financial/output.schema.js';
import { procurementOutputSchema } from '../agents/procurement/output.schema.js';
import { PROMPT_VERSION as COST_FINANCIAL_PROMPT_VERSION } from '../agents/cost-financial/prompts.js';
import { PROMPT_VERSION as PROCUREMENT_PROMPT_VERSION } from '../agents/procurement/prompts.js';
import { complianceOutputSchema } from '../agents/compliance/output.schema.js';
import { PROMPT_VERSION as COMPLIANCE_PROMPT_VERSION } from '../agents/compliance/prompts.js';
import { estimatingBoqOutputSchema } from '../agents/estimating-boq/output.schema.js';
import { PROMPT_VERSION as ESTIMATING_BOQ_PROMPT_VERSION } from '../agents/estimating-boq/prompts.js';
import { coordinatorOutputSchema } from '../agents/coordinator/output.schema.js';
import { PROMPT_VERSION as COORDINATOR_PROMPT_VERSION } from '../agents/coordinator/prompts.js';
import { reportsOutputSchema } from '../agents/reports/output.schema.js';
import { PROMPT_VERSION as REPORTS_PROMPT_VERSION } from '../agents/reports/prompts.js';

export interface AgentManifest {
  name: AgentName;
  version: string;
  promptVersion?: string;
  inputSchema: z.ZodType;
  outputSchema: z.ZodType;
  allowedTools: string[];
  tier: ModelTier;
  limitOverrides?: Partial<RunLimits>;
  supportedChannels: Array<'api' | 'chat' | 'voice'>;
}

const REGISTRY = new Map<AgentName, AgentManifest>();

export function registerAgent(manifest: AgentManifest): void {
  if (REGISTRY.has(manifest.name)) {
    throw new Error(`Agent "${manifest.name}" is already registered`);
  }
  REGISTRY.set(manifest.name, manifest);
}

export function getAgent(name: string): AgentManifest | undefined {
  return REGISTRY.get(name as AgentName);
}

export function listAgents(): AgentManifest[] {
  return [...REGISTRY.values()];
}

// ── Built-in Agent Registrations ─────────────────────────────────────────────

registerAgent({
  name: 'cost-financial',
  version: '1.0.0',
  promptVersion: COST_FINANCIAL_PROMPT_VERSION,
  inputSchema: z.object({ question: z.string().optional() }).passthrough(),
  outputSchema: costFinancialOutputSchema,
  allowedTools: [
    'get_financial_summary',
    'get_cost_summary',
    'get_billing_summary',
    'get_cash_summary',
    'get_budget',
    'get_budget_summary',
    'list_financial_audit_events',
  ],
  tier: 'cheap',
  supportedChannels: ['api', 'chat'],
});

registerAgent({
  name: 'procurement',
  version: '1.0.0',
  promptVersion: PROCUREMENT_PROMPT_VERSION,
  inputSchema: z.object({ question: z.string().optional() }).passthrough(),
  outputSchema: procurementOutputSchema,
  allowedTools: [
    'list_purchase_orders',
    'get_purchase_order',
    'list_quotes',
    'get_quote',
    'compare_quotes',
    'get_procurement_report',
    'check_delivery_status',
  ],
  tier: 'cheap',
  supportedChannels: ['api', 'chat'],
});

registerAgent({
  name: 'echo',
  version: '1.0.0',
  inputSchema: z.record(z.unknown()),
  outputSchema: z.any(),
  allowedTools: [],
  tier: 'cheap',
  supportedChannels: ['api', 'chat', 'voice'],
});

registerAgent({
  name: 'echo-approval',
  version: '1.0.0',
  inputSchema: z.object({ amount: z.number().optional(), action: z.string().optional() }).passthrough(),
  outputSchema: z.any(),
  allowedTools: ['fake_approve_something'],
  tier: 'cheap',
  supportedChannels: ['api'],
});

registerAgent({
  name: 'echo-loop',
  version: '1.0.0',
  inputSchema: z.record(z.unknown()),
  outputSchema: z.any(),
  allowedTools: ['fake_read_loop'],
  tier: 'cheap',
  limitOverrides: { maxSteps: 3 },
  supportedChannels: ['api'],
});

registerAgent({
  name: 'echo-slow',
  version: '1.0.0',
  inputSchema: z.record(z.unknown()),
  outputSchema: z.any(),
  allowedTools: ['fake_sleep'],
  tier: 'cheap',
  limitOverrides: { timeoutMs: 3000 }, // 3-second timeout for tests
  supportedChannels: ['api'],
});

// ── WAVE 3 Agents ─────────────────────────────────────────────────────────────

registerAgent({
  name: 'compliance',
  version: '1.0.0',
  promptVersion: COMPLIANCE_PROMPT_VERSION,
  inputSchema: z.object({ question: z.string().optional() }).passthrough(),
  outputSchema: complianceOutputSchema,
  allowedTools: [
    'read_okf_page',
    'list_quality_inspections',
    'list_quality_deficiencies',
    'list_corrective_actions',
    'list_safety_events',
    'list_permits',
    'list_compliance_inspections',
    'list_compliance_records',
    'get_expiring_items',
    'search_knowledge_base',
  ],
  tier: 'cheap',
  supportedChannels: ['api', 'chat'],
});

registerAgent({
  name: 'estimating-boq',
  version: '1.0.0',
  promptVersion: ESTIMATING_BOQ_PROMPT_VERSION,
  inputSchema: z.object({ question: z.string().optional() }).passthrough(),
  outputSchema: estimatingBoqOutputSchema,
  allowedTools: [
    'read_okf_page',
    'list_boqs',
    'get_boq_revision',
    'list_estimates',
    'get_estimate',
    'list_takeoff_sheets',
    'get_takeoff_measurements',
    'get_takeoff_summary',
    'list_cost_codes',
    'search_knowledge_base',
  ],
  tier: 'strong',
  supportedChannels: ['api', 'chat'],
});

// ── WAVE 4 Agents ─────────────────────────────────────────────────────────────

registerAgent({
  name: 'coordinator',
  version: '1.0.0',
  promptVersion: COORDINATOR_PROMPT_VERSION,
  inputSchema: z.object({ question: z.string().optional() }).passthrough(),
  outputSchema: coordinatorOutputSchema,
  allowedTools: ['route_to_agent', 'list_available_agents'],
  tier: 'cheap', // Uses gpt-4o-mini for classification/routing
  supportedChannels: ['api', 'chat'],
});

registerAgent({
  name: 'reports',
  version: '1.0.0',
  promptVersion: REPORTS_PROMPT_VERSION,
  inputSchema: z.object({ question: z.string().optional() }).passthrough(),
  outputSchema: reportsOutputSchema,
  allowedTools: [
    'get_health_report',
    'get_schedule_report',
    'get_cost_report',
    'get_procurement_report',
    'get_subcontractor_report',
    'get_executive_summary',
    'get_portfolio_report',
  ],
  tier: 'cheap',
  supportedChannels: ['api', 'chat'],
});
