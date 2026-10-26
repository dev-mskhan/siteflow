// apps/server/src/modules/ai/core/run-context.ts
//
// RunContext is the single source of truth for every agent execution's
// identity and limits. It is built ONCE from the agent_runs row (by the
// worker, never by the LLM) and then passed read-only into every tool call.
//
// Rules enforced here:
//   - organizationId, projectId, userId, runId are NEVER LLM-chosen
//   - Limits are resolved from plan tier defaults, never from user input
//   - The context is frozen after construction (Object.freeze)

import type { AgentName, RunLimits } from './types.js';
import { DEFAULT_RUN_LIMITS } from './types.js';
import { TenantLeakError } from './errors.js';
import type { AgentRun } from '@siteflow/database/schema';

// ── Type ──────────────────────────────────────────────────────────────────────

export interface RunContext {
  /** Unique ID for this execution attempt */
  readonly runId: string;
  /** Tenant scope — injected into every tool call, never exposed to the LLM as a parameter */
  readonly organizationId: string;
  /** Optional project scope for project-level agents */
  readonly projectId: string | undefined;
  /** The authenticated user who triggered the run */
  readonly userId: string;
  /** Which agent graph to execute */
  readonly agent: AgentName;
  /** Optional correlation ID propagated across service boundaries */
  readonly correlationId?: string;
  /** Model provider name (e.g. openai, google, fake) */
  readonly provider?: string;
  /** Underlying model name */
  readonly model?: string;
  /** Initial input snapshot provided when the run was created */
  readonly input?: Record<string, unknown>;
  /** Hard resource limits for this run */
  readonly limits: RunLimits;
  /** ISO timestamp when the worker picked up the job — used for timeout tracking */
  readonly startedAt: Date;
  /** LangGraph thread ID used for checkpointing (== runId unless resuming) */
  readonly threadId: string;
}

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Builds a frozen RunContext from a persisted agent_runs row.
 * Called once at the top of agent-run.worker.ts — nowhere else.
 *
 * @param run      - The agent_runs row fetched from the DB
 * @param limits   - Resolved per-org/per-plan limits (from entitlement.service)
 *                   Defaults to DEFAULT_RUN_LIMITS when not provided
 */
export function buildRunContext(
  run: Pick<AgentRun, 'id' | 'organizationId' | 'projectId' | 'agent' | 'createdBy'> &
    Partial<Pick<AgentRun, 'correlationId' | 'provider' | 'model' | 'inputSnapshot'>>,
  limits: RunLimits = DEFAULT_RUN_LIMITS,
): RunContext {
  const ctx: RunContext = {
    runId: run.id,
    organizationId: run.organizationId,
    projectId: run.projectId ?? undefined,
    userId: run.createdBy,
    agent: run.agent as AgentName,
    correlationId: run.correlationId ?? undefined,
    provider: run.provider ?? undefined,
    model: run.model ?? undefined,
    input: (run.inputSnapshot as Record<string, unknown>) ?? undefined,
    limits,
    startedAt: new Date(),
    threadId: run.id, // One checkpoint thread per run; resume uses the same ID
  };

  // Freeze so nothing downstream can mutate org/project/user IDs
  return Object.freeze(ctx);
}

// ── Guard ─────────────────────────────────────────────────────────────────────

/**
 * Asserts that a data object's organizationId matches the RunContext.
 * Also verifies project scope when both run and resource specify projectId.
 * Call this in every tool wrapper before returning data to the graph.
 * Throws TenantLeakError (imported lazily to avoid circular deps).
 */
export function assertTenantScope(
  ctx: RunContext,
  data: { organizationId?: string | null; projectId?: string | null } | null | undefined,
  toolName: string,
): void {
  if (!data) return;
  if (data.organizationId && data.organizationId !== ctx.organizationId) {
    throw new TenantLeakError(ctx.runId, toolName);
  }
  if (ctx.projectId && data.projectId && data.projectId !== ctx.projectId) {
    throw new TenantLeakError(ctx.runId, `${toolName}:project_mismatch`);
  }
}
