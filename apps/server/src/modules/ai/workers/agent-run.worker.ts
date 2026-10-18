// apps/server/src/modules/ai/workers/agent-run.worker.ts
//
// PgBoss worker that executes agent runs end-to-end.
// Picks up ai:agent-run jobs, builds RunContext from the DB row,
// delegates to runner.ts (LangGraph), and writes the final status.

import type PgBoss from 'pg-boss';
import { createLogger } from '@siteflow/observability/server';
import { registerWorker } from '../../../lib/queue/worker-factory.js';
import { teardownCheckpointer } from '../graph/checkpointer.js';
import { executeRun, resumeRun } from '../graph/runner.js';
import { ApprovalRepository } from '../approvals/approval.repository.js';
import { AI_QUEUES, type AgentRunJobPayload } from '../ai.jobs.js';
import { AgentRunRepository } from '../runs/agent-run.repository.js';
import { buildRunContext } from '../core/run-context.js';
import { DEFAULT_RUN_LIMITS } from '../core/types.js';
import {
  MaxStepsExceededError,
  MaxTokensExceededError,
  MaxToolCallsExceededError,
  RunTimeoutError,
  BudgetExceededError,
  GuardrailBlockedError,
} from '../core/errors.js';
import { realtimeDeliveryManager } from '../../notification/realtime/realtime.delivery.js';
import { notificationService } from '../../notification/notification.service.js';

const logger = createLogger({ name: 'agent-run-worker' });

export async function registerAgentRunWorkers(boss: PgBoss): Promise<void> {
  const repo = new AgentRunRepository();
  const approvalRepo = new ApprovalRepository();

  await registerWorker<AgentRunJobPayload>(
    boss,
    {
      queue: AI_QUEUES.AGENT_RUN,
      concurrency: 5,
      // PgBoss hard timeout — slightly longer than runner's internal limit
      // so the runner always gets a chance to write FAILED cleanly first
      timeoutSecs: 180,
      tenantIdExtractor: (data) => data.organizationId,
      tenantConcurrencyLimit: 3,
      tenantLeaseGroup: AI_QUEUES.AGENT_RUN,
    },
    async (job) => {
      const { runId, organizationId, agent } = job.data;
      logger.info({ runId, agent, organizationId }, 'Agent run job picked up');

      // ── 1. Fetch the run row (source of truth for RunContext) ─────────────
      const run = await repo.findByIdInternal(runId);
      if (!run) {
        logger.warn({ runId }, 'Agent run row not found — skipping');
        return;
      }

      // ── 2. Idempotency guard + resume detection ───────────────────────────
      // QUEUED  → fresh execution
      // AWAITING_APPROVAL → an approval was just decided; check and resume
      // Anything else → already processed, skip
      if (run.status === 'AWAITING_APPROVAL') {
        const approval = await approvalRepo.findPendingForRun(runId);
        if (!approval) {
          logger.warn({ runId }, 'Resuming run but no pending approval found — skipping');
          return;
        }
        if (approval.status !== 'APPROVED') {
          logger.warn({ runId, approvalStatus: approval.status }, 'Approval not APPROVED — skipping');
          return;
        }

        const ctx = buildRunContext(run, DEFAULT_RUN_LIMITS);
        await repo.setRunning(runId);
        emitRunStarted(run);
        logger.info({ runId }, 'Resuming run after approval');

        try {
          const result = await resumeRun(ctx, { approved: true, approvalId: approval.id });

          if (result.interrupted) {
            await repo.setAwaitingApproval(runId);
            emitRunAwaitingApproval(run);
            return;
          }

          await repo.setSucceeded(runId, result.output, result.tokensIn, result.tokensOut, result.costUsd, result.traceId);
          emitRunSucceeded(run, result.costUsd);
          logger.info({ runId }, 'Resumed run succeeded');
        } catch (err: unknown) {
          const message = classifyError(err);
          logger.error({ runId, err }, 'Resumed run failed');
          await repo.setFailed(runId, message);
          emitRunFailed(run, message);
          if (!isLimitError(err)) throw err;
        }
        return;
      }

      if (run.status !== 'QUEUED') {
        logger.warn({ runId, status: run.status }, 'Run already processed — skipping');
        return;
      }

      // ── 3. Build frozen RunContext from the DB row ────────────────────────
      // IDs come from the DB row, never from the job payload.
      const ctx = buildRunContext(run, DEFAULT_RUN_LIMITS);

      // ── 4. Transition → RUNNING ───────────────────────────────────────────
      await repo.setRunning(runId);
      emitRunStarted(run);
      logger.info({ runId, agent: ctx.agent, threadId: ctx.threadId }, 'Run marked RUNNING');

      // ── 5. Execute via runner ─────────────────────────────────────────────
      try {
        const result = await executeRun(ctx);

        if (result.interrupted) {
          // Graph hit interrupt() — a BINDING tool needs human approval.
          // Status transition to AWAITING_APPROVAL; the approval.service
          // (Chunk 6) will resume the graph after a decision is made.
          await repo.setAwaitingApproval(runId);
          emitRunAwaitingApproval(run);
          logger.info({ runId }, 'Run paused — awaiting approval');
          return;
        }

        await repo.setSucceeded(
          runId,
          result.output,
          result.tokensIn,
          result.tokensOut,
          result.costUsd,
          result.traceId,
        );
        emitRunSucceeded(run, result.costUsd);

        logger.info(
          { runId, tokensIn: result.tokensIn, tokensOut: result.tokensOut, costUsd: result.costUsd },
          'Run succeeded',
        );

      } catch (err: unknown) {
        const message = classifyError(err);
        const isLimit = isLimitError(err);

        logger.error({ runId, err, message }, 'Agent run failed');

        await repo.setFailed(
          runId,
          message,
          // Pass any usage accumulated before the error (non-null from accumulator.flush inside runner)
          undefined,
          undefined,
          undefined,
          undefined,
        );
        emitRunFailed(run, message);

        // Re-throw limit errors so PgBoss marks the job FAILED (gives visibility in the queue UI).
        // For unexpected errors we also re-throw — PgBoss will not retry (retryLimit: 0).
        if (!isLimit) throw err;
      }

      logger.info({ runId }, 'Agent run job completed');
    },
  );

  logger.info('Registered AI module agent-run PgBoss worker');
}

