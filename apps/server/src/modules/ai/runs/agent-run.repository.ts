// apps/server/src/modules/ai/runs/agent-run.repository.ts
import { eq, and, desc, lt, sql } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  agentRuns,
  agentUsageDaily,
  type AgentRun,
  type NewAgentRun,
  type AgentUsageDaily,
} from '@siteflow/database/schema';
import { createLogger } from '@siteflow/observability/server';
import type { AgentRunStatus } from '../core/types.js';

const logger = createLogger({ name: 'agent-run-repository' });

export interface ListRunsOptions {
  organizationId: string;
  projectId?: string;
  agent?: string;
  status?: AgentRunStatus;
  limit?: number;
  cursor?: string; // createdAt ISO string of the last seen row
}

export interface UsageDeltaOptions {
  organizationId: string;
  agent: string;
  day: string; // 'YYYY-MM-DD'
  tokensIn: number;
  tokensOut: number;
  costUsd: string; // numeric string
}

export class AgentRunRepository {
  private get db() {
    return getDb();
  }

  // ── Create ────────────────────────────────────────────────────────────────

  async create(data: Omit<NewAgentRun, 'id'>): Promise<AgentRun> {
    const result = await this.db
      .insert(agentRuns)
      .values({ id: generateId(), ...data })
      .returning();
    return result[0]!;
  }

  // ── Read ──────────────────────────────────────────────────────────────────

