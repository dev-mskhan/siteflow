// apps/server/src/modules/ai/tools/tool-registry.ts
//
// Central registry of all AI tools.
// Every tool is registered once with its metadata (name, schema, riskTier,
// requiredPermission). tool-factory.ts looks up entries here before executing.
//
// Rules:
// - Tools never appear in more than one tier (READ / DRAFT / BINDING).
// - BINDING tools are registered but are unreachable until an APPROVED
//   agent_approvals row exists for the current run (enforced in tool-factory).
// - The LLM sees tool names + descriptions; it never sees riskTier or permission.

import { z } from 'zod';
import type { AgentRiskTier } from '../core/types.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ToolDefinition<TArgs = unknown, TResult = unknown> {
  /** Unique tool name — must be snake_case, stable across deploys */
  name: string;
  /** One sentence shown to the LLM in the tool list */
  description: string;
  /** Zod schema for the arguments the LLM provides.
   *  MUST NOT include organizationId / projectId / userId — those come from RunContext. */
  argsSchema: z.ZodType<TArgs>;
  /** Risk tier enforced by tool-factory before execution */
  riskTier: AgentRiskTier;
  /** RBAC permission key the calling user must hold (checked against RunContext.userId) */
  requiredPermission: string;
  /** The actual implementation — receives typed args; RunContext injected by factory */
  execute: (args: TArgs, ctx: import('../core/run-context.js').RunContext) => Promise<TResult>;
}

// ── Registry ──────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const registry = new Map<string, ToolDefinition<any, any>>();

/**
 * Register a tool. Called once at module load time from definitions/*.tools.ts.
 * Throws if a tool with the same name is already registered (prevents silent shadowing).
 */
export function registerTool<TArgs, TResult>(def: ToolDefinition<TArgs, TResult>): void {
  if (registry.has(def.name)) {
    throw new Error(`AI tool "${def.name}" is already registered`);
  }
  registry.set(def.name, def);
}

/** Look up a registered tool by name. Returns undefined if not found. */
export function getTool(name: string): ToolDefinition | undefined {
  return registry.get(name);
}

/** Return all tools whose names appear in the provided set. Used by agents to
 *  expose only their allowed subset of tools to the LangGraph node. */
export function getToolsForAgent(allowedNames: string[]): ToolDefinition[] {
  return allowedNames
    .map((n) => registry.get(n))
    .filter((t): t is ToolDefinition => t !== undefined);
}

/** Returns all registered tool names — used by tests and the eval harness. */
export function listRegisteredTools(): string[] {
  return [...registry.keys()];
}
