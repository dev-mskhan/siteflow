// apps/server/src/modules/project/issue/issue.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { IssueRepository } from './issue.repository.js';
import { IssueNotFoundError, IssueInvalidTransitionError } from './issue.errors.js';
import type { IssueDTO, CreateIssueInput, UpdateIssueInput, IssueStatus } from './issue.types.js';
import type { Issue } from '@siteflow/database/schema';

const tracer = trace.getTracer('issue-service');

// Valid status transitions
const VALID_TRANSITIONS: Record<IssueStatus, IssueStatus[]> = {
  OPEN: ['IN_PROGRESS', 'CLOSED'],
  IN_PROGRESS: ['RESOLVED', 'OPEN'],
  RESOLVED: ['CLOSED', 'OPEN'],
  CLOSED: [],
};

function toIssueDTO(issue: Issue): IssueDTO {
  return {
    id: issue.id,
    organizationId: issue.organizationId,
    projectId: issue.projectId,
    title: issue.title,
    description: issue.description ?? null,
    status: issue.status as IssueStatus,
    reportedImpactDays: issue.reportedImpactDays,
    approvedImpactDays: issue.approvedImpactDays,
    assignedTo: issue.assignedTo ?? null,
    createdAt: issue.createdAt.toISOString(),
  };
}

export class IssueService {
  constructor(private repo = new IssueRepository()) {}

  private get db() {
    return getDb();
  }

  async createIssue(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreateIssueInput,
  ): Promise<IssueDTO> {
    return withSpan(tracer, 'issue.create', async (span) => {
      span.setAttributes({ organizationId, projectId });

      return this.db.transaction(async (tx) => {
        const id = generateId();
        const issue = await this.repo.create(tx as any, {
          id,
          organizationId,
          projectId,
          title: input.title,
          description: input.description,
          reportedImpactDays: input.reportedImpactDays ?? 0,
          assignedTo: input.assignedTo,
        });

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'issue.created',
            resourceType: 'issue',
            resourceId: id,
            metadata: { projectId, title: input.title, reportedImpactDays: input.reportedImpactDays ?? 0 },
          },
          tx,
        );

        return toIssueDTO(issue);
      });
    });
  }

  async getIssue(organizationId: string, projectId: string, issueId: string): Promise<IssueDTO> {
    return withSpan(tracer, 'issue.get', async (span) => {
      span.setAttributes({ organizationId, projectId, issueId });

      const issue = await this.repo.findById(this.db, issueId);
      if (!issue || issue.organizationId !== organizationId || issue.projectId !== projectId) {
        throw new IssueNotFoundError(issueId);
      }
      return toIssueDTO(issue);
    });
  }

  async listIssues(organizationId: string, projectId: string): Promise<IssueDTO[]> {
    return withSpan(tracer, 'issue.list', async (span) => {
      span.setAttributes({ organizationId, projectId });

      const rows = await this.repo.listByProject(this.db, organizationId, projectId);
      return rows.map(toIssueDTO);
    });
  }

  async updateIssue(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    issueId: string,
    input: UpdateIssueInput,
  ): Promise<IssueDTO> {
    return withSpan(tracer, 'issue.update', async (span) => {
      span.setAttributes({ organizationId, projectId, issueId });

      return this.db.transaction(async (tx) => {
        const issue = await this.repo.findById(tx as any, issueId);
        if (!issue || issue.organizationId !== organizationId || issue.projectId !== projectId) {
          throw new IssueNotFoundError(issueId);
        }

        const updated = await this.repo.update(tx as any, issueId, {
          title: input.title,
          description: input.description,
          reportedImpactDays: input.reportedImpactDays,
          approvedImpactDays: input.approvedImpactDays,
          assignedTo: input.assignedTo,
        });

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'issue.updated',
            resourceType: 'issue',
            resourceId: issueId,
            metadata: { projectId },
          },
          tx,
        );

        return toIssueDTO(updated);
      });
    });
  }

  async transitionIssue(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    issueId: string,
    targetStatus: IssueStatus,
  ): Promise<IssueDTO> {
    return withSpan(tracer, 'issue.transition', async (span) => {
      span.setAttributes({ organizationId, projectId, issueId, targetStatus });

      return this.db.transaction(async (tx) => {
        const issue = await this.repo.findById(tx as any, issueId);
        if (!issue || issue.organizationId !== organizationId || issue.projectId !== projectId) {
          throw new IssueNotFoundError(issueId);
        }

        const currentStatus = issue.status as IssueStatus;
        const allowed = VALID_TRANSITIONS[currentStatus] ?? [];
        if (!allowed.includes(targetStatus)) {
          throw new IssueInvalidTransitionError(currentStatus, targetStatus);
        }

        const updated = await this.repo.update(tx as any, issueId, { status: targetStatus });

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'issue.transitioned',
            resourceType: 'issue',
            resourceId: issueId,
            metadata: { projectId, from: currentStatus, to: targetStatus },
          },
          tx,
        );

        return toIssueDTO(updated);
      });
    });
  }
}