function emitRunStarted(run: { id: string; createdBy: string; organizationId: string; agent: string; projectId: string | null }): void {
  realtimeDeliveryManager.broadcastToUser(run.createdBy, run.organizationId, {
    type: 'ai.run.started',
    runId: run.id,
    agent: run.agent,
    projectId: run.projectId,
  });
}

function emitRunAwaitingApproval(run: { id: string; createdBy: string; organizationId: string; agent: string; projectId: string | null }): void {
  realtimeDeliveryManager.broadcastToTenant(run.organizationId, {
    type: 'ai.approval.requested',
    runId: run.id,
    agent: run.agent,
    projectId: run.projectId,
  });
  void notificationService.createNotification({
    organizationId: run.organizationId,
    recipientId: run.createdBy,
    projectId: run.projectId,
    eventType: 'ai.approval.requested',
    channel: 'IN_APP',
    payload: {
      runId: run.id,
      agent: run.agent,
      message: `AI agent (${run.agent}) requested human approval.`,
    },
  }).catch((err) => logger.warn({ runId: run.id, err }, 'Failed to create in-app approval notification'));
}

function emitRunSucceeded(
  run: { id: string; createdBy: string; organizationId: string; agent: string; projectId: string | null },
  costUsd?: string,
): void {
  realtimeDeliveryManager.broadcastToUser(run.createdBy, run.organizationId, {
    type: 'ai.run.completed',
    runId: run.id,
    agent: run.agent,
    projectId: run.projectId,
    costUsd,
  });
  void notificationService.createNotification({
    organizationId: run.organizationId,
    recipientId: run.createdBy,
    projectId: run.projectId,
    eventType: 'ai.run.completed',
    channel: 'IN_APP',
    payload: {
      runId: run.id,
      agent: run.agent,
      message: `AI agent run (${run.agent}) completed successfully.`,
      costUsd,
    },
  }).catch((err) => logger.warn({ runId: run.id, err }, 'Failed to create in-app success notification'));
}

function emitRunFailed(
  run: { id: string; createdBy: string; organizationId: string; agent: string; projectId: string | null },
  errorMessage: string,
): void {
  realtimeDeliveryManager.broadcastToUser(run.createdBy, run.organizationId, {
    type: 'ai.run.failed',
    runId: run.id,
    agent: run.agent,
    projectId: run.projectId,
    error: errorMessage,
  });
  void notificationService.createNotification({
    organizationId: run.organizationId,
    recipientId: run.createdBy,
    projectId: run.projectId,
    eventType: 'ai.run.failed',
    channel: 'IN_APP',
    payload: {
      runId: run.id,
      agent: run.agent,
      message: `AI agent run (${run.agent}) failed: ${errorMessage}`,
      error: errorMessage,
    },
  }).catch((err) => logger.warn({ runId: run.id, err }, 'Failed to create in-app failure notification'));
}

// ── Graceful shutdown ─────────────────────────────────────────────────────────
// Called from worker.ts shutdown hook so the checkpointer pool drains cleanly.

export async function teardownAiWorkers(): Promise<void> {
  await teardownCheckpointer();
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function classifyError(err: unknown): string {
  if (err instanceof MaxStepsExceededError)    return `Run exceeded max steps: ${err.message}`;
  if (err instanceof MaxTokensExceededError)   return `Run exceeded token limit: ${err.message}`;
  if (err instanceof MaxToolCallsExceededError) return `Run exceeded tool call limit: ${err.message}`;
  if (err instanceof RunTimeoutError)          return `Run timed out: ${err.message}`;
  if (err instanceof BudgetExceededError)      return `Budget exceeded: ${err.message}`;
  if (err instanceof GuardrailBlockedError)    return `Guardrail blocked: ${err.message}`;
  if (err instanceof Error)                    return err.message;
  return String(err);
}

function isLimitError(err: unknown): boolean {
  return (
    err instanceof MaxStepsExceededError    ||
    err instanceof MaxTokensExceededError   ||
    err instanceof MaxToolCallsExceededError ||
    err instanceof RunTimeoutError          ||
    err instanceof BudgetExceededError      ||
    err instanceof GuardrailBlockedError
  );
}
