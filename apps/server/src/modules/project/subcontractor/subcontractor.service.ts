// apps/server/src/modules/project/subcontractor/subcontractor.service.ts
import { withSpan } from '@siteflow/observability/server';
import { trace } from '@opentelemetry/api';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { writeOutboxEvent } from '../../../lib/outbox/outbox.service.js';
import { SubcontractorRepository } from './subcontractor.repository.js';
import {
  SubcontractorNotFoundError,
  ProjectSubcontractorNotFoundError,
  SubcontractorContactNotFoundError,
  SubcontractorInactiveError,
  SubcontractorAlreadyAssignedToProjectError,
  TaskAlreadyAssignedToSubcontractorError,
  PrimaryContactAlreadyExistsError,
  SubcontractorTaskAssignmentNotFoundError,
} from './subcontractor.errors.js';
import type {
  SubcontractorDTO,
  SubcontractorContactDTO,
  ProjectSubcontractorDTO,
  SubcontractorTaskAssignmentDTO,
  CreateSubcontractorInput,
  UpdateSubcontractorInput,
  AssignSubcontractorToProjectInput,
  UpdateProjectSubcontractorInput,
  CreateContactInput,
  UpdateContactInput,
  AssignTaskInput,
  ListSubcontractorsQuery,
} from './subcontractor.types.js';
import type {
  Subcontractor,
  SubcontractorContact,
  ProjectSubcontractor,
} from '@siteflow/database/schema';
import { tasks, projects } from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';

const tracer = trace.getTracer('subcontractor-service');

