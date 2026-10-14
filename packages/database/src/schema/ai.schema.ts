// packages/database/src/schema/ai.schema.ts
// AI module persistence layer — agent_runs, agent_tool_calls, agent_approvals,
// agent_usage_daily. All tables are tenant-scoped (organizationId mandatory).
// NEVER import domain tables from here — keep AI schema self-contained.

import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  text,
  timestamp,
  uniqueIndex,
  date,
} from 'drizzle-orm/pg-core';
import { appSchema } from './auth.schema';

// ── Enums ─────────────────────────────────────────────────────────────────────

export const agentRunStatusEnum = appSchema.enum('agent_run_status', [
  'QUEUED',
  'RUNNING',
  'AWAITING_APPROVAL',
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
]);

export const agentRunTriggerEnum = appSchema.enum('agent_run_trigger', [
  'USER',
  'EVENT',
  'SCHEDULE',
]);

export const agentToolCallStatusEnum = appSchema.enum('agent_tool_call_status', [
  'SUCCESS',
  'ERROR',
  'SKIPPED',
]);

export const agentRiskTierEnum = appSchema.enum('agent_risk_tier', [
  'READ',
  'DRAFT',
  'BINDING',
]);

export const agentApprovalStatusEnum = appSchema.enum('agent_approval_status', [
  'PENDING',
  'APPROVED',
  'REJECTED',
  'EXPIRED',
]);

// ── agent_runs ────────────────────────────────────────────────────────────────
// One row per agent execution attempt. Created QUEUED on HTTP request,
// transitions through RUNNING → SUCCEEDED | FAILED | CANCELLED.
// AWAITING_APPROVAL is a pause state while a BINDING tool waits for human sign-off.

export const agentRuns = appSchema.table(
  'agent_runs',
  {
    id: text('id').primaryKey(),                         // ulid
    organizationId: text('organization_id').notNull(),
    projectId: text('project_id'),                       // null for org-level agents
    agent: text('agent').notNull(),                      // e.g. 'cost-financial'
    trigger: agentRunTriggerEnum('trigger').notNull(),
    triggerRef: text('trigger_ref'),                     // e.g. outbox event id, cron name
    status: agentRunStatusEnum('status').notNull().default('QUEUED'),
    // Snapshot of the user's original request — used for audit and resume
    inputSnapshot: jsonb('input_snapshot').notNull().default({}),
    // Final structured output (agent's Zod-validated answer)
    output: jsonb('output'),
    error: text('error'),
    // Cost accounting
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
    // Observability links
    traceId: text('trace_id'),
    correlationId: text('correlation_id'),
    // Audit
    createdBy: text('created_by').notNull(),             // userId
    startedAt: timestamp('started_at', { withTimezone: true }),
    finishedAt: timestamp('finished_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    index('agent_runs_org_status_created_idx').on(
      t.organizationId,
      t.status,
      t.createdAt.desc(),
    ),
    index('agent_runs_org_project_idx').on(t.organizationId, t.projectId),
    index('agent_runs_org_agent_idx').on(t.organizationId, t.agent),
    index('agent_runs_created_by_idx').on(t.createdBy),
    index('agent_runs_trace_id_idx').on(t.traceId),
    check('agent_runs_tokens_in_nonneg', sql`${t.tokensIn} >= 0`),
    check('agent_runs_tokens_out_nonneg', sql`${t.tokensOut} >= 0`),
    check('agent_runs_cost_nonneg', sql`${t.costUsd} >= 0`),
    check(
      'agent_runs_started_at_check',
      sql`${t.startedAt} IS NULL OR ${t.status} <> 'QUEUED'`,
    ),
    check(
      'agent_runs_finished_at_check',
      sql`${t.finishedAt} IS NULL OR ${t.status} IN ('SUCCEEDED', 'FAILED', 'CANCELLED')`,
    ),
  ],
);

// ── agent_tool_calls ──────────────────────────────────────────────────────────
// Append-only log of every tool invocation within a run.
// argsRedacted: args with any PII fields replaced before storage (no raw user input).
// resultSummary: a compact summary — never the full result blob.

export const agentToolCalls = appSchema.table(
  'agent_tool_calls',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull(),
    organizationId: text('organization_id').notNull(),
    toolName: text('tool_name').notNull(),
    riskTier: agentRiskTierEnum('risk_tier').notNull(),
    argsRedacted: jsonb('args_redacted').notNull().default({}),
    resultSummary: jsonb('result_summary'),
    status: agentToolCallStatusEnum('status').notNull(),
    errorMessage: text('error_message'),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index('agent_tool_calls_run_idx').on(t.runId, t.createdAt),
    index('agent_tool_calls_org_tool_idx').on(t.organizationId, t.toolName),
    check('agent_tool_calls_duration_nonneg', sql`${t.durationMs} IS NULL OR ${t.durationMs} >= 0`),
  ],
);

