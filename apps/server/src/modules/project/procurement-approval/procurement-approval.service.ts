import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { sql } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { ProcurementApprovalRepository } from './procurement-approval.repository.js';
import {
  ProcurementApprovalNotFoundError,
  ProcurementApprovalInvalidStateError,
  ProcurementApprovalDuplicatePendingError,
  ProcurementApprovalResourceOwnershipError,
} from './procurement-approval.errors.js';
import type {
  ProcurementApprovalDTO,
  CreateApprovalInput,
  ReviewApprovalInput,
  ListApprovalsQuery,
} from './procurement-approval.types.js';
import type { ProcurementApproval } from '@siteflow/database/schema';

const tracer = trace.getTracer('procurement-approval-service');

function toDTO(row: ProcurementApproval): ProcurementApprovalDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    resourceType: row.resourceType as any,
    resourceId: row.resourceId,
    status: row.status as any,
    requestedBy: row.requestedBy,
    requestedAt: row.requestedAt.toISOString(),
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    decisionReason: row.decisionReason ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class ProcurementApprovalService {
  constructor(private repo = new ProcurementApprovalRepository()) {}

  private get db() {
    return getDb();
  }

  private async validateResourceOwnership(
    tx: any,
    resourceType: string,
    resourceId: string,
    organizationId: string,
    projectId: string,
  ): Promise<void> {
    let resource: any;
    if (resourceType === 'MATERIAL_REQUEST') {
      resource = await this.repo.loadMaterialRequest(tx, resourceId);
    } else if (resourceType === 'QUOTE') {
      resource = await this.repo.loadQuote(tx, resourceId);
    } else if (resourceType === 'PURCHASE_ORDER') {
      const rows = await tx.execute(
        sql`SELECT id, organization_id, project_id FROM app.purchase_orders WHERE id = ${resourceId}`,
      );
      const raw = (rows.rows ?? rows)[0];
      if (raw) {
        resource = {
          organizationId: raw.organization_id,
          projectId: raw.project_id,
        };
      }
    }
    if (
      !resource ||
      resource.organizationId !== organizationId ||
      resource.projectId !== projectId
    ) {
      throw new ProcurementApprovalResourceOwnershipError();
    }
  }

  private async lockResource(tx: any, resourceType: string, resourceId: string): Promise<void> {
    if (resourceType === 'MATERIAL_REQUEST') {
      await tx.execute(
        sql`SELECT id FROM app.material_requests WHERE id = ${resourceId} FOR UPDATE`,
      );
    } else if (resourceType === 'QUOTE') {
      await tx.execute(sql`SELECT id FROM app.quotes WHERE id = ${resourceId} FOR UPDATE`);
    } else if (resourceType === 'PURCHASE_ORDER') {
      await tx.execute(
        sql`SELECT id FROM app.purchase_orders WHERE id = ${resourceId} FOR UPDATE`,
      );
    }
  }

  private async transitionResource(
    tx: any,
    resourceType: string,
    resourceId: string,
    newStatus: string,
  ): Promise<void> {
    if (resourceType === 'MATERIAL_REQUEST') {
      if (newStatus === 'APPROVED') {
        await tx.execute(
          sql`UPDATE app.material_requests SET status = 'APPROVED', approved_at = now(), updated_at = now() WHERE id = ${resourceId}`,
        );
      } else if (newStatus === 'REJECTED') {
        await tx.execute(
          sql`UPDATE app.material_requests SET status = 'REJECTED', updated_at = now() WHERE id = ${resourceId}`,
        );
      }
    } else if (resourceType === 'QUOTE') {
      if (newStatus === 'APPROVED') {
        await tx.execute(
          sql`UPDATE app.quotes SET status = 'ACCEPTED', accepted_at = now(), updated_at = now() WHERE id = ${resourceId}`,
        );
      } else if (newStatus === 'REJECTED') {
        await tx.execute(
          sql`UPDATE app.quotes SET status = 'REJECTED', rejected_at = now(), updated_at = now() WHERE id = ${resourceId}`,
        );
      }
    } else if (resourceType === 'PURCHASE_ORDER') {
      if (newStatus === 'APPROVED') {
        await tx.execute(
          sql`UPDATE app.purchase_orders SET status = 'APPROVED', approved_at = now(), updated_at = now() WHERE id = ${resourceId}`,
        );
      } else if (newStatus === 'REJECTED') {
        await tx.execute(
          sql`UPDATE app.purchase_orders SET status = 'DRAFT', updated_at = now() WHERE id = ${resourceId}`,
        );
      }
    }
  }

  async createApproval(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: CreateApprovalInput,
  ): Promise<ProcurementApprovalDTO> {
    return withSpan(tracer, 'procurement-approval.create', async (span) => {
      span.setAttributes({ organizationId, projectId });
      return this.db.transaction(async (tx) => {
        await this.validateResourceOwnership(
          tx,
          input.resourceType,
          input.resourceId,
          organizationId,
          projectId,
        );
        const existing = await this.repo.findPendingForResource(
          tx as any,
          input.resourceType,
          input.resourceId,
        );
        if (existing) throw new ProcurementApprovalDuplicatePendingError();

        const id = generateId();
        const row = await this.repo.create(tx as any, {
          id,
          organizationId,
          projectId,
          resourceType: input.resourceType,
          resourceId: input.resourceId,
          requestedBy: actorUserId,
          requestedAt: new Date(),
        });
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'procurement_approval.created',
            resourceType: 'ProcurementApproval',
            resourceId: id,
            metadata: {
              projectId,
              resourceType: input.resourceType,
              resourceId: input.resourceId,
            },
          },
          tx,
        );
        return toDTO(row);
      });
    });
  }

  async getApproval(
    organizationId: string,
    projectId: string,
    approvalId: string,
  ): Promise<ProcurementApprovalDTO> {
    return withSpan(tracer, 'procurement-approval.get', async (span) => {
      span.setAttributes({ organizationId, projectId, approvalId });
      const row = await this.repo.findById(this.db, approvalId);
      if (
        !row ||
        row.organizationId !== organizationId ||
        row.projectId !== projectId
      ) {
        throw new ProcurementApprovalNotFoundError(approvalId);
      }
      return toDTO(row);
    });
  }

  async listApprovals(
    organizationId: string,
    projectId: string,
    query: ListApprovalsQuery,
  ): Promise<{ data: ProcurementApprovalDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'procurement-approval.list', async (span) => {
      span.setAttributes({ organizationId, projectId });
      const limit = query.limit ?? 50;
      const rows = await this.repo.listByProject(this.db, organizationId, projectId, {
        cursor: query.cursor,
        limit: limit + 1,
        status: query.status,
      });
      const hasMore = rows.length > limit;
      const data = hasMore ? rows.slice(0, limit) : rows;
      let nextCursor: string | null = null;
      if (hasMore && data.length > 0) {
        const last = data[data.length - 1]!;
        nextCursor = Buffer.from(
          JSON.stringify({ createdAt: last.createdAt.toISOString(), id: last.id }),
        ).toString('base64');
      }
      return { data: data.map(toDTO), nextCursor };
    });
  }

  async approveApproval(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    approvalId: string,
    input: ReviewApprovalInput,
  ): Promise<ProcurementApprovalDTO> {
    return withSpan(tracer, 'procurement-approval.approve', async (span) => {
      span.setAttributes({ organizationId, projectId, approvalId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findById(tx as any, approvalId);
        if (
          !row ||
          row.organizationId !== organizationId ||
          row.projectId !== projectId
        ) {
          throw new ProcurementApprovalNotFoundError(approvalId);
        }
        // Idempotency
        if (row.status === 'APPROVED') return toDTO(row);
        if (row.status !== 'PENDING') {
          throw new ProcurementApprovalInvalidStateError(row.status, 'approve');
        }
        await this.lockResource(tx, row.resourceType, row.resourceId);
        await this.validateResourceOwnership(
          tx,
          row.resourceType,
          row.resourceId,
          organizationId,
          projectId,
        );
        await this.transitionResource(tx, row.resourceType, row.resourceId, 'APPROVED');
        const updated = await this.repo.update(tx as any, approvalId, {
          status: 'APPROVED',
          reviewedBy: actorUserId,
          reviewedAt: new Date(),
          decisionReason: input.decisionReason ?? null,
        });
        await writeOutboxEvent(
          tx,
          'procurement.approval.approved',
          {
            organizationId,
            projectId,
            approvalId,
            resourceType: row.resourceType,
            resourceId: row.resourceId,
          },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'procurement_approval.approved',
            resourceType: 'ProcurementApproval',
            resourceId: approvalId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated);
      });
    });
  }

  async rejectApproval(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    approvalId: string,
    input: ReviewApprovalInput,
  ): Promise<ProcurementApprovalDTO> {
    return withSpan(tracer, 'procurement-approval.reject', async (span) => {
      span.setAttributes({ organizationId, projectId, approvalId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findById(tx as any, approvalId);
        if (
          !row ||
          row.organizationId !== organizationId ||
          row.projectId !== projectId
        ) {
          throw new ProcurementApprovalNotFoundError(approvalId);
        }
        if (row.status !== 'PENDING') {
          throw new ProcurementApprovalInvalidStateError(row.status, 'reject');
        }
        await this.lockResource(tx, row.resourceType, row.resourceId);
        await this.validateResourceOwnership(
          tx,
          row.resourceType,
          row.resourceId,
          organizationId,
          projectId,
        );
        await this.transitionResource(tx, row.resourceType, row.resourceId, 'REJECTED');
        const updated = await this.repo.update(tx as any, approvalId, {
          status: 'REJECTED',
          reviewedBy: actorUserId,
          reviewedAt: new Date(),
          decisionReason: input.decisionReason ?? null,
        });
        await writeOutboxEvent(
          tx,
          'procurement.approval.rejected',
          {
            organizationId,
            projectId,
            approvalId,
            resourceType: row.resourceType,
            resourceId: row.resourceId,
          },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'procurement_approval.rejected',
            resourceType: 'ProcurementApproval',
            resourceId: approvalId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated);
      });
    });
  }

  async cancelApproval(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    approvalId: string,
  ): Promise<ProcurementApprovalDTO> {
    return withSpan(tracer, 'procurement-approval.cancel', async (span) => {
      span.setAttributes({ organizationId, projectId, approvalId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findById(tx as any, approvalId);
        if (
          !row ||
          row.organizationId !== organizationId ||
          row.projectId !== projectId
        ) {
          throw new ProcurementApprovalNotFoundError(approvalId);
        }
        if (row.status !== 'PENDING') {
          throw new ProcurementApprovalInvalidStateError(row.status, 'cancel');
        }
        const updated = await this.repo.update(tx as any, approvalId, {
          status: 'CANCELLED',
        });
        await writeOutboxEvent(
          tx,
          'procurement.approval.cancelled',
          { organizationId, projectId, approvalId },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'procurement_approval.cancelled',
            resourceType: 'ProcurementApproval',
            resourceId: approvalId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated);
      });
    });
  }
}