function toSubcontractorDTO(row: Subcontractor): SubcontractorDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    legalName: row.legalName,
    displayName: row.displayName,
    trade: row.trade ?? null,
    registrationReference: row.registrationReference ?? null,
    taxReference: row.taxReference ?? null,
    status: row.status as SubcontractorDTO['status'],
    primaryEmail: row.primaryEmail ?? null,
    primaryPhone: row.primaryPhone ?? null,
    address: row.address ?? null,
    notes: row.notes ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toContactDTO(row: SubcontractorContact): SubcontractorContactDTO {
  return {
    id: row.id,
    subcontractorId: row.subcontractorId,
    organizationId: row.organizationId,
    name: row.name,
    role: row.role ?? null,
    email: row.email ?? null,
    phone: row.phone ?? null,
    isPrimary: row.isPrimary,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toProjectSubcontractorDTO(
  row: ProjectSubcontractor,
  sub: Subcontractor,
): ProjectSubcontractorDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectId: row.projectId,
    subcontractorId: row.subcontractorId,
    status: row.status as ProjectSubcontractorDTO['status'],
    scopeDescription: row.scopeDescription ?? null,
    contractValue: row.contractValue ?? null,
    currencyCode: row.currencyCode ?? null,
    startDate: row.startDate ?? null,
    endDate: row.endDate ?? null,
    subcontractor: toSubcontractorDTO(sub),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export class SubcontractorService {
  constructor(private repo = new SubcontractorRepository()) {}

  private get db() {
    return getDb();
  }

  // ── Org-level subcontractor CRUD ────────────────────────────────────────────

  async createSubcontractor(
    actorUserId: string,
    organizationId: string,
    input: CreateSubcontractorInput,
  ): Promise<SubcontractorDTO> {
    return withSpan(tracer, 'subcontractor.create', async (span) => {
      span.setAttributes({ organizationId });

      return this.db.transaction(async (tx) => {
        const id = generateId();
        const row = await this.repo.create(tx as any, {
          id,
          organizationId,
          legalName: input.legalName,
          displayName: input.displayName,
          trade: input.trade,
          registrationReference: input.registrationReference,
          taxReference: input.taxReference,
          primaryEmail: input.primaryEmail,
          primaryPhone: input.primaryPhone,
          address: input.address,
          notes: input.notes,
        });
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'subcontractor.created',
            resourceType: 'Subcontractor',
            resourceId: id,
            metadata: { legalName: input.legalName },
          },
          tx,
        );
        return toSubcontractorDTO(row);
      });
    });
  }

  async getSubcontractor(organizationId: string, subcontractorId: string): Promise<SubcontractorDTO> {
    return withSpan(tracer, 'subcontractor.get', async (span) => {
      span.setAttributes({ organizationId, subcontractorId });

      const row = await this.repo.findById(this.db, subcontractorId);
      if (!row || row.organizationId !== organizationId) {
        throw new SubcontractorNotFoundError(subcontractorId);
      }
      return toSubcontractorDTO(row);
    });
  }

  async listSubcontractors(
    organizationId: string,
    query: ListSubcontractorsQuery,
  ): Promise<{ data: SubcontractorDTO[]; nextCursor: string | null }> {
    return withSpan(tracer, 'subcontractor.list', async (span) => {
      span.setAttributes({ organizationId });

      const limit = query.limit ?? 50;
      const rows = await this.repo.listByOrg(this.db, organizationId, {
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
      return { data: data.map(toSubcontractorDTO), nextCursor };
    });
  }

  async updateSubcontractor(
    actorUserId: string,
    organizationId: string,
    subcontractorId: string,
    input: UpdateSubcontractorInput,
  ): Promise<SubcontractorDTO> {
    return withSpan(tracer, 'subcontractor.update', async (span) => {
      span.setAttributes({ organizationId, subcontractorId });

      return this.db.transaction(async (tx) => {
        const existing = await this.repo.findById(tx as any, subcontractorId);
        if (!existing || existing.organizationId !== organizationId) {
          throw new SubcontractorNotFoundError(subcontractorId);
        }
        const updated = await this.repo.update(tx as any, subcontractorId, input as any);
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'subcontractor.updated',
            resourceType: 'Subcontractor',
            resourceId: subcontractorId,
            metadata: {},
          },
          tx,
        );
        return toSubcontractorDTO(updated);
      });
    });
  }

  // ── Contacts ──────────────────────────────────────────────────────────────

  async createContact(
    actorUserId: string,
    organizationId: string,
    subcontractorId: string,
    input: CreateContactInput,
  ): Promise<SubcontractorContactDTO> {
    return withSpan(tracer, 'subcontractor.contact.create', async (span) => {
      span.setAttributes({ organizationId, subcontractorId });

      return this.db.transaction(async (tx) => {
        const sub = await this.repo.findById(tx as any, subcontractorId);
        if (!sub || sub.organizationId !== organizationId) {
          throw new SubcontractorNotFoundError(subcontractorId);
        }
        // Enforce single-primary at service level
        if (input.isPrimary) {
          const existing = await this.repo.findPrimaryContact(tx as any, subcontractorId);
          if (existing) {
            throw new PrimaryContactAlreadyExistsError(subcontractorId);
          }
        }
        const id = generateId();
        const row = await this.repo.createContact(tx as any, {
          id,
          organizationId,
          subcontractorId,
          name: input.name,
          role: input.role,
          email: input.email,
          phone: input.phone,
          isPrimary: input.isPrimary ?? false,
        });
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'subcontractor.contact.created',
            resourceType: 'SubcontractorContact',
            resourceId: id,
            metadata: { subcontractorId },
          },
          tx,
        );
        return toContactDTO(row);
      });
    });
  }

  async updateContact(
    actorUserId: string,
    organizationId: string,
    subcontractorId: string,
    contactId: string,
    input: UpdateContactInput,
  ): Promise<SubcontractorContactDTO> {
    return withSpan(tracer, 'subcontractor.contact.update', async (span) => {
      span.setAttributes({ organizationId, subcontractorId, contactId });

      return this.db.transaction(async (tx) => {
        const sub = await this.repo.findById(tx as any, subcontractorId);
        if (!sub || sub.organizationId !== organizationId) {
          throw new SubcontractorNotFoundError(subcontractorId);
        }
        const contact = await this.repo.findContactById(tx as any, contactId);
        if (!contact || contact.subcontractorId !== subcontractorId) {
          throw new SubcontractorContactNotFoundError(contactId);
        }
        // Enforce single-primary — if setting this contact as primary, unset the old one
        if (input.isPrimary === true && !contact.isPrimary) {
          const existing = await this.repo.findPrimaryContact(tx as any, subcontractorId);
          if (existing && existing.id !== contactId) {
            await this.repo.updateContact(tx as any, existing.id, { isPrimary: false });
          }
        }
        const updated = await this.repo.updateContact(tx as any, contactId, input as any);
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'subcontractor.contact.updated',
            resourceType: 'SubcontractorContact',
            resourceId: contactId,
            metadata: { subcontractorId },
          },
          tx,
        );
        return toContactDTO(updated);
      });
    });
  }

  // ── Project assignment ────────────────────────────────────────────────────

  async assignToProject(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    input: AssignSubcontractorToProjectInput,
  ): Promise<ProjectSubcontractorDTO> {
    return withSpan(tracer, 'subcontractor.project.assign', async (span) => {
      span.setAttributes({ organizationId, projectId, subcontractorId: input.subcontractorId });

      return this.db.transaction(async (tx) => {
        // Cross-entity ownership: validate subcontractor belongs to org
        const sub = await this.repo.findById(tx as any, input.subcontractorId);
        if (!sub || sub.organizationId !== organizationId) {
          throw new SubcontractorNotFoundError(input.subcontractorId);
        }
        // INACTIVE/SUSPENDED cannot be assigned
        if (sub.status === 'INACTIVE' || sub.status === 'SUSPENDED') {
          throw new SubcontractorInactiveError(input.subcontractorId);
        }
        // Validate project belongs to org
        const projectRows = await (tx as any)
          .select()
          .from(projects)
          .where(and(eq(projects.id, projectId), eq(projects.organizationId, organizationId)));
        if (!projectRows[0]) {
          throw new Error(`Project not found: ${projectId}`);
        }
        // Check for duplicate assignment
        const existing = await this.repo.findProjectSubcontractor(
          tx as any,
          projectId,
          input.subcontractorId,
        );
        if (existing) {
          throw new SubcontractorAlreadyAssignedToProjectError(input.subcontractorId, projectId);
        }
        const id = generateId();
        const row = await this.repo.createProjectSubcontractor(tx as any, {
          id,
          organizationId,
          projectId,
          subcontractorId: input.subcontractorId,
          scopeDescription: input.scopeDescription,
          contractValue: input.contractValue,
          currencyCode: input.currencyCode,
          startDate: input.startDate,
          endDate: input.endDate,
        });
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'subcontractor.project.assigned',
            resourceType: 'ProjectSubcontractor',
            resourceId: id,
            metadata: { projectId, subcontractorId: input.subcontractorId },
          },
          tx,
        );
        return toProjectSubcontractorDTO(row, sub);
      });
    });
  }

  async listProjectSubcontractors(
    organizationId: string,
    projectId: string,
  ): Promise<ProjectSubcontractorDTO[]> {
    return withSpan(tracer, 'subcontractor.project.list', async (span) => {
      span.setAttributes({ organizationId, projectId });

      const rows = await this.repo.listProjectSubcontractors(this.db, organizationId, projectId);
      const result: ProjectSubcontractorDTO[] = [];
      for (const row of rows) {
        const sub = await this.repo.findById(this.db, row.subcontractorId);
        if (sub) result.push(toProjectSubcontractorDTO(row, sub));
      }
      return result;
    });
  }

  async getProjectSubcontractor(
    organizationId: string,
    projectId: string,
    subcontractorId: string,
  ): Promise<ProjectSubcontractorDTO> {
    return withSpan(tracer, 'subcontractor.project.get', async (span) => {
      span.setAttributes({ organizationId, projectId, subcontractorId });

      const row = await this.repo.findProjectSubcontractor(this.db, projectId, subcontractorId);
      if (!row || row.organizationId !== organizationId) {
        throw new ProjectSubcontractorNotFoundError(subcontractorId, projectId);
      }
      const sub = await this.repo.findById(this.db, subcontractorId);
      if (!sub) throw new SubcontractorNotFoundError(subcontractorId);
      return toProjectSubcontractorDTO(row, sub);
    });
  }

  async updateProjectSubcontractor(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    subcontractorId: string,
    input: UpdateProjectSubcontractorInput,
  ): Promise<ProjectSubcontractorDTO> {
    return withSpan(tracer, 'subcontractor.project.update', async (span) => {
      span.setAttributes({ organizationId, projectId, subcontractorId });

      return this.db.transaction(async (tx) => {
        const row = await this.repo.findProjectSubcontractor(
          tx as any,
          projectId,
          subcontractorId,
        );
        if (!row || row.organizationId !== organizationId) {
          throw new ProjectSubcontractorNotFoundError(subcontractorId, projectId);
        }
        const updated = await this.repo.updateProjectSubcontractor(
          tx as any,
          row.id,
          input as any,
        );
        const sub = await this.repo.findById(tx as any, subcontractorId);
        if (!sub) throw new SubcontractorNotFoundError(subcontractorId);
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'subcontractor.project.updated',
            resourceType: 'ProjectSubcontractor',
            resourceId: row.id,
            metadata: { projectId },
          },
          tx,
        );
        return toProjectSubcontractorDTO(updated, sub);
      });
    });
  }

  // ── Task assignment ───────────────────────────────────────────────────────

  async assignTask(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    subcontractorId: string,
    input: AssignTaskInput,
  ): Promise<SubcontractorTaskAssignmentDTO> {
    return withSpan(tracer, 'subcontractor.task.assign', async (span) => {
      span.setAttributes({ organizationId, projectId, subcontractorId, taskId: input.taskId });

      return this.db.transaction(async (tx) => {
        // Validate subcontractor org ownership
        const sub = await this.repo.findById(tx as any, subcontractorId);
        if (!sub || sub.organizationId !== organizationId) {
          throw new SubcontractorNotFoundError(subcontractorId);
        }
        // Validate project assignment exists and is ACTIVE
        const projectSub = await this.repo.findProjectSubcontractor(
          tx as any,
          projectId,
          subcontractorId,
        );
        if (
          !projectSub ||
          projectSub.organizationId !== organizationId ||
          projectSub.status !== 'ACTIVE'
        ) {
          throw new ProjectSubcontractorNotFoundError(subcontractorId, projectId);
        }
        // Validate task belongs to same project and org
        const taskRows = await (tx as any)
          .select()
          .from(tasks)
          .where(
            and(
              eq(tasks.id, input.taskId),
              eq(tasks.projectId, projectId),
              eq(tasks.organizationId, organizationId),
            ),
          );
        if (!taskRows[0]) {
          throw new Error(`Task not found or does not belong to project: ${input.taskId}`);
        }
        // Check for duplicate
        const existing = await this.repo.findTaskAssignment(
          tx as any,
          subcontractorId,
          input.taskId,
        );
        if (existing) {
          throw new TaskAlreadyAssignedToSubcontractorError(input.taskId, subcontractorId);
        }
        const id = generateId();
        const row = await this.repo.createTaskAssignment(tx as any, {
          id,
          organizationId,
          projectId,
          subcontractorId,
          taskId: input.taskId,
          assignmentRole: input.assignmentRole,
        });
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'subcontractor.task.assigned',
            resourceType: 'SubcontractorTaskAssignment',
            resourceId: id,
            metadata: { projectId, taskId: input.taskId },
          },
          tx,
        );
        await writeOutboxEvent(
          tx,
          'procurement.subcontractor.assigned',
          { organizationId, projectId, subcontractorId, taskId: input.taskId },
          organizationId,
        );
        return {
          id: row.id,
          organizationId: row.organizationId,
          projectId: row.projectId,
          subcontractorId: row.subcontractorId,
          taskId: row.taskId,
          assignmentRole: row.assignmentRole ?? null,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };
      });
    });
  }

  async removeTaskAssignment(
    actorUserId: string,
    organizationId: string,
    projectId: string,
    subcontractorId: string,
    taskId: string,
  ): Promise<void> {
    return withSpan(tracer, 'subcontractor.task.unassign', async (span) => {
      span.setAttributes({ organizationId, projectId, subcontractorId, taskId });

      return this.db.transaction(async (tx) => {
        // Validate ownership
        const sub = await this.repo.findById(tx as any, subcontractorId);
        if (!sub || sub.organizationId !== organizationId) {
          throw new SubcontractorNotFoundError(subcontractorId);
        }
        const assignment = await this.repo.findTaskAssignment(tx as any, subcontractorId, taskId);
        if (
          !assignment ||
          assignment.projectId !== projectId ||
          assignment.organizationId !== organizationId
        ) {
          throw new SubcontractorTaskAssignmentNotFoundError();
        }
        await this.repo.deleteTaskAssignment(tx as any, subcontractorId, taskId);
        await auditService.log(
          {
            organizationId,
            actorUserId,
            action: 'subcontractor.task.unassigned',
            resourceType: 'SubcontractorTaskAssignment',
            resourceId: assignment.id,
            metadata: { projectId, taskId },
          },
          tx,
        );
      });
    });
  }
}
