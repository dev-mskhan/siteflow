// apps/server/src/modules/ai/core/types.ts
// Shared constants and primitive types used across all AI sub-modules.
// No domain-module imports — only DB schema types and primitives.

import type {
  AgentRunStatus,
  AgentRunTrigger,
  AgentRiskTier,
  AgentApprovalStatus,
  AgentToolCallStatus,
} from '@siteflow/database/schema';

export type {
  AgentRunStatus,
  AgentRunTrigger,
  AgentRiskTier,
  AgentApprovalStatus,
  AgentToolCallStatus,
};

// ── Agent registry ────────────────────────────────────────────────────────────
// Add to this union when registering a new agent. Keeping it strict ensures
// the job payload and agent-run rows always reference a known agent.

export type AgentName = 'cost-financial';
// future: | 'schedule-advisor' | 'procurement-assistant'

// ── Model tiers ───────────────────────────────────────────────────────────────
// Code always refers to tiers; model-factory.ts resolves tier → concrete model.
// This insulates all agent code from provider/model changes.

export type ModelTier = 'cheap' | 'strong';

// ── Per-run hard limits ────────────────────────────────────────────────────────
// Enforced by runner.ts. Exceeding any limit → run transitions to FAILED.

export interface RunLimits {
  /** Max LangGraph state-machine steps (nodes visited) */
  maxSteps: number;
  /** Max total tool invocations across all steps */
  maxToolCalls: number;
  /** Max combined input+output tokens for the whole run */
  maxTokens: number;
  /** Wall-clock timeout in milliseconds */
  timeoutMs: number;
}

export const DEFAULT_RUN_LIMITS: RunLimits = {
  maxSteps: 20,
  maxToolCalls: 15,
  maxTokens: 50_000,
  timeoutMs: 120_000, // 2 minutes
};

// ── Tool result envelope ──────────────────────────────────────────────────────
// Every tool wrapper returns one of these two shapes. The graph reads `ok`
// before using the result — never branches on error message strings.

export interface ToolCallResult<T = unknown> {
  ok: true;
  data: T;
}

export interface ToolCallError {
  ok: false;
  code: string;
  message: string;
}

export type ToolResult<T = unknown> = ToolCallResult<T> | ToolCallError;

// ── Final run output ──────────────────────────────────────────────────────────
// Written to agent_runs.output after the graph reaches END.

export interface AgentRunOutput {
  /** The agent's Zod-validated structured answer */
  answer: unknown;
  /** One-paragraph human-readable summary for the UI */
  summary: string;
  /** Which tool results are cited in the answer */
  citations: Array<{ toolName: string; snippet: string }>;
}

// ── PgBoss job payload ────────────────────────────────────────────────────────

export const AI_QUEUES = {
  AGENT_RUN: 'ai:agent-run',
} as const;

export type AiQueueName = (typeof AI_QUEUES)[keyof typeof AI_QUEUES];

export interface AgentRunJobPayload {
  runId: string;
  organizationId: string;
  projectId?: string;
  agent: AgentName;
  createdBy: string;
}
