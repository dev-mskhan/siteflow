// apps/server/src/modules/project/settings/project-settings.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { auditService } from '../../audit/audit.service.js';
import { OrgSettingsRepository } from '../../organization/settings/settings.repository.js';
import { ProjectRepository } from '../core/project.repository.js';
import { ProjectSettingsRepository } from './project-settings.repository.js';
import type { ProjectSettings, OrganizationSettings } from '@siteflow/database/schema';

const logger = createLogger({ name: 'project-settings-service' });
const tracer = trace.getTracer('project-settings-service');

export interface EffectiveProjectSettings {
  timezone: string;
  locale: string;
  dateFormat: string;
  timeFormat: string;
  unitSystem: string;
  weekStartsOn: number;
  currency: string; // from project row, not settings
}

export interface UpdateProjectSettingsInput {
  timezone?: string;
  locale?: string;
  dateFormat?: string;
  timeFormat?: string;
  unitSystem?: string;
  weekStartsOn?: number;
}

export class ProjectSettingsService {
  constructor(
    private projectRepo = new ProjectRepository(),
    private settingsRepo = new ProjectSettingsRepository(),
    private orgSettingsRepo = new OrgSettingsRepository(),
  ) {}

  private get db() {
    return getDb();
  }

  async getEffectiveSettings(orgId: string, projectId: string): Promise<EffectiveProjectSettings> {
    return withSpan(tracer, 'project-settings.getEffectiveSettings', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);

      const [project, projectSettingsRow, orgSettings] = await Promise.all([
        this.projectRepo.findByIdOrThrow(orgId, projectId),
        this.settingsRepo.findByProject(orgId, projectId),
        this.orgSettingsRepo.findByOrgId(orgId),
      ]);

      return this.merge(project.currency, projectSettingsRow, orgSettings);
    });
  }

  async updateProjectSettings(
    actorUserId: string,
    orgId: string,
    projectId: string,
    input: UpdateProjectSettingsInput,
  ): Promise<EffectiveProjectSettings> {
    return withSpan(tracer, 'project-settings.updateProjectSettings', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('project.id', projectId);
      span.setAttribute('user.id', actorUserId);
      logger.info({ orgId, projectId, actorUserId }, 'Updating project settings');

      const [project, orgSettings] = await Promise.all([
        this.projectRepo.findByIdOrThrow(orgId, projectId),
        this.orgSettingsRepo.findByOrgId(orgId),
      ]);

      const updatedSettings = await this.db.transaction(async (tx) => {
        const settings = await this.settingsRepo.upsert(tx, orgId, projectId, {
          timezone: input.timezone ?? undefined,
          locale: input.locale ?? undefined,
          dateFormat: (input.dateFormat as ProjectSettings['dateFormat']) ?? undefined,
          timeFormat: (input.timeFormat as ProjectSettings['timeFormat']) ?? undefined,
          unitSystem: (input.unitSystem as ProjectSettings['unitSystem']) ?? undefined,
          weekStartsOn: input.weekStartsOn ?? undefined,
        });

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'project.settings_updated',
            resourceType: 'ProjectSettings',
            resourceId: projectId,
            projectId,
            metadata: input as Record<string, unknown>,
          },
          tx,
        );

        return settings;
      });

      return this.merge(project.currency, updatedSettings, orgSettings);
    });
  }

  private merge(
    projectCurrency: string,
    projectSettings: ProjectSettings | null,
    orgSettings: OrganizationSettings | undefined,
  ): EffectiveProjectSettings {
    return {
      timezone: projectSettings?.timezone ?? orgSettings?.timezone ?? 'UTC',
      locale: projectSettings?.locale ?? orgSettings?.locale ?? 'en-US',
      dateFormat: (projectSettings?.dateFormat ?? orgSettings?.dateFormat ?? 'YYYY_MM_DD') as string,
      timeFormat: (projectSettings?.timeFormat ?? orgSettings?.timeFormat ?? 'H24') as string,
      unitSystem: (projectSettings?.unitSystem ?? orgSettings?.unitSystem ?? 'METRIC') as string,
      weekStartsOn: projectSettings?.weekStartsOn ?? orgSettings?.weekStartsOn ?? 1,
      currency: projectCurrency,
    };
  }
}

export const projectSettingsService = new ProjectSettingsService();