// ── agent_approvals ───────────────────────────────────────────────────────────
// Created when a BINDING tool requires human sign-off (graph interrupt).
// The run stays AWAITING_APPROVAL until APPROVED or REJECTED.
// Only one PENDING approval per run at a time (partial unique index).

export const agentApprovals = appSchema.table(
  'agent_approvals',
  {
    id: text('id').primaryKey(),
    runId: text('run_id').notNull(),
    organizationId: text('organization_id').notNull(),
    proposalType: text('proposal_type').notNull(),       // e.g. 'BUDGET_AMENDMENT'
    proposal: jsonb('proposal').notNull(),               // structured proposal for the UI
    status: agentApprovalStatusEnum('status').notNull().default('PENDING'),
    decidedBy: text('decided_by'),                       // userId
    decidedAt: timestamp('decided_at', { withTimezone: true }),
    decisionNote: text('decision_note'),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    // Only one PENDING approval per run at a time
    uniqueIndex('agent_approvals_run_pending_unique')
      .on(t.runId)
      .where(sql`${t.status} = 'PENDING'`),
    index('agent_approvals_org_status_idx').on(t.organizationId, t.status, t.createdAt.desc()),
    index('agent_approvals_run_idx').on(t.runId),
    index('agent_approvals_expires_idx').on(t.expiresAt),
    check(
      'agent_approvals_decision_metadata_check',
      sql`${t.status} = 'PENDING' OR (${t.decidedBy} IS NOT NULL AND ${t.decidedAt} IS NOT NULL)`,
    ),
    check(
      'agent_approvals_expires_positive',
      sql`${t.expiresAt} > ${t.createdAt}`,
    ),
  ],
);

// ── agent_usage_daily ─────────────────────────────────────────────────────────
// Aggregated daily cost per org — used by budget-guard to enforce per-org limits.
// One row per (organizationId, day, agent). Upserted at the end of every run.

export const agentUsageDaily = appSchema.table(
  'agent_usage_daily',
  {
    id: text('id').primaryKey(),
    organizationId: text('organization_id').notNull(),
    day: date('day', { mode: 'string' }).notNull(),      // ISO date 'YYYY-MM-DD'
    agent: text('agent').notNull(),
    runsCount: integer('runs_count').notNull().default(0),
    tokensIn: integer('tokens_in').notNull().default(0),
    tokensOut: integer('tokens_out').notNull().default(0),
    costUsd: numeric('cost_usd', { precision: 10, scale: 6 }).notNull().default('0'),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (t) => [
    uniqueIndex('agent_usage_daily_org_day_agent_unique').on(
      t.organizationId,
      t.day,
      t.agent,
    ),
    index('agent_usage_daily_org_day_idx').on(t.organizationId, t.day),
    check('agent_usage_daily_runs_nonneg', sql`${t.runsCount} >= 0`),
    check('agent_usage_daily_tokens_nonneg', sql`${t.tokensIn} >= 0 AND ${t.tokensOut} >= 0`),
    check('agent_usage_daily_cost_nonneg', sql`${t.costUsd} >= 0`),
  ],
);

// ── TypeScript types ──────────────────────────────────────────────────────────

export type AgentRun = typeof agentRuns.$inferSelect;
export type NewAgentRun = typeof agentRuns.$inferInsert;

export type AgentToolCall = typeof agentToolCalls.$inferSelect;
export type NewAgentToolCall = typeof agentToolCalls.$inferInsert;

export type AgentApproval = typeof agentApprovals.$inferSelect;
export type NewAgentApproval = typeof agentApprovals.$inferInsert;

export type AgentUsageDaily = typeof agentUsageDaily.$inferSelect;
export type NewAgentUsageDaily = typeof agentUsageDaily.$inferInsert;

export type AgentRunStatus =
  | 'QUEUED'
  | 'RUNNING'
  | 'AWAITING_APPROVAL'
  | 'SUCCEEDED'
  | 'FAILED'
  | 'CANCELLED';

export type AgentRunTrigger = 'USER' | 'EVENT' | 'SCHEDULE';
export type AgentRiskTier = 'READ' | 'DRAFT' | 'BINDING';
export type AgentApprovalStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';
export type AgentToolCallStatus = 'SUCCESS' | 'ERROR' | 'SKIPPED';
