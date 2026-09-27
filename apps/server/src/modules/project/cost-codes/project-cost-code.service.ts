// apps/server/src/modules/project/cost-codes/project-cost-code.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import { auditService } from '../../audit/audit.service.js';
import { ProjectCostCodeRepository } from './project-cost-code.repository.js';
import { ProjectConflictError } from '../core/project.errors.js';
import type { ProjectCostCode } from '@siteflow/database/schema';
import type { CreateCostCodeInput, UpdateCostCodeInput } from './project-cost-code.schemas.js';

const logger = createLogger({ name: 'project-cost-code-service' });
const tracer = trace.getTracer('project-cost-code-service');

export class ProjectCostCodeService {
  constructor(private codeRepo = new ProjectCostCodeRepository()) {}

  private get db() {
    return getDb();
  }

  async listCostCodes(orgId: string, projectId: string, includeInactive = false): Promise<ProjectCostCode[]> {
    return withSpan(tracer, 'project-cost-code.listCostCodes', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      return this.codeRepo.findAll(orgId, projectId, includeInactive);
    });
  }

  async createCostCode(
    actorUserId: string,
    orgId: string,
    projectId: string,
    input: CreateCostCodeInput,
  ): Promise<ProjectCostCode> {
    return withSpan(tracer, 'project-cost-code.createCostCode', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const code = input.code.toUpperCase();

      const created = await this.db.transaction(async (tx) => {
        let newCode: ProjectCostCode;
        try {
          newCode = await this.codeRepo.create(tx, {
            id: generateId(),
            projectId,
            organizationId: orgId,
            code,
            description: input.description ?? null,
            isActive: true,
            createdBy: actorUserId,
          });
        } catch (err: any) {
          if (err?.code === '23505') {
            throw new ProjectConflictError('Cost code already exists in this project');
          }
          throw err;
        }

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.cost_code.created',
            resourceType: 'ProjectCostCode',
            resourceId: newCode.id,
            projectId,
            metadata: { code } as Record<string, unknown>,
          },
          tx,
        );

        return newCode;
      });

      logger.info({ orgId, projectId, codeId: created.id }, 'Cost code created');
      return created;
    });
  }

  async updateCostCode(
    actorUserId: string,
    orgId: string,
    projectId: string,
    codeId: string,
    input: UpdateCostCodeInput,
  ): Promise<ProjectCostCode> {
    return withSpan(tracer, 'project-cost-code.updateCostCode', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const updated = await this.db.transaction(async (tx) => {
        // IDOR check — ensures codeId belongs to this project+org
        await this.codeRepo.findByIdOrThrow(orgId, projectId, codeId);

        let code: ProjectCostCode;
        try {
          code = await this.codeRepo.update(tx, orgId, projectId, codeId, {
            ...(input.code !== undefined ? { code: input.code.toUpperCase() } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
          });
        } catch (err: any) {
          if (err?.code === '23505') {
            throw new ProjectConflictError('Cost code already exists in this project');
          }
          throw err;
        }

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.cost_code.updated',
            resourceType: 'ProjectCostCode',
            resourceId: codeId,
            projectId,
            metadata: input as Record<string, unknown>,
          },
          tx,
        );

        return code;
      });

      return updated;
    });
  }

  async deactivateCostCode(
    actorUserId: string,
    orgId: string,
    projectId: string,
    codeId: string,
  ): Promise<void> {
    return withSpan(tracer, 'project-cost-code.deactivateCostCode', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      await this.db.transaction(async (tx) => {
        await this.codeRepo.findByIdOrThrow(orgId, projectId, codeId);
        await this.codeRepo.deactivate(tx, orgId, projectId, codeId);

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.cost_code.deactivated',
            resourceType: 'ProjectCostCode',
            resourceId: codeId,
            projectId,
            metadata: {} as Record<string, unknown>,
          },
          tx,
        );
      });

      logger.info({ orgId, projectId, codeId, actorUserId }, 'Cost code deactivated');
    });
  }
}

export const projectCostCodeService = new ProjectCostCodeService();
