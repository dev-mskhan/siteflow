import { and, eq } from 'drizzle-orm';
import {
  permits,
  projectMembers,
  subcontractors,
} from '@siteflow/database/schema';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { auditService } from '../../audit/audit.service.js';
import { linkDocument } from '../documents/document.service.js';
import {
  ComplianceInvalidStateError,
  ComplianceOwnershipError,
  ComplianceResourceNotFoundError,
} from './compliance.errors.js';
import {
  ComplianceRepository,
  type ComplianceEntityType,
} from './compliance.repository.js';

export interface ComplianceScope {
  organizationId: string;
  projectId: string;
}

type Input = Record<string, unknown>;

const permitTransitions: Record<string, string[]> = {
  PENDING: ['APPLIED', 'CANCELLED'],
  APPLIED: ['ISSUED', 'REVOKED', 'CANCELLED'],
  ISSUED: ['ACTIVE', 'REVOKED', 'CANCELLED'],
  ACTIVE: ['REVOKED', 'CANCELLED'],
  EXPIRED: ['REVOKED', 'CANCELLED'],
  REVOKED: [],
  CANCELLED: [],
};

function encodeCursor(row: { createdAt: Date; id: string }): string {
  return Buffer.from(JSON.stringify({
    createdAt: row.createdAt.toISOString(),
    id: row.id,
  })).toString('base64url');
}

export class ComplianceService {
  constructor(private readonly repo = new ComplianceRepository()) {}

  private get db() {
    return getDb();
  }

  private async validateReferences(
    tx: any,
    entity: ComplianceEntityType,
    scope: ComplianceScope,
    input: Input,
  ): Promise<void> {
    const responsibleMemberId = input['responsibleMemberId'];
    if (typeof responsibleMemberId === 'string') {
      const [member] = await tx.select({ id: projectMembers.id })
        .from(projectMembers)
        .where(and(
          eq(projectMembers.id, responsibleMemberId),
          eq(projectMembers.organizationId, scope.organizationId),
          eq(projectMembers.projectId, scope.projectId),
          eq(projectMembers.status, 'ACTIVE'),
        ))
        .limit(1);
      if (!member) throw new ComplianceOwnershipError();
    }

    if (entity === 'inspection' && typeof input['permitId'] === 'string') {
      const [permit] = await tx.select({ id: permits.id })
        .from(permits)
        .where(and(
          eq(permits.id, input['permitId']),
          eq(permits.organizationId, scope.organizationId),
          eq(permits.projectId, scope.projectId),
        ))
        .limit(1);
      if (!permit) throw new ComplianceOwnershipError();
    }

    if (entity === 'record' && input['subjectType'] === 'SUBCONTRACTOR') {
      if (typeof input['subjectId'] !== 'string') throw new ComplianceOwnershipError();
      const [subcontractor] = await tx.select({ id: subcontractors.id })
        .from(subcontractors)
        .where(and(
          eq(subcontractors.id, input['subjectId']),
          eq(subcontractors.organizationId, scope.organizationId),
        ))
        .limit(1);
      if (!subcontractor) throw new ComplianceOwnershipError();
    }
  }

