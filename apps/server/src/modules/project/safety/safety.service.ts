import { and, eq } from 'drizzle-orm';
import { createLogger } from '@siteflow/observability/server';
import { projectMembers } from '@siteflow/database/schema';
import type {
  CloseSafetyEventInput,
  CreateSafetyEventInput,
  CreateSafetyMeetingInput,
  CreateSafetyCorrectiveActionInput,
  InvestigateSafetyEventInput,
  ListSafetyEventsQuery,
  ListSafetyMeetingsQuery,
  UpdateSafetyEventInput,
} from '@siteflow/shared';
import { getDb } from '../../../lib/db/index.js';
import { yyyymm } from '../../../lib/date.js';
import { generateId } from '../../../lib/id.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { auditService } from '../../audit/audit.service.js';
import { documentNumberService } from '../../procurement/document-number/document-number.service.js';
import { QualityResourceNotFoundError } from '../quality/quality.errors.js';
import { qualityService } from '../quality/quality.service.js';
import { linkDocument } from '../documents/document.service.js';
import {
  SafetyInvalidStateError,
  SafetyOwnershipError,
  SafetyResourceNotFoundError,
} from './safety.errors.js';
import { encodeSafetyCursor, SafetyRepository } from './safety.repository.js';

const logger = createLogger({ name: 'safety-service' });

export interface SafetyScope {
  organizationId: string;
  projectId: string;
}

export class SafetyService {
  constructor(private readonly repo = new SafetyRepository()) {}

  private get db() {
    return getDb();
  }

  private async validateProjectUser(tx: any, scope: SafetyScope, userId: string | null | undefined) {
    if (!userId) return;
    const [member] = await tx.select({ id: projectMembers.id }).from(projectMembers).where(and(
      eq(projectMembers.userId, userId),
      eq(projectMembers.organizationId, scope.organizationId),
      eq(projectMembers.projectId, scope.projectId),
      eq(projectMembers.status, 'ACTIVE'),
    )).limit(1);
    if (!member) throw new SafetyOwnershipError();
  }

