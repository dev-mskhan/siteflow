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
import { ConversationService } from '../conversations/conversation.service.js';
import { AI_QUEUES, type AgentRunJobPayload } from '../ai.jobs.js';
import { AgentRunRepository } from '../runs/agent-run.repository.js';
import { buildRunContext } from '../core/run-context.js';
import { DEFAULT_RUN_LIMITS } from '../core/types.js';
import { getAgent } from '../core/agent-registry.js';
import { serverEnv } from '../../../config/env.js';
import {
  MaxStepsExceededError,
  MaxTokensExceededError,
  MaxToolCallsExceededError,
  RunTimeoutError,
  RunCancelledError,
  BudgetExceededError,
  GuardrailBlockedError,
  AiUsageLimitExceededError,
  NoActiveSubscriptionError,
} from '../core/errors.js';
import { realtimeDeliveryManager } from '../../notification/realtime/realtime.delivery.js';
import { notificationService } from '../../notification/notification.service.js';
import { flushLangfuse } from '../observability/langfuse-client.js';
import { AiUsageService } from '../usage/ai-usage.service.js';
import { AiUsageRepository } from '../usage/ai-usage.repository.js';
import { EntitlementService } from '../../billing/entitlement.service.js';

const logger = createLogger({ name: 'agent-run-worker' });