  async create(
    actorUserId: string,
    scope: ComplianceScope,
    entity: ComplianceEntityType,
    input: Input,
  ): Promise<any> {
    return this.db.transaction(async (tx) => {
      await this.validateReferences(tx, entity, scope, input);
      const row = await this.repo.create(tx, entity, {
        id: generateId(),
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        ...input,
        createdBy: actorUserId,
      });
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: `project.${entity}.created`,
        resourceType: entity,
        resourceId: row.id,
        metadata: { projectId: scope.projectId },
      }, tx);
      return row;
    });
  }

  async list(
    scope: ComplianceScope,
    entity: ComplianceEntityType,
    options: { cursor?: string; limit: number; status?: string },
  ): Promise<{ data: any[]; nextCursor: string | null }> {
    const rows = await this.repo.list(this.db, entity, scope.organizationId, scope.projectId, options);
    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;
    return {
      data,
      nextCursor: hasMore && data.length > 0
        ? encodeCursor(data[data.length - 1]!)
        : null,
    };
  }

  async get(scope: ComplianceScope, entity: ComplianceEntityType, id: string): Promise<any> {
    const row = await this.repo.findById(
      this.db,
      entity,
      scope.organizationId,
      scope.projectId,
      id,
    );
    if (!row) throw new ComplianceResourceNotFoundError();
    return row;
  }

  async update(
    actorUserId: string,
    scope: ComplianceScope,
    entity: ComplianceEntityType,
    id: string,
    input: Input,
  ): Promise<any> {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(
        tx,
        entity,
        scope.organizationId,
        scope.projectId,
        id,
      );
      if (!row) throw new ComplianceResourceNotFoundError();
      if (row.status === 'CANCELLED' || row.status === 'REVOKED' || row.status === 'COMPLETED') {
        throw new ComplianceInvalidStateError(row.status, 'UPDATED');
      }
      if (entity === 'record' && input['status'] === 'ACTIVE'
        && row.status !== 'PENDING' && row.status !== 'ACTIVE') {
        throw new ComplianceInvalidStateError(row.status, 'ACTIVE');
      }
      await this.validateReferences(tx, entity, scope, input);
      const patch = { ...input };
      if (
        entity !== 'inspection'
        && input['expiryDate'] !== undefined
        && input['expiryDate'] !== row.expiryDate
      ) {
        patch['expiresNotified'] = false;
      }
      const updated = await this.repo.update(
        tx,
        entity,
        scope.organizationId,
        scope.projectId,
        id,
        patch,
      );
      if (!updated) throw new ComplianceResourceNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: `project.${entity}.updated`,
        resourceType: entity,
        resourceId: id,
        metadata: { projectId: scope.projectId, ...(input['status'] ? { status: input['status'] } : {}) },
      }, tx);
      if (entity === 'record' && input['status'] === 'ACTIVE' && row.status !== 'ACTIVE') {
        await writeOutboxEvent(tx, 'compliance_record.activated', {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          complianceRecordId: id,
        }, scope.organizationId);
      }
      return updated;
    });
  }

  async remove(
    actorUserId: string,
    scope: ComplianceScope,
    entity: ComplianceEntityType,
    id: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(
        tx,
        entity,
        scope.organizationId,
        scope.projectId,
        id,
      );
      if (!row) throw new ComplianceResourceNotFoundError();
      if (row.status === 'CANCELLED') return;
      if (row.status === 'REVOKED' || row.status === 'COMPLETED') {
        throw new ComplianceInvalidStateError(row.status, 'CANCELLED');
      }
      const updated = await this.repo.update(
        tx,
        entity,
        scope.organizationId,
        scope.projectId,
        id,
        { status: 'CANCELLED' },
      );
      if (!updated) throw new ComplianceResourceNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: `project.${entity}.cancelled`,
        resourceType: entity,
        resourceId: id,
        metadata: { projectId: scope.projectId },
      }, tx);
      await writeOutboxEvent(
        tx,
        `${entity}.cancelled`,
        { organizationId: scope.organizationId, projectId: scope.projectId, [`${entity}Id`]: id },
        scope.organizationId,
      );
    });
  }

  async transitionPermit(
    actorUserId: string,
    scope: ComplianceScope,
    permitId: string,
    targetStatus: string,
  ): Promise<any> {
    return this.db.transaction(async (tx) => {
      const permit = await this.repo.findByIdForUpdate(
        tx,
        'permit',
        scope.organizationId,
        scope.projectId,
        permitId,
      );
      if (!permit) throw new ComplianceResourceNotFoundError();
      if (permit.status === targetStatus) return permit;
      if (!permitTransitions[permit.status]?.includes(targetStatus)) {
        throw new ComplianceInvalidStateError(permit.status, targetStatus);
      }
      const updated = await this.repo.update(
        tx,
        'permit',
        scope.organizationId,
        scope.projectId,
        permitId,
        { status: targetStatus },
      );
      if (!updated) throw new ComplianceResourceNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'permit.status_changed',
        resourceType: 'permit',
        resourceId: permitId,
        metadata: { projectId: scope.projectId, fromStatus: permit.status, toStatus: targetStatus },
      }, tx);
      await writeOutboxEvent(tx, 'permit.status_changed', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        permitId,
        status: targetStatus,
      }, scope.organizationId);
      return updated;
    });
  }

  async completeInspection(
    actorUserId: string,
    scope: ComplianceScope,
    inspectionId: string,
    input: { result: string; findings?: string | null; performedDate: string },
  ): Promise<any> {
    return this.db.transaction(async (tx) => {
      const inspection = await this.repo.findByIdForUpdate(
        tx,
        'inspection',
        scope.organizationId,
        scope.projectId,
        inspectionId,
      );
      if (!inspection) throw new ComplianceResourceNotFoundError();
      if (inspection.status === 'COMPLETED') return inspection;
      if (!['SCHEDULED', 'IN_PROGRESS'].includes(inspection.status)) {
        throw new ComplianceInvalidStateError(inspection.status, 'COMPLETED');
      }
      const updated = await this.repo.update(
        tx,
        'inspection',
        scope.organizationId,
        scope.projectId,
        inspectionId,
        { ...input, status: 'COMPLETED' },
      );
      if (!updated) throw new ComplianceResourceNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'compliance_inspection.completed',
        resourceType: 'compliance_inspection',
        resourceId: inspectionId,
        metadata: { projectId: scope.projectId, result: input.result },
      }, tx);
      await writeOutboxEvent(tx, 'compliance_inspection.completed', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        inspectionId,
        result: input.result,
      }, scope.organizationId);
      return updated;
    });
  }

  async verifyRecord(
    actorUserId: string,
    scope: ComplianceScope,
    recordId: string,
    verificationRef?: string,
  ): Promise<any> {
    return this.db.transaction(async (tx) => {
      const record = await this.repo.findByIdForUpdate(
        tx,
        'record',
        scope.organizationId,
        scope.projectId,
        recordId,
      );
      if (!record) throw new ComplianceResourceNotFoundError();
      if (record.status === 'VERIFIED') return record;
      if (record.status !== 'ACTIVE') {
        throw new ComplianceInvalidStateError(record.status, 'VERIFIED');
      }
      const updated = await this.repo.update(
        tx,
        'record',
        scope.organizationId,
        scope.projectId,
        recordId,
        { status: 'VERIFIED', verificationRef: verificationRef ?? record.verificationRef },
      );
      if (!updated) throw new ComplianceResourceNotFoundError();
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'compliance_record.verified',
        resourceType: 'compliance_record',
        resourceId: recordId,
        metadata: { projectId: scope.projectId },
      }, tx);
      await writeOutboxEvent(tx, 'compliance_record.verified', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        complianceRecordId: recordId,
      }, scope.organizationId);
      return updated;
    });
  }

  async attachDocument(
    actorUserId: string,
    scope: ComplianceScope,
    entity: ComplianceEntityType,
    entityId: string,
    documentId: string,
  ): Promise<void> {
    await this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(
        tx,
        entity,
        scope.organizationId,
        scope.projectId,
        entityId,
      );
      if (!row) throw new ComplianceResourceNotFoundError();
      await linkDocument(tx, {
        orgId: scope.organizationId,
        projectId: scope.projectId,
        docId: documentId,
        entityType: entity === 'inspection' ? 'inspection' : entity === 'record' ? 'compliance_record' : 'permit',
        entityId,
        createdBy: actorUserId,
      });
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: `project.${entity}.document_attached`,
        resourceType: entity,
        resourceId: entityId,
        metadata: { projectId: scope.projectId, documentId },
      }, tx);
    });
  }
}

export const complianceService = new ComplianceService();