  async findById(id: string, organizationId: string): Promise<AgentRun | undefined> {
    const result = await this.db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, id), eq(agentRuns.organizationId, organizationId)))
      .limit(1);
    return result[0];
  }

  /** Fetch without org scope — used ONLY inside the worker where we already have the runId. */
  async findByIdInternal(id: string): Promise<AgentRun | undefined> {
    const result = await this.db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, id))
      .limit(1);
    return result[0];
  }

  /** Checks if a run has been set to CANCELLED mid-execution. */
  async isCancelled(id: string): Promise<boolean> {
    const result = await this.db
      .select({ status: agentRuns.status })
      .from(agentRuns)
      .where(eq(agentRuns.id, id))
      .limit(1);
    return result[0]?.status === 'CANCELLED';
  }

  async list(opts: ListRunsOptions): Promise<AgentRun[]> {
    const { organizationId, projectId, agent, status, limit = 20, cursor } = opts;

    const conditions = [eq(agentRuns.organizationId, organizationId)];
    if (projectId) conditions.push(eq(agentRuns.projectId, projectId));
    if (agent) conditions.push(eq(agentRuns.agent, agent));
    if (status) conditions.push(eq(agentRuns.status, status));
    if (cursor) conditions.push(lt(agentRuns.createdAt, new Date(cursor)));

    return this.db
      .select()
      .from(agentRuns)
      .where(and(...conditions))
      .orderBy(desc(agentRuns.createdAt))
      .limit(Math.min(limit, 100));
  }

  // ── Status transitions ────────────────────────────────────────────────────

  async setRunning(id: string): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({ status: 'RUNNING', startedAt: new Date(), updatedAt: new Date() })
      .where(eq(agentRuns.id, id));
  }

  /**
   * Atomically transitions a run from QUEUED → RUNNING using a conditional update.
   * Returns true if the transition succeeded (this worker owns the run).
   * Returns false if another worker already claimed it — caller should skip.
   *
   * This prevents double-execution when PgBoss retries a job after a worker crash.
   */
  async setRunningIfQueued(
    id: string,
    meta?: { provider?: string; model?: string; channel?: string },
  ): Promise<boolean> {
    const result = await this.db
      .update(agentRuns)
      .set({
        status: 'RUNNING',
        startedAt: new Date(),
        updatedAt: new Date(),
        ...(meta?.provider && { provider: meta.provider }),
        ...(meta?.model && { model: meta.model }),
        ...(meta?.channel && { channel: meta.channel }),
      })
      .where(and(eq(agentRuns.id, id), eq(agentRuns.status, 'QUEUED')))
      .returning({ id: agentRuns.id });
    return result.length > 0;
  }

  /**
   * Persists running token totals mid-run so limits are preserved across process
   * restarts and resume cycles (otherwise a new process starts with 0 counters).
   * Called after each successful tool invocation.
   */
  async updateRunningTokens(id: string, tokensIn: number, tokensOut: number): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({ tokensIn, tokensOut, updatedAt: new Date() })
      .where(eq(agentRuns.id, id));
  }

  async setAwaitingApproval(id: string): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({ status: 'AWAITING_APPROVAL', updatedAt: new Date() })
      .where(eq(agentRuns.id, id));
  }

  async setSucceeded(
    id: string,
    output: unknown,
    tokensIn: number,
    tokensOut: number,
    costUsd: string,
    traceId?: string,
  ): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({
        status: 'SUCCEEDED',
        output: output as any,
        tokensIn,
        tokensOut,
        costUsd,
        traceId: traceId ?? null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(eq(agentRuns.id, id), eq(agentRuns.status, 'RUNNING')));
  }

  async setFailed(
    id: string,
    error: string,
    tokensIn?: number,
    tokensOut?: number,
    costUsd?: string,
    traceId?: string,
  ): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({
        status: 'FAILED',
        error,
        ...(tokensIn !== undefined && { tokensIn }),
        ...(tokensOut !== undefined && { tokensOut }),
        ...(costUsd !== undefined && { costUsd }),
        traceId: traceId ?? null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(agentRuns.id, id));
  }

  async setCancelled(id: string): Promise<void> {
    await this.db
      .update(agentRuns)
      .set({ status: 'CANCELLED', finishedAt: new Date(), updatedAt: new Date() })
      .where(eq(agentRuns.id, id));
  }

  // ── Usage daily upsert ────────────────────────────────────────────────────

  async upsertUsageDaily(opts: UsageDeltaOptions): Promise<AgentUsageDaily> {
    logger.debug(opts, 'Upserting daily usage');

    // INSERT the first-ever row for this (org, day, agent) tuple.
    // If the row already exists the conflict clause is a no-op — the real
    // increment happens in the UPDATE below, so we don't double-count.
    const insertResult = await this.db
      .insert(agentUsageDaily)
      .values({
        id: generateId(),
        organizationId: opts.organizationId,
        day: opts.day,
        agent: opts.agent,
        runsCount: 1,
        tokensIn: opts.tokensIn,
        tokensOut: opts.tokensOut,
        costUsd: opts.costUsd,
      })
      .onConflictDoNothing()
      .returning();

    if (insertResult.length > 0) {
      // First row for this tuple — no further update needed.
      return insertResult[0]!;
    }

    // Row already existed — increment atomically via Drizzle sql`` helper.
    const updated = await this.db
      .update(agentUsageDaily)
      .set({
        runsCount: sql`${agentUsageDaily.runsCount} + 1`,
        tokensIn: sql`${agentUsageDaily.tokensIn} + ${opts.tokensIn}`,
        tokensOut: sql`${agentUsageDaily.tokensOut} + ${opts.tokensOut}`,
        costUsd: sql`${agentUsageDaily.costUsd} + ${opts.costUsd}`,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(agentUsageDaily.organizationId, opts.organizationId),
          eq(agentUsageDaily.day, opts.day),
          eq(agentUsageDaily.agent, opts.agent),
        ),
      )
      .returning();

    return updated[0]!;
  }

  /** Returns today's aggregated spend in USD for the org (used by budget-guard). */
  async getDailySpend(organizationId: string, day: string): Promise<number> {
    const rows = await this.db
      .select({ costUsd: agentUsageDaily.costUsd })
      .from(agentUsageDaily)
      .where(
        and(
          eq(agentUsageDaily.organizationId, organizationId),
          eq(agentUsageDaily.day, day),
        ),
      );

    return rows.reduce((sum, r) => sum + parseFloat(r.costUsd ?? '0'), 0);
  }
}
