import { and, eq, ne } from 'drizzle-orm';
import { createLogger } from '@siteflow/observability/server';
import {
  projectMembers,
  correctiveActions,
  qualityDeficiencies,
  qualityInspections,
  safetyEvents,
} from '@siteflow/database/schema';
import type {
  CompleteQualityInspectionInput,
  CreateCorrectiveActionInput,
  CreateQualityDeficiencyInput,
  CreateQualityInspectionInput,
  ListCorrectiveActionsQuery,
  ListQualityDeficienciesQuery,
  ListQualityInspectionsQuery,
  UpdateCorrectiveActionInput,
  UpdateQualityDeficiencyInput,
  UpdateQualityInspectionInput,
  VerifyCorrectiveActionInput,
} from '@siteflow/shared';
import { getDb } from '../../../lib/db/index.js';
import { yyyymm } from '../../../lib/date.js';
import { generateId } from '../../../lib/id.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { auditService } from '../../audit/audit.service.js';
import { documentNumberService } from '../../procurement/document-number/document-number.service.js';
import { linkDocument } from '../documents/document.service.js';
import {
  QualityInvalidStateError,
  QualityOwnershipError,
  QualityResourceNotFoundError,
} from './quality.errors.js';
import {
  encodeQualityCursor,
  QualityRepository,
  type QualityEntityType,
  type QualityRow,
} from './quality.repository.js';
const logger = createLogger({ name: 'quality-service' });

export interface QualityScope {
  organizationId: string;
  projectId: string;
}

type CreateInput = CreateQualityInspectionInput | CreateQualityDeficiencyInput | CreateCorrectiveActionInput;
type UpdateInput = UpdateQualityInspectionInput | UpdateQualityDeficiencyInput | UpdateCorrectiveActionInput;
type QualityListOptions =
  | ListQualityInspectionsQuery
  | ListQualityDeficienciesQuery
  | ListCorrectiveActionsQuery;

export class QualityService {
  constructor(private readonly repo = new QualityRepository()) {}

  private get db() {
    return getDb();
  }

  private async validateReferences(
    tx: any,
    entity: QualityEntityType,
    scope: QualityScope,
    input: Record<string, unknown>,
  ): Promise<void> {
    const memberId = entity === 'inspection'
      ? input['inspectorMemberId']
      : entity === 'deficiency' ? input['responsibleMemberId'] : undefined;
    if (typeof memberId === 'string') {
      const [member] = await tx.select({ id: projectMembers.id }).from(projectMembers).where(and(
        eq(projectMembers.id, memberId),
        eq(projectMembers.organizationId, scope.organizationId),
        eq(projectMembers.projectId, scope.projectId),
        eq(projectMembers.status, 'ACTIVE'),
      )).limit(1);
      if (!member) throw new QualityOwnershipError();
    }

    if (entity === 'deficiency' && typeof input['inspectionId'] === 'string') {
      const [inspection] = await tx.select({ id: qualityInspections.id })
        .from(qualityInspections)
        .where(and(
          eq(qualityInspections.id, input['inspectionId']),
          eq(qualityInspections.organizationId, scope.organizationId),
          eq(qualityInspections.projectId, scope.projectId),
        )).limit(1);
      if (!inspection) throw new QualityOwnershipError();
    }

    if (entity === 'action' && input['sourceType'] === 'QUALITY_DEFICIENCY') {
      if (typeof input['sourceId'] !== 'string') throw new QualityOwnershipError();
      const [deficiency] = await tx.select({ id: qualityDeficiencies.id })
        .from(qualityDeficiencies).where(and(
          eq(qualityDeficiencies.id, input['sourceId']),
          eq(qualityDeficiencies.organizationId, scope.organizationId),
          eq(qualityDeficiencies.projectId, scope.projectId),
        )).limit(1);
      if (!deficiency) throw new QualityOwnershipError();
    }

    if (entity === 'action' && typeof input['assignedTo'] === 'string') {
      const [member] = await tx.select({ id: projectMembers.id }).from(projectMembers).where(and(
        eq(projectMembers.userId, input['assignedTo']),
        eq(projectMembers.organizationId, scope.organizationId),
        eq(projectMembers.projectId, scope.projectId),
        eq(projectMembers.status, 'ACTIVE'),
      )).limit(1);
      if (!member) throw new QualityOwnershipError();
    }
  }

