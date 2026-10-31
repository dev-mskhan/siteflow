// apps/server/src/modules/ai/runs/agent-run.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { sendJob } from '../../../lib/queue/queue.js';
import { AgentRunRepository } from './agent-run.repository.js';
import { AI_QUEUES, type AgentRunJobPayload } from '../ai.jobs.js';
import { AgentRunNotFoundError, ProjectAccessDeniedError } from '../core/errors.js';
import type { AgentName, AgentRunStatus, AgentRunTrigger } from '../core/types.js';
import type { AgentRun } from '@siteflow/database/schema';
import { projectMemberRepository } from '../../project/members/project-member.repository.js';

const logger = createLogger({ name: 'agent-run-service' });
const tracer = trace.getTracer('agent-run-service');

export interface StartRunInput {
  organizationId: string;
  projectId?: string;
  agent: AgentName;
  trigger?: AgentRunTrigger;
  triggerRef?: string;
  channel?: 'api' | 'chat' | 'voice';
  conversationId?: string;
  correlationId?: string;
  input: Record<string, unknown>;
  createdBy: string; // userId — resolved from request.user server-side
}

export interface ListRunsInput {
  organizationId: string;
  projectId?: string;
  agent?: string;
  status?: AgentRunStatus;
  limit?: number;
  cursor?: string;
}

export class AgentRunService {
  constructor(private repo = new AgentRunRepository()) {}

  // ── Start a new run ───────────────────────────────────────────────────────
  // 1. Insert agent_runs row with QUEUED status
  // 2. Enqueue PgBoss job (non-blocking)
  // 3. Return runId immediately to the HTTP caller

  async startRun(input: StartRunInput): Promise<{ runId: string }> {
    return withSpan(tracer, 'ai.startRun', async (span) => {
      span.setAttribute('ai.agent', input.agent);
      span.setAttribute('organization.id', input.organizationId);

      // ── Q2 fix: verify project membership when projectId is supplied ──────
      // Only org-level RBAC is checked by the route middleware. If the caller
      // scopes the run to a specific project we must confirm they are an active
      // member of that project — not just a member of the org.
      if (input.projectId) {
        const membership = await projectMemberRepository.findActiveByProjectAndUser(
          input.organizationId,
          input.projectId,
          input.createdBy,
        );
        if (!membership) {
          throw new ProjectAccessDeniedError(input.projectId);
        }
      }

      const run = await this.repo.create({
        organizationId: input.organizationId,
        projectId: input.projectId ?? null,
        agent: input.agent,
        trigger: input.trigger ?? 'USER',
        triggerRef: input.triggerRef ?? null,
        channel: input.channel ?? 'api',
        conversationId: input.conversationId ?? null,
        correlationId: input.correlationId ?? null,
        status: 'QUEUED',
        inputSnapshot: input.input,
        createdBy: input.createdBy,
      });

      const payload: AgentRunJobPayload = {
        runId: run.id,
        organizationId: run.organizationId,
        projectId: run.projectId ?? undefined,
        agent: run.agent as AgentName,
        createdBy: run.createdBy,
      };

      await sendJob(AI_QUEUES.AGENT_RUN, { ...payload }, {
        // One attempt per run — the run itself handles retries via the graph checkpointer
        retryLimit: 0,
        // Kill the job if it hasn't been picked up after 5 minutes
        expireInSeconds: 300,
      });

      logger.info({ runId: run.id, agent: run.agent }, 'Agent run queued');
      return { runId: run.id };
    });
  }

  // ── Read a single run ─────────────────────────────────────────────────────

  async getRun(runId: string, organizationId: string): Promise<AgentRun> {
    return withSpan(tracer, 'ai.getRun', async () => {
      const run = await this.repo.findById(runId, organizationId);
      if (!run) throw new AgentRunNotFoundError(runId);
      return run;
    });
  }

  // ── List runs ─────────────────────────────────────────────────────────────

  async listRuns(input: ListRunsInput): Promise<{ data: AgentRun[]; nextCursor: string | null }> {
    return withSpan(tracer, 'ai.listRuns', async () => {
      const limit = Math.min(input.limit ?? 20, 100);
      const rows = await this.repo.list({ ...input, limit: limit + 1 });

      let nextCursor: string | null = null;
      if (rows.length > limit) {
        rows.pop();
        nextCursor = rows[rows.length - 1]!.createdAt.toISOString();
      }

      return { data: rows, nextCursor };
    });
  }

  // ── Cancel a queued/running run ───────────────────────────────────────────

  async cancelRun(runId: string, organizationId: string, requestingUserId?: string): Promise<void> {
    return withSpan(tracer, 'ai.cancelRun', async () => {
      const run = await this.repo.findById(runId, organizationId);
      if (!run) throw new AgentRunNotFoundError(runId);

      // ── Q3 fix: non-admin users may only cancel their own runs ─────────────
      // If a requestingUserId is provided and it differs from the run owner,
      // return 404 (not 403) to avoid leaking that the run exists for another user.
      if (requestingUserId && run.createdBy !== requestingUserId) {
        throw new AgentRunNotFoundError(runId);
      }

      const cancellable: AgentRunStatus[] = ['QUEUED', 'AWAITING_APPROVAL', 'RUNNING'];
      if (!cancellable.includes(run.status)) {
        throw new Error(`Run ${runId} is in status ${run.status} and cannot be cancelled`);
      }

      await this.repo.setCancelled(runId);
      logger.info({ runId }, 'Agent run cancelled');
    });
  }

  // ── Status transitions (called by the worker, not HTTP) ───────────────────

  async markRunning(runId: string): Promise<void> {
    await this.repo.setRunning(runId);
  }

  async markSucceeded(
    runId: string,
    organizationId: string,
    agent: string,
    output: unknown,
    tokensIn: number,
    tokensOut: number,
    costUsd: string,
    traceId?: string,
  ): Promise<void> {
    await this.repo.setSucceeded(runId, output, tokensIn, tokensOut, costUsd, traceId);
    await this.repo.upsertUsageDaily({
      organizationId,
      agent,
      day: new Date().toISOString().slice(0, 10),
      tokensIn,
      tokensOut,
      costUsd,
    });
  }

  async markFailed(
    runId: string,
    error: string,
    organizationId?: string,
    agent?: string,
    tokensIn?: number,
    tokensOut?: number,
    costUsd?: string,
    traceId?: string,
  ): Promise<void> {
    await this.repo.setFailed(runId, error, tokensIn, tokensOut, costUsd, traceId);
    if (organizationId && agent && tokensIn !== undefined && costUsd !== undefined) {
      await this.repo.upsertUsageDaily({
        organizationId,
        agent,
        day: new Date().toISOString().slice(0, 10),
        tokensIn,
        tokensOut: tokensOut ?? 0,
        costUsd,
      });
    }
  }

  async markAwaitingApproval(runId: string): Promise<void> {
    await this.repo.setAwaitingApproval(runId);
  }
}
