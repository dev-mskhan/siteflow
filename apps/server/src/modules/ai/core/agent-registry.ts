// apps/server/src/modules/ai/core/agent-registry.ts
//
// Central registry for agent declarations and manifests.
// Validates agent identity, versioning, input schemas, and channel capabilities.

import { z } from 'zod';
import type { AgentName, ModelTier, RunLimits } from './types.js';
import { costFinancialOutputSchema } from '../agents/cost-financial/output.schema.js';

export interface AgentManifest {
  name: AgentName;
  version: string;
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
