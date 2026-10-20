import { trace } from '@opentelemetry/api';
import { withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { ApprovalRepository } from './approval.repository.js';
import { AgentRunRepository } from '../runs/agent-run.repository.js';
import { AI_QUEUES } from '../ai.jobs.js';
import type { AgentApproval } from '@siteflow/database/schema';
import type { AgentName } from '../core/types.js';

const tracer = trace.getTracer('ai-approval-service');

export interface CreateApprovalInput {
  runId: string;
  organizationId: string;
  proposalType: string;
  proposal: Record<string, unknown>;
  expiresInMs?: number;
  approvedToolName?: string;
  approvedArgsHash?: string;
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
        approvedToolName: input.approvedToolName ?? null,
        approvedArgsHash: input.approvedArgsHash ?? null,
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

      await getDb().transaction(async (tx) => {
        await this.approvalRepo.approve(id, userId, note, tx);

        // Load the run to get its actual agent name and projectId.
        // ARC-03: previously hardcoded agent: 'cost-financial' and projectId: undefined,
        // which would route the resume to the wrong agent for any other agent type.
        const run = await this.runRepo.findByIdInternal(approval.runId);
        if (!run) throw new Error(`Agent run ${approval.runId} not found — cannot resume`);

        // Resume the run atomically by enqueuing the runId via transactional outbox
        // Worker will detect the APPROVED approval and call resumeRun()
        await writeOutboxEvent(
          tx,
          AI_QUEUES.AGENT_RUN,
          {
            runId: approval.runId,
            organizationId: approval.organizationId,
            projectId: run.projectId ?? undefined,
            agent: run.agent as AgentName,
            createdBy: userId,
          },
          approval.organizationId,
        );
      });
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
