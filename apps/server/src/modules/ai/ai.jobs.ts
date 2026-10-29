// apps/server/src/modules/ai/ai.jobs.ts
// PgBoss queue names and typed job payloads for the AI module.
// Import from here — never hardcode queue strings elsewhere.

import type { AgentName } from './core/types.js';

export const AI_QUEUES = {
  /** Execute an agent run end-to-end (the main async job) */
  AGENT_RUN: 'ai:agent-run',
  /** Asynchronously transcribe audio from storage */
  TRANSCRIBE: 'ai:transcribe',
  /** AI reaper sweeping stale runs and approvals */
  REAPER: 'ai:reaper',
} as const;

export type AiQueueName = (typeof AI_QUEUES)[keyof typeof AI_QUEUES];

// ── Job payloads ──────────────────────────────────────────────────────────────

export interface AgentRunJobPayload {
  /** The agent_runs.id row that the worker will execute */
  runId: string;
  /** Tenant scope — resolved server-side, never from user input */
  organizationId: string;
  projectId?: string;
  agent: AgentName;
  /** The userId who triggered the run (for tracing only — NOT used for RBAC inside the graph) */
  createdBy: string;
}