  async createEvent(actorUserId: string, scope: SafetyScope, input: CreateSafetyEventInput) {
    return this.db.transaction(async (tx) => {
      await this.validateProjectUser(tx, scope, input.assignedTo);
      const id = generateId();
      const eventNumber = await documentNumberService.allocateDocumentNumber(
        tx,
        scope.organizationId,
        scope.projectId,
        'SAF',
        yyyymm(),
      );
      const event = await this.repo.createEvent(tx, {
        id,
        ...scope,
        ...input,
        eventNumber,
        reportedBy: actorUserId,
        createdBy: actorUserId,
      });
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'safety.event.reported',
        resourceType: 'safety_event',
        resourceId: id,
        metadata: { projectId: scope.projectId, eventNumber, severity: event.severity },
      }, tx);
      if (['HIGH', 'CRITICAL', 'FATALITY'].includes(event.severity)) {
        await writeOutboxEvent(tx, 'safety.incident_reported', {
          organizationId: scope.organizationId,
          projectId: scope.projectId,
          eventId: id,
          severity: event.severity,
          eventType: event.eventType,
        }, scope.organizationId);
      }
      logger.info({ organizationId: scope.organizationId, projectId: scope.projectId, eventId: id }, 'Safety event reported');
      return event;
    });
  }

  async createMeeting(actorUserId: string, scope: SafetyScope, input: CreateSafetyMeetingInput) {
    return this.db.transaction(async (tx) => {
      await this.validateProjectUser(tx, scope, input.facilitatorId);
      const meetingNumber = await documentNumberService.allocateDocumentNumber(
        tx,
        scope.organizationId,
        scope.projectId,
        'MTG',
        yyyymm(),
      );
      const meeting = await this.repo.createMeeting(tx, {
        id: generateId(),
        ...scope,
        ...input,
        meetingNumber,
        createdBy: actorUserId,
      });
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'safety.meeting.created',
        resourceType: 'safety_meeting',
        resourceId: meeting.id,
        metadata: { projectId: scope.projectId, meetingNumber },
      }, tx);
      return meeting;
    });
  }

  async listEvents(scope: SafetyScope, options: ListSafetyEventsQuery) {
    const rows = await this.repo.listEvents(this.db, scope.organizationId, scope.projectId, options);
    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;
    const last = data[data.length - 1];
    return {
      data,
      nextCursor: hasMore && last ? encodeSafetyCursor(last) : null,
    };
  }

  async getEvent(scope: SafetyScope, id: string) {
    const event = await this.repo.findEvent(this.db, scope.organizationId, scope.projectId, id);
    if (!event) throw new SafetyResourceNotFoundError();
    return event;
  }

  async listMeetings(scope: SafetyScope, options: ListSafetyMeetingsQuery) {
    const rows = await this.repo.listMeetings(this.db, scope.organizationId, scope.projectId, options);
    const hasMore = rows.length > options.limit;
    const data = hasMore ? rows.slice(0, options.limit) : rows;
    const last = data[data.length - 1];
    return {
      data,
      nextCursor: hasMore && last ? encodeSafetyCursor(last) : null,
    };
  }

  async getMeeting(scope: SafetyScope, id: string) {
    const meeting = await this.repo.findMeeting(this.db, scope.organizationId, scope.projectId, id);
    if (!meeting) throw new SafetyResourceNotFoundError();
    return meeting;
  }

  async investigate(
    actorUserId: string,
    scope: SafetyScope,
    id: string,
    input: InvestigateSafetyEventInput,
  ) {
    return this.db.transaction(async (tx) => {
      const event = await this.repo.findEventForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!event) throw new SafetyResourceNotFoundError();
      if (event.status === 'UNDER_INVESTIGATION') return event;
      if (event.status !== 'REPORTED') {
        throw new SafetyInvalidStateError(event.status, 'UNDER_INVESTIGATION');
      }
      const updated = await this.repo.updateEvent(tx, scope.organizationId, scope.projectId, id, {
        ...input,
        status: 'UNDER_INVESTIGATION',
      });
      if (!updated) throw new SafetyResourceNotFoundError();
      await this.logTransition(tx, actorUserId, scope, id, event.status, updated.status);
      return updated;
    });
  }

  async updateEvent(
    actorUserId: string,
    scope: SafetyScope,
    id: string,
    input: UpdateSafetyEventInput,
  ) {
    return this.db.transaction(async (tx) => {
      const event = await this.repo.findEventForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!event) throw new SafetyResourceNotFoundError();
      if (event.status === 'CLOSED') throw new SafetyInvalidStateError(event.status, 'UPDATED');
      await this.validateProjectUser(tx, scope, input.assignedTo);
      const target = input.status;
      if (target && target !== event.status) {
        if (event.status !== 'UNDER_INVESTIGATION' || target !== 'CORRECTIVE_ACTION_REQUIRED') {
          throw new SafetyInvalidStateError(event.status, target);
        }
        if (!(input.rootCause ?? event.rootCause)?.trim()) {
          throw new SafetyInvalidStateError(event.status, target);
        }
      }
      const updated = await this.repo.updateEvent(tx, scope.organizationId, scope.projectId, id, input);
      if (!updated) throw new SafetyResourceNotFoundError();
      if (target && target !== event.status) {
        await this.logTransition(tx, actorUserId, scope, id, event.status, updated.status);
      } else {
        await auditService.log({
          organizationId: scope.organizationId,
          actorUserId,
          action: 'safety.event.updated',
          resourceType: 'safety_event',
          resourceId: id,
          metadata: { projectId: scope.projectId },
        }, tx);
      }
      return updated;
    });
  }

  async closeEvent(actorUserId: string, scope: SafetyScope, id: string, input: CloseSafetyEventInput) {
    return this.db.transaction(async (tx) => {
      const event = await this.repo.findEventForUpdate(tx, scope.organizationId, scope.projectId, id);
      if (!event) throw new SafetyResourceNotFoundError();
      if (event.status === 'CLOSED') throw new SafetyInvalidStateError(event.status, 'CLOSED');
      const updated = await this.repo.updateEvent(tx, scope.organizationId, scope.projectId, id, {
        status: 'CLOSED',
        closedAt: new Date(),
        notes: input.notes,
      });
      if (!updated) throw new SafetyResourceNotFoundError();
      await this.logTransition(tx, actorUserId, scope, id, event.status, 'CLOSED', {
        reason: 'manual',
      });
      return updated;
    });
  }

  async createCorrectiveAction(
    actorUserId: string,
    scope: SafetyScope,
    eventId: string,
    input: CreateSafetyCorrectiveActionInput,
  ) {
    const event = await this.getEvent(scope, eventId);
    const sourceType = ['UNSAFE_CONDITION', 'UNSAFE_ACT'].includes(event.eventType)
      ? 'SAFETY_OBSERVATION'
      : 'SAFETY_INCIDENT';
    try {
      return await qualityService.createSafetyCorrectiveAction(actorUserId, scope, eventId, {
        ...input,
        sourceType,
        sourceId: eventId,
      });
    } catch (error) {
      if (error instanceof QualityResourceNotFoundError) throw new SafetyResourceNotFoundError();
      throw error;
    }
  }

  async attachDocument(actorUserId: string, scope: SafetyScope, eventId: string, documentId: string) {
    await this.db.transaction(async (tx) => {
      const event = await this.repo.findEventForUpdate(tx, scope.organizationId, scope.projectId, eventId);
      if (!event) throw new SafetyResourceNotFoundError();
      await linkDocument(tx, {
        orgId: scope.organizationId,
        projectId: scope.projectId,
        docId: documentId,
        entityType: 'safety_event',
        entityId: eventId,
        createdBy: actorUserId,
      });
      await auditService.log({
        organizationId: scope.organizationId,
        actorUserId,
        action: 'safety.event.document_attached',
        resourceType: 'safety_event',
        resourceId: eventId,
        metadata: { projectId: scope.projectId, documentId },
      }, tx);
    });
  }

  private async logTransition(
    tx: any,
    actorUserId: string,
    scope: SafetyScope,
    id: string,
    from: string,
    to: string,
    details: Record<string, unknown> = {},
  ) {
    await auditService.log({
      organizationId: scope.organizationId,
      actorUserId,
      action: to === 'CLOSED' ? 'safety.event_closed' : 'safety.event_status_changed',
      resourceType: 'safety_event',
      resourceId: id,
      metadata: { projectId: scope.projectId, fromStatus: from, toStatus: to },
    }, tx);
    await writeOutboxEvent(
      tx,
      to === 'CLOSED' ? 'safety.event_closed' : 'safety.event_status_changed',
      {
        organizationId: scope.organizationId,
        projectId: scope.projectId,
        eventId: id,
        status: to,
        ...details,
      },
      scope.organizationId,
    );
    logger.info({ organizationId: scope.organizationId, projectId: scope.projectId, eventId: id, from, to }, 'Safety event state changed');
  }
}

export const safetyService = new SafetyService();
