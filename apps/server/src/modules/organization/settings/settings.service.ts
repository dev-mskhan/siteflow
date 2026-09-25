// apps/server/src/modules/organization/settings/settings.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { OrgSettingsRepository } from './settings.repository.js';
import { auditService } from '../../audit/audit.service.js';
import { NotFoundError } from '../organization.errors.js';
import type { OrgSettingsDTO, UpdateSettingsInput } from './settings.types.js';
import type { OrganizationContext } from '../../rbac/rbac.types.js';
import type { OrganizationSettings } from '@siteflow/database/schema';

const logger = createLogger({ name: 'org-settings-service' });
const tracer = trace.getTracer('org-settings-service');

export function toOrgSettingsDTO(settings: OrganizationSettings): OrgSettingsDTO {
  return {
    organizationId: settings.organizationId,
    timezone: settings.timezone,
    currency: settings.currency,
    locale: settings.locale,
    dateFormat: settings.dateFormat as OrgSettingsDTO['dateFormat'],
    timeFormat: settings.timeFormat as OrgSettingsDTO['timeFormat'],
    unitSystem: settings.unitSystem as OrgSettingsDTO['unitSystem'],
    weekStartsOn: settings.weekStartsOn,
    fiscalYearStartMonth: settings.fiscalYearStartMonth,
    createdAt: settings.createdAt.toISOString(),
    updatedAt: settings.updatedAt.toISOString(),
  };
}

export class OrgSettingsService {
  constructor(private repo = new OrgSettingsRepository()) {}

  private get db() {
    return getDb();
  }

  async getSettings(orgId: string): Promise<OrgSettingsDTO> {
    return withSpan(tracer, 'settings.getSettings', async (span) => {
      span.setAttribute('organization.id', orgId);
      const settings = await this.repo.findByOrgId(orgId);
      if (!settings) throw new NotFoundError('Organization settings not found');
      return toOrgSettingsDTO(settings);
    });
  }

  async updateSettings(
    orgId: string,
    actorCtx: OrganizationContext,
    input: UpdateSettingsInput,
  ): Promise<OrgSettingsDTO> {
    return withSpan(tracer, 'settings.updateSettings', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('user.id', actorCtx.userId);
      logger.info({ orgId, userId: actorCtx.userId }, 'Updating organization settings');

      // Verify settings row exists
      const existing = await this.repo.findByOrgId(orgId);
      if (!existing) throw new NotFoundError('Organization settings not found');

      const updated = await this.db.transaction(async (tx) => {
        const result = await this.repo.upsert(orgId, input, tx);

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId: actorCtx.userId,
            action: 'organization.settings_updated',
            resourceType: 'OrganizationSettings',
            resourceId: orgId,
            metadata: input as Record<string, unknown>,
          },
          tx,
        );

        return result;
      });

      return toOrgSettingsDTO(updated);
    });
  }
}
