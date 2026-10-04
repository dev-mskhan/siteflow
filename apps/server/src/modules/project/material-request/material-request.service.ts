import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { documentNumberService } from '../../procurement/document-number/document-number.service.js';
import { MaterialService } from '../../material/material.service.js';
import { MaterialRequestRepository } from './material-request.repository.js';
import {
  MaterialRequestNotFoundError,
  MaterialRequestInvalidStateError,
  MaterialRequestNoItemsError,
  MaterialRequestUnitMismatchError,
  MaterialRequestReferenceNotFoundError,
} from './material-request.errors.js';
import { tasks, projectPhases, projectCostCodes } from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';
import type {
  MaterialRequestDTO,
  MaterialRequestItemDTO,
  CreateMaterialRequestInput,
  UpdateMaterialRequestInput,
  ListMaterialRequestsQuery,
} from './material-request.types.js';
import type { MaterialRequest, MaterialRequestItem } from '@siteflow/database/schema';

const tracer = trace.getTracer('material-request-service');
const materialService = new MaterialService();

function toItemDTO(row: MaterialRequestItem): MaterialRequestItemDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    materialRequestId: row.materialRequestId,
    materialId: row.materialId,
    description: row.description ?? null,
    quantity: row.quantity,
    unitCode: row.unitCode,
    requiredByDate: row.requiredByDate ?? null,
    taskId: row.taskId ?? null,
    phaseId: row.phaseId ?? null,
    costCodeId: row.costCodeId ?? null,
    boqLineId: row.boqLineId ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDTO(row: MaterialRequest, items: MaterialRequestItem[]): MaterialRequestDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    requestNumber: row.requestNumber,
    requestedByMemberId: row.requestedByMemberId ?? null,
    status: row.status as any,
    requiredByDate: row.requiredByDate ?? null,
    deliveryLocation: row.deliveryLocation ?? null,
    priority: row.priority as any,
    notes: row.notes ?? null,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    approvedAt: row.approvedAt?.toISOString() ?? null,
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    items: items.map(toItemDTO),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function currentYYYYMM(): string {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export class MaterialRequestService {
  constructor(private repo = new MaterialRequestRepository()) {}

  private get db() {
    return getDb();
  }

  async createMaterialRequest(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    requestedByMemberId: string | null,
    input: CreateMaterialRequestInput,
  ): Promise<MaterialRequestDTO> {
    return withSpan(tracer, 'material-request.create', async (span) => {
      span.setAttributes({ organizationId, projectId });
      return this.db.transaction(async (tx) => {
        // Allocate number
        const requestNumber = await documentNumberService.allocateDocumentNumber(
          tx,
          organizationId,
          projectId,
          'MR',
          currentYYYYMM(),
        );

        // Validate items
        const itemValues = [];
        for (const item of input.items) {
          const mat = await materialService.findActiveById(tx as any, organizationId, item.materialId);
          // Unit code must match material's defaultUnitCode
          if (item.unitCode.toUpperCase() !== mat.defaultUnitCode.toUpperCase()) {
            throw new MaterialRequestUnitMismatchError(
              item.materialId,
              mat.defaultUnitCode,
              item.unitCode,
            );
          }
          // Cross-entity ownership: optional task/phase/costCode must belong to same project
          if (item.taskId) {
            const rows = await (tx as any)
              .select()
              .from(tasks)
              .where(
                and(
                  eq(tasks.id, item.taskId),
                  eq(tasks.projectId, projectId),
                  eq(tasks.organizationId, organizationId),
                ),
              );
            if (!rows[0]) throw new MaterialRequestReferenceNotFoundError();
          }
          if (item.phaseId) {
            const rows = await (tx as any)
              .select()
              .from(projectPhases)
              .where(
                and(
                  eq(projectPhases.id, item.phaseId),
                  eq(projectPhases.projectId, projectId),
                ),
              );
            if (!rows[0]) throw new MaterialRequestReferenceNotFoundError();
          }
          if (item.costCodeId) {
            const rows = await (tx as any)
              .select()
              .from(projectCostCodes)
              .where(
                and(
                  eq(projectCostCodes.id, item.costCodeId),
                  eq(projectCostCodes.projectId, projectId),
                ),
              );
            if (!rows[0]) throw new MaterialRequestReferenceNotFoundError();
          }
          itemValues.push({
            id: generateId(),
            organizationId,
            materialRequestId: '', // set after header insert
            materialId: item.materialId,
            description: item.description ?? null,
            quantity: item.quantity,
            unitCode: item.unitCode.toUpperCase(),
            requiredByDate: item.requiredByDate ?? null,
            taskId: item.taskId ?? null,
            phaseId: item.phaseId ?? null,
            costCodeId: item.costCodeId ?? null,
            boqLineId: item.boqLineId ?? null,
            notes: item.notes ?? null,
          });
        }

        const id = generateId();
        const row = await this.repo.create(tx as any, {
          id,
          organizationId,
          projectId,
          requestNumber,
          requestedByMemberId: requestedByMemberId ?? null,
          requiredByDate: input.requiredByDate ?? null,
          deliveryLocation: input.deliveryLocation ?? null,
          priority: input.priority ?? 'NORMAL',
          notes: input.notes ?? null,
        });

        // Set materialRequestId on items and insert
        const itemsWithId = itemValues.map((i) => ({ ...i, materialRequestId: id }));
        const items = await this.repo.createItems(tx as any, itemsWithId);

        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'material_request.created',
            resourceType: 'MaterialRequest',
            resourceId: id,
            metadata: { projectId, requestNumber },
          },
          tx,
        );
        return toDTO(row, items);
      });
    });
  }

  async getMaterialRequest(
    organizationId: string,
    projectId: string,
    requestId: string,
  ): Promise<MaterialRequestDTO> {
    return withSpan(tracer, 'material-request.get', async (span) => {
      span.setAttributes({ organizationId, projectId, requestId });
      const row = await this.repo.findById(this.db, requestId);
      if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
        throw new MaterialRequestNotFoundError(requestId);
      }
      const items = await this.repo.findItemsByRequestId(this.db, requestId);
      return toDTO(row, items);
    });
  }

  async listMaterialRequests(
    organizationId: string,
    projectId: string,
    query: ListMaterialRequestsQuery,
  ): Promise<{ data: MaterialRequestDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'material-request.list', async (span) => {
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
      const allItems = await this.repo.findItemsByRequestIds(
        this.db,
        data.map((r) => r.id),
      );
      const itemsByRequestId = new Map<string, MaterialRequestItem[]>();
      for (const item of allItems) {
        const arr = itemsByRequestId.get(item.materialRequestId) ?? [];
        arr.push(item);
        itemsByRequestId.set(item.materialRequestId, arr);
      }
      const result = data.map((row) => toDTO(row, itemsByRequestId.get(row.id) ?? []));
      return { data: result, nextCursor };
    });
  }

  async updateMaterialRequest(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    requestId: string,
    input: UpdateMaterialRequestInput,
  ): Promise<MaterialRequestDTO> {
    return withSpan(tracer, 'material-request.update', async (span) => {
      span.setAttributes({ organizationId, projectId, requestId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findById(tx as any, requestId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new MaterialRequestNotFoundError(requestId);
        }
        if (row.status !== 'DRAFT') {
          throw new MaterialRequestInvalidStateError(row.status, 'update');
        }
        const updated = await this.repo.update(tx as any, requestId, input);
        const items = await this.repo.findItemsByRequestId(tx as any, requestId);
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'material_request.updated',
            resourceType: 'MaterialRequest',
            resourceId: requestId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }

  async submitMaterialRequest(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    requestId: string,
  ): Promise<MaterialRequestDTO> {
    return withSpan(tracer, 'material-request.submit', async (span) => {
      span.setAttributes({ organizationId, projectId, requestId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findByIdForUpdate(tx, requestId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new MaterialRequestNotFoundError(requestId);
        }
        if (row.status !== 'DRAFT') {
          throw new MaterialRequestInvalidStateError(row.status, 'submit');
        }
        const items = await this.repo.findItemsByRequestId(tx as any, requestId);
        if (!items.length) throw new MaterialRequestNoItemsError();
        const updated = await this.repo.update(tx as any, requestId, {
          status: 'SUBMITTED',
          submittedAt: new Date(),
        });
        await writeOutboxEvent(
          tx,
          'procurement.material_request.submitted',
          { organizationId, projectId, requestId, requestNumber: row.requestNumber },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'material_request.submitted',
            resourceType: 'MaterialRequest',
            resourceId: requestId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }

  async cancelMaterialRequest(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    requestId: string,
  ): Promise<MaterialRequestDTO> {
    return withSpan(tracer, 'material-request.cancel', async (span) => {
      span.setAttributes({ organizationId, projectId, requestId });
      return this.db.transaction(async (tx) => {
        const row = await this.repo.findByIdForUpdate(tx, requestId);
        if (!row || row.organizationId !== organizationId || row.projectId !== projectId) {
          throw new MaterialRequestNotFoundError(requestId);
        }
        const cancellableStatuses = ['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED'];
        if (!cancellableStatuses.includes(row.status)) {
          throw new MaterialRequestInvalidStateError(row.status, 'cancel');
        }
        // Idempotency: already cancelled
        if (row.status === 'CANCELLED') {
          const items = await this.repo.findItemsByRequestId(tx as any, requestId);
          return toDTO(row, items);
        }
        const updated = await this.repo.update(tx as any, requestId, {
          status: 'CANCELLED',
          cancelledAt: new Date(),
        });
        const items = await this.repo.findItemsByRequestId(tx as any, requestId);
        await writeOutboxEvent(
          tx,
          'procurement.material_request.cancelled',
          { organizationId, projectId, requestId },
          organizationId,
        );
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'material_request.cancelled',
            resourceType: 'MaterialRequest',
            resourceId: requestId,
            metadata: { projectId },
          },
          tx,
        );
        return toDTO(updated, items);
      });
    });
  }
}