export async function registerAgentRunWorkers(boss: PgBoss): Promise<void> {
  const repo = new AgentRunRepository();
  const approvalRepo = new ApprovalRepository();
  const convService = new ConversationService();

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
        // Use findLatestForRun (not findPendingForRun): by the time the worker picks up
        // the resume job the approval row is already APPROVED, so a PENDING-only query
        // returns undefined and silently deadlocks the run in AWAITING_APPROVAL (ARC-02).
        const approval = await approvalRepo.findLatestForRun(runId);
        if (!approval) {
          logger.warn({ runId }, 'Resuming run but no approval row found — skipping');
          return;
        }
        if (approval.status !== 'APPROVED') {
          logger.warn({ runId, approvalStatus: approval.status }, 'Latest approval is not APPROVED — skipping');
          return;
        }

        const manifest = getAgent(run.agent);
        const limits = { ...DEFAULT_RUN_LIMITS, ...manifest?.limitOverrides };
        const ctx = buildRunContext(run, limits);
        await repo.setRunning(runId);
        emitRunStarted(run);
        logger.info({ runId }, 'Resuming run after approval');

        try {
          const result = await resumeRun(
            ctx,
            { approved: true, approvalId: approval.id, proposal: approval.proposal },
            { tokensIn: run.tokensIn, tokensOut: run.tokensOut },
          );

          if (result.interrupted) {
            await repo.setAwaitingApproval(runId);
            emitRunAwaitingApproval(run);
            return;
          }

          const conversationId =
            ((run.inputSnapshot as Record<string, unknown>)?.conversationId ?? run.conversationId) as string | undefined;
          if (typeof conversationId === 'string') {
            await convService.saveAssistantReply(
              conversationId,
              run.organizationId,
              result.output.summary ?? 'Run completed.',
              runId,
              (run.channel as 'chat' | 'voice') ?? 'chat',
            );
          }

          await repo.setSucceeded(runId, result.output, result.tokensIn, result.tokensOut, result.costUsd, result.traceId);
          emitRunSucceeded(run, result.costUsd);

          // ── Phase 11.1: Record AI usage after successful run ──────────────
          await recordUsageAfterRun(run.organizationId, runId, result.tokensIn, result.tokensOut, result.costUsd, true);

          logger.info({ runId }, 'Resumed run succeeded');
        } catch (err: unknown) {
          const message = classifyError(err);
          logger.error({ runId, err }, 'Resumed run failed');

          // ── Phase 11.1: Record usage for failed runs too (for cost tracking) ──
          if (run.tokensIn > 0 || run.tokensOut > 0) {
            const costUsd = (run.costUsd as string) || '0.000000';
            await recordUsageAfterRun(run.organizationId, runId, run.tokensIn, run.tokensOut, costUsd, false);
          }

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
      const manifest = getAgent(run.agent);
      const limits = { ...DEFAULT_RUN_LIMITS, ...manifest?.limitOverrides };
      const ctx = buildRunContext(run, limits);

      // ── 4. Atomic QUEUED → RUNNING transition (idempotency guard) ─────────
      // Use a conditional UPDATE so that if two workers race (PgBoss retry after crash),
      // only the first one proceeds. The second finds the row no longer QUEUED and skips.
      const claimed = await repo.setRunningIfQueued(runId, {
        provider: serverEnv.AI_PROVIDER,
        model: serverEnv.AI_MODEL_CHEAP,
        channel: run.channel ?? 'api',
      });
      if (!claimed) {
        logger.warn({ runId }, 'Run already claimed by another worker — skipping');
        return;
      }
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

        const conversationId =
          ((run.inputSnapshot as Record<string, unknown>)?.conversationId ?? run.conversationId) as string | undefined;
        if (typeof conversationId === 'string') {
          await convService.saveAssistantReply(
            conversationId,
            run.organizationId,
            result.output.summary ?? 'Run completed.',
            runId,
            (run.channel as 'chat' | 'voice') ?? 'chat',
          );
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

        // ── Phase 11.1: Record AI usage after successful run ──────────────
        await recordUsageAfterRun(run.organizationId, runId, result.tokensIn, result.tokensOut, result.costUsd, true);

        logger.info(
          { runId, tokensIn: result.tokensIn, tokensOut: result.tokensOut, costUsd: result.costUsd },
          'Run succeeded',
        );

      } catch (err: unknown) {
        if (err instanceof RunCancelledError) {
          logger.info({ runId }, 'Agent run was cancelled cooperatively — halted execution');
          return;
        }

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
  await flushLangfuse();
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
  if (err instanceof AiUsageLimitExceededError) return `AI usage limit exceeded: ${err.message}`;
  if (err instanceof NoActiveSubscriptionError) return `No active subscription: ${err.message}`;
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
    err instanceof GuardrailBlockedError    ||
    err instanceof AiUsageLimitExceededError ||
    err instanceof NoActiveSubscriptionError
  );
}


// ── Phase 11.1: AI Usage Recording Helper ─────────────────────────────────────

/**
 * Records AI usage after a run completes (success or failure).
 * Non-fatal: errors are logged but do not fail the run.
 * Q2 Decision: Track usage separately for trial subscriptions.
 * Phase 5: Triggers usage threshold notifications after recording.
 */
async function recordUsageAfterRun(
  organizationId: string,
  runId: string,
  tokensIn: number,
  tokensOut: number,
  costUsd: string,
  isSuccess: boolean,
): Promise<void> {
  try {
    const usageService = new AiUsageService(
      new AiUsageRepository(),
      new EntitlementService(),
    );

    await usageService.recordRunUsage({
      organizationId,
      runId,
      tokensIn,
      tokensOut,
      costUsd,
      usageDate: new Date(),
      isSuccess,
    });

    logger.debug(
      {
        organizationId,
        runId,
        tokensIn,
        tokensOut,
        isSuccess,
      },
      'AI usage recorded successfully',
    );

    // Phase 5: Check usage thresholds and send notifications if needed
    // Fire-and-forget: don't block run completion
    void checkUsageNotifications(organizationId).catch((err) => {
      logger.warn({ organizationId, err }, 'Failed to check usage notifications (non-fatal)');
    });
  } catch (err) {
    // Non-fatal: log error but don't fail the run
    logger.error(
      {
        organizationId,
        runId,
        err,
      },
      'Failed to record AI usage (non-fatal)',
    );
  }
}

/**
 * Phase 5: Check usage notifications and trigger emails/webhooks if thresholds crossed
 * Called after each run completes to check if organization crossed 80%, 90%, or 100% thresholds
 */
async function checkUsageNotifications(organizationId: string): Promise<void> {
  try {
    // TODO: Get organization name from organization table
    const organizationName = 'Organization'; // Placeholder

    const { AiUsageNotificationsService } = await import('../usage/ai-usage-notifications.service.js');
    const { EmailService } = await import('../../../lib/email/email.service.js');
    
    const notificationsService = new AiUsageNotificationsService(
      new AiUsageService(new AiUsageRepository(), new EntitlementService()),
      new AiUsageRepository(),
      new EmailService(),
      logger,
    );

    await notificationsService.checkAndNotify(organizationId, organizationName);
  } catch (err) {
    // Non-fatal: notification failures should not break the run
    logger.warn({ organizationId, err }, 'Failed to check usage notifications');
  }
}
