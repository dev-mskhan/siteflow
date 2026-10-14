// apps/server/src/modules/ai/tools/tool-call.repository.ts
// Append-only log of every tool invocation within a run.
// Called by tool-factory.ts — never directly by agent code.

import { eq } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  agentToolCalls,
  type AgentToolCall,
  type NewAgentToolCall,
} from '@siteflow/database/schema';
import type { AgentRiskTier, AgentToolCallStatus } from '../core/types.js';

export interface LogToolCallOptions {
  runId: string;
  organizationId: string;
  toolName: string;
  riskTier: AgentRiskTier;
  /** Args with any sensitive fields replaced — never store raw user input */
  argsRedacted: Record<string, unknown>;
  status: AgentToolCallStatus;
  resultSummary?: Record<string, unknown>;
  errorMessage?: string;
  durationMs?: number;
}

export class ToolCallRepository {
  private get db() {
    return getDb();
  }

  async log(opts: LogToolCallOptions): Promise<AgentToolCall> {
    const values: NewAgentToolCall = {
      id: generateId(),
      runId: opts.runId,
      organizationId: opts.organizationId,
      toolName: opts.toolName,
      riskTier: opts.riskTier,
      argsRedacted: opts.argsRedacted,
      status: opts.status,
      resultSummary: opts.resultSummary ?? null,
      errorMessage: opts.errorMessage ?? null,
      durationMs: opts.durationMs ?? null,
    };

    const result = await this.db.insert(agentToolCalls).values(values).returning();
    return result[0]!;
  }

  /** Fetch all tool calls for a run — used by the eval harness. */
  async findByRunId(runId: string): Promise<AgentToolCall[]> {
    return this.db
      .select()
      .from(agentToolCalls)
      .where(eq(agentToolCalls.runId, runId))
      .orderBy(agentToolCalls.createdAt);
  }
}