  private async createResource(
    actorUserId: string,
    scope: QualityScope,
    entity: QualityEntityType,
    input: CreateInput,
    afterCreate?: (tx: any, row: QualityRow) => Promise<void>,
  ) {
    return this.db.transaction(async (tx) => {
      const inputSourceType = 'sourceType' in input ? input.sourceType : undefined;
      if (
        entity === 'action'
        && !afterCreate
        && typeof inputSourceType === 'string'
        && ['SAFETY_INCIDENT', 'SAFETY_OBSERVATION'].includes(inputSourceType)
      ) {
        throw new QualityOwnershipError();
      }
      await this.validateReferences(tx, entity, scope, input);
      const id = generateId();
      const series = entity === 'inspection' ? 'QI' : entity === 'deficiency' ? 'DEF' : undefined;
      const number = series
        ? await documentNumberService.allocateDocumentNumber(
            tx,
            scope.organizationId,
            scope.projectId,
            series,
            yyyymm(),
          )
        : undefined;
      const inputWithNumber = entity === 'inspection'
        ? { ...input, inspectionNumber: number }
        : entity === 'deficiency'
          ? { ...input, deficiencyNumber: number }
          : input;
      const row = await this.repo.create(tx, entity, {
        id,
        ...scope,
        ...inputWithNumber,
        createdBy: actorUserId,
      });
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: `quality.${entity}.created`,
        resourceType: entity,
        resourceId: id,
        metadata: { projectId: scope.projectId, ...(number ? { number } : {}) },
      }, tx);
      if (afterCreate) await afterCreate(tx, row);
      logger.info({ organizationId: scope.organizationId, projectId: scope.projectId, entity, id }, 'Quality resource created');
      return row;
    });
  }

  async create(
    actorUserId: string,
    scope: QualityScope,
    entity: QualityEntityType,
    input: CreateInput,
  ) {
    return this.createResource(actorUserId, scope, entity, input);
  }

  async createSafetyCorrectiveAction(
    actorUserId: string,
    scope: QualityScope,
    safetyEventId: string,
    input: CreateCorrectiveActionInput,
  ) {
    return this.createResource(actorUserId, scope, 'action', input, async (tx, row) => {
      const [event] = await tx.select().from(safetyEvents).where(and(
        eq(safetyEvents.id, safetyEventId),
        eq(safetyEvents.organizationId, scope.organizationId),
        eq(safetyEvents.projectId, scope.projectId),
      )).limit(1).for('update');
      if (!event) throw new QualityResourceNotFoundError();
      const expectedSourceType = ['UNSAFE_CONDITION', 'UNSAFE_ACT'].includes(event.eventType)
        ? 'SAFETY_OBSERVATION'
        : 'SAFETY_INCIDENT';
      if (!('sourceId' in row) || !('sourceType' in row)) {
        throw new QualityOwnershipError();
      }
      if (row.sourceId !== safetyEventId || row.sourceType !== expectedSourceType) {
        throw new QualityOwnershipError();
      }
      if (event.status !== 'CORRECTIVE_ACTION_REQUIRED') {
        throw new QualityInvalidStateError(event.status, 'CORRECTIVE_ACTION_IN_PROGRESS');
      }
      await tx.update(safetyEvents).set({ status: 'CORRECTIVE_ACTION_IN_PROGRESS' }).where(and(
        eq(safetyEvents.id, safetyEventId),
        eq(safetyEvents.organizationId, scope.organizationId),
        eq(safetyEvents.projectId, scope.projectId),
      ));
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'safety.event_corrective_action_started',
        resourceType: 'safety_event',
        resourceId: safetyEventId,
        metadata: { projectId: scope.projectId },
      }, tx);
      await writeOutboxEvent(tx, 'safety.event_status_changed', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        eventId: safetyEventId,
        status: 'CORRECTIVE_ACTION_IN_PROGRESS',
      }, scope.organizationId);
    });
  }

  async list(
    scope: QualityScope,
    entity: QualityEntityType,
    options: QualityListOptions,
  ) {
    const rows = await this.repo.list(this.db, entity, scope.organizationId, scope.projectId, options);
    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;
    const last = data[data.length - 1] as { createdAt: Date; id: string } | undefined;
    return {
      data,
      nextCursor: hasMore && last ? encodeQualityCursor(last) : null,
    };
  }

  async get(scope: QualityScope, entity: QualityEntityType, id: string) {
    const row = await this.repo.findById(this.db, entity, scope.organizationId, scope.projectId, id);
    if (!row) throw new QualityResourceNotFoundError();
    return row;
  }

  async update(
    actorUserId: string,
    scope: QualityScope,
    entity: QualityEntityType,
    id: string,
    input: UpdateInput,
  ) {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(
        tx,
        entity,
        scope.organizationId,
        scope.projectId,
        id,
      );
      if (!row) throw new QualityResourceNotFoundError();
      const targetStatus = input['status'];
      if (targetStatus) this.assertPatchTransition(entity, row.status, targetStatus);
      if (entity === 'inspection' && (row.status === 'COMPLETED' || row.status === 'CANCELLED')) {
        throw new QualityInvalidStateError(row.status, 'UPDATED');
      }
      if (entity === 'deficiency' && ['RESOLVED', 'CLOSED', 'DISPUTED', 'CANCELLED'].includes(row.status)) {
        throw new QualityInvalidStateError(row.status, 'UPDATED');
      }
      if (entity === 'action' && ['COMPLETED', 'VERIFIED', 'CANCELLED'].includes(row.status)) {
        throw new QualityInvalidStateError(row.status, 'UPDATED');
      }
      await this.validateReferences(tx, entity, scope, input);
      const updated = await this.repo.update(
        tx,
        entity,
        scope.organizationId,
        scope.projectId,
        id,
        input,
      );
      if (!updated) throw new QualityResourceNotFoundError();
      if (entity === 'deficiency' && targetStatus === 'CANCELLED') {
        await this.logTransition(tx, actorUserId, scope, entity, id, row.status, targetStatus);
      } else if (targetStatus) {
        await this.logTransition(tx, actorUserId, scope, entity, id, row.status, targetStatus);
      } else {
        await auditService.log({
          organizationId: scope.organizationId,
          actorUserId,
          action: `quality.${entity}.updated`,
          resourceType: entity,
          resourceId: id,
          metadata: { projectId: scope.projectId },
        }, tx);
      }
      return updated;
    });
  }

  private assertPatchTransition(entity: QualityEntityType, current: string, target: string): void {
    const allowed: Record<QualityEntityType, Record<string, string[]>> = {
      inspection: { SCHEDULED: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['CANCELLED'] },
      deficiency: {
        OPEN: ['IN_PROGRESS', 'DISPUTED', 'CANCELLED'],
        IN_PROGRESS: ['DISPUTED'],
      },
      action: { OPEN: ['IN_PROGRESS', 'CANCELLED'], IN_PROGRESS: ['CANCELLED'] },
    };
    if (!allowed[entity][current]?.includes(target)) {
      throw new QualityInvalidStateError(current, target);
    }
  }

  private async logTransition(
    tx: any,
    actorUserId: string,
    scope: QualityScope,
    entity: QualityEntityType,
    id: string,
    from: string,
    to: string,
    eventType?: string,
    eventDetails: Record<string, unknown> = {},
  ): Promise<void> {
    await auditService.log({
      organizationId: scope.organizationId,
      actorUserId,
      action: eventType ?? `quality.${entity}.${to.toLowerCase()}`,
      resourceType: entity,
      resourceId: id,
      metadata: { projectId: scope.projectId, fromStatus: from, toStatus: to },
    }, tx);
    if (eventType) {
      await writeOutboxEvent(tx, eventType, {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        ...eventDetails,
      }, scope.organizationId);
    } else {
      await writeOutboxEvent(tx, `quality.${entity}.${to.toLowerCase()}`, {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        [`${entity}Id`]: id,
      }, scope.organizationId);
    }
  }

  private async transition(
    actorUserId: string,
    scope: QualityScope,
    entity: QualityEntityType,
    id: string,
    allowed: string[],
    target: string,
    patch: Record<string, unknown> = {},
    eventType?: string,
    eventDetails: Record<string, unknown> = {},
    afterTransition?: (tx: any, row: QualityRow) => Promise<void>,
  ) {
    return this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, entity, scope.organizationId, scope.projectId, id);
      if (!row) throw new QualityResourceNotFoundError();
      if (row.status === target) return row;
      if (!allowed.includes(row.status)) throw new QualityInvalidStateError(row.status, target);
      const updated = await this.repo.update(tx, entity, scope.organizationId, scope.projectId, id, {
        ...patch,
        status: target,
      });
      if (!updated) throw new QualityResourceNotFoundError();
      await this.logTransition(tx, actorUserId, scope, entity, id, row.status, target, eventType, eventDetails);
      if (afterTransition) await afterTransition(tx, updated);
      logger.info({ organizationId: scope.organizationId, projectId: scope.projectId, entity, id, from: row.status, to: target }, 'Quality state changed');
      return updated;
    });
  }

  async startInspection(actorUserId: string, scope: QualityScope, id: string) {
    return this.transition(actorUserId, scope, 'inspection', id, ['SCHEDULED'], 'IN_PROGRESS');
  }

  async completeInspection(
    actorUserId: string,
    scope: QualityScope,
    id: string,
    input: CompleteQualityInspectionInput,
  ) {
    return this.transition(
      actorUserId,
      scope,
      'inspection',
      id,
      ['IN_PROGRESS'],
      'COMPLETED',
      input,
      'quality.inspection_completed',
      { inspectionId: id, result: input.result },
    );
  }

  async resolveDeficiency(actorUserId: string, scope: QualityScope, id: string) {
    return this.transition(actorUserId, scope, 'deficiency', id, ['IN_PROGRESS'], 'RESOLVED');
  }

  async closeDeficiency(actorUserId: string, scope: QualityScope, id: string) {
    return this.transition(actorUserId, scope, 'deficiency', id, ['RESOLVED'], 'CLOSED', {
      closedAt: new Date(),
    }, 'quality.deficiency_closed', { deficiencyId: id });
  }

  async completeCorrectiveAction(actorUserId: string, scope: QualityScope, id: string) {
    return this.transition(actorUserId, scope, 'action', id, ['IN_PROGRESS'], 'COMPLETED', {
      completedAt: new Date(),
    });
  }

  async verifyCorrectiveAction(
    actorUserId: string,
    scope: QualityScope,
    id: string,
    input: VerifyCorrectiveActionInput,
  ) {
    return this.transition(actorUserId, scope, 'action', id, ['COMPLETED'], 'VERIFIED', {
      verifiedBy: actorUserId,
      verifiedAt: new Date(),
      ...(input.notes !== undefined ? { notes: input.notes } : {}),
    }, 'quality.corrective_action_verified', { correctiveActionId: id }, async (tx, updated) => {
      if (!('sourceType' in updated) || !('sourceId' in updated)) return;
      const action = updated;
      if (!['SAFETY_INCIDENT', 'SAFETY_OBSERVATION'].includes(action.sourceType)) return;
      const [event] = await tx.select().from(safetyEvents).where(and(
        eq(safetyEvents.id, action.sourceId),
        eq(safetyEvents.organizationId, scope.organizationId),
        eq(safetyEvents.projectId, scope.projectId),
      )).limit(1).for('update');
      if (!event || event.status !== 'CORRECTIVE_ACTION_IN_PROGRESS') return;
      const [remaining] = await tx.select({ id: correctiveActions.id })
        .from(correctiveActions)
        .where(and(
          eq(correctiveActions.organizationId, scope.organizationId),
          eq(correctiveActions.projectId, scope.projectId),
          eq(correctiveActions.sourceType, action.sourceType),
          eq(correctiveActions.sourceId, action.sourceId),
          ne(correctiveActions.status, 'VERIFIED'),
        )).limit(1);
      if (remaining) return;
      await tx.update(safetyEvents).set({
        status: 'CLOSED',
        closedAt: new Date(),
      }).where(and(
        eq(safetyEvents.id, action.sourceId),
        eq(safetyEvents.organizationId, scope.organizationId),
        eq(safetyEvents.projectId, scope.projectId),
      ));
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'safety.event_closed',
        resourceType: 'safety_event',
        resourceId: action.sourceId,
        metadata: { projectId: scope.projectId, reason: 'corrective_actions_verified' },
      }, tx);
      await writeOutboxEvent(tx, 'safety.event_closed', {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        eventId: action.sourceId,
      }, scope.organizationId);
    });
  }

  async attachDocument(
    actorUserId: string,
    scope: QualityScope,
    entity: 'inspection' | 'deficiency',
    id: string,
    documentId: string,
  ) {
    await this.db.transaction(async (tx) => {
      const row = await this.repo.findByIdForUpdate(tx, entity, scope.organizationId, scope.projectId, id);
      if (!row) throw new QualityResourceNotFoundError();
      await linkDocument(tx, {
        orgId: scope.organizationId,
        projectId: scope.projectId,
        docId: documentId,
        entityType: entity === 'inspection' ? 'quality_inspection' : 'quality_deficiency',
        entityId: id,
        createdBy: actorUserId,
      });
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: `quality.${entity}.document_attached`,
        resourceType: entity,
        resourceId: id,
        metadata: { projectId: scope.projectId, documentId },
      }, tx);
    });
  }
}

export const qualityService = new QualityService();
