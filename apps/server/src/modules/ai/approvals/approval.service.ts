// apps/server/src/modules/ai/approvals/approval.service.ts
import { trace } from '@opentelemetry/api';
import { withSpan } from '@siteflow/observability/server';
import { sendJob } from '../../../lib/queue/queue.js';
import { ApprovalRepository } from './approval.repository.js';
import { AgentRunRepository } from '../runs/agent-run.repository.js';
import { AI_QUEUES } from '../ai.jobs.js';
import { ApprovalRejectedError } from '../core/errors.js';
import type { AgentApproval } from '@siteflow/database/schema';

const tracer = trace.getTracer('ai-approval-service');

export interface CreateApprovalInput {
  runId: string;
  organizationId: string;
  proposalType: string;
  proposal: Record<string, unknown>;
  expiresInMs?: number;
}

export class ApprovalService {
  constructor(
    private approvalRepo = new ApprovalRepository(),
    private runRepo = new AgentRunRepository(),
  ) {}

  async createApproval(input: CreateApprovalInput): Promise<AgentApproval> {
    return withSpan(tracer, 'ai.approval.create', async () => {
      const expiresAt = new Date(Date.now() + (input.expiresInMs ?? 3600000)); // 1 hour default

      return this.approvalRepo.create({
        runId: input.runId,
        organizationId: input.organizationId,
        proposalType: input.proposalType,
        proposal: input.proposal,
        status: 'PENDING',
        expiresAt,
      });
    });
  }

  async getApproval(id: string, organizationId: string): Promise<AgentApproval | undefined> {
    return this.approvalRepo.findById(id, organizationId);
  }

  async getPendingForRun(runId: string): Promise<AgentApproval | undefined> {
    return this.approvalRepo.findPendingForRun(runId);
  }

  async approve(id: string, organizationId: string, userId: string, note?: string): Promise<void> {
    return withSpan(tracer, 'ai.approval.approve', async (span) => {
      span.setAttribute('approval.id', id);

      const approval = await this.approvalRepo.findById(id, organizationId);
      if (!approval) throw new Error(`Approval ${id} not found`);
      if (approval.status !== 'PENDING') {
        throw new Error(`Approval ${id} is ${approval.status}, cannot approve`);
      }

      await this.approvalRepo.approve(id, userId, note);

      // Resume the run by re-enqueueing the same runId
      // Worker will detect the APPROVED approval and call resumeRun()
      await sendJob(
        AI_QUEUES.AGENT_RUN,
        {
          runId: approval.runId,
          organizationId: approval.organizationId,
          projectId: undefined, // worker fetches from DB
          agent: 'cost-financial', // worker fetches from DB
          createdBy: userId,
        },
        { retryLimit: 0, expireInSeconds: 300 },
      );
    });
  }

  async reject(id: string, organizationId: string, userId: string, note?: string): Promise<void> {
    return withSpan(tracer, 'ai.approval.reject', async () => {
      const approval = await this.approvalRepo.findById(id, organizationId);
      if (!approval) throw new Error(`Approval ${id} not found`);
      if (approval.status !== 'PENDING') {
        throw new Error(`Approval ${id} is ${approval.status}, cannot reject`);
      }

      await this.approvalRepo.reject(id, userId, note);
      await this.runRepo.setFailed(approval.runId, `Approval rejected: ${note ?? 'no reason'}`);
    });
  }
}
