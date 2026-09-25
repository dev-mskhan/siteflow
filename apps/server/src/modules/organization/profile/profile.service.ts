// apps/server/src/modules/organization/profile/profile.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../../lib/db/index.js';
import { OrgProfileRepository } from './profile.repository.js';
import { auditService } from '../../audit/audit.service.js';
import { NotFoundError } from '../organization.errors.js';
import type { OrgProfileDTO, UpdateProfileInput } from './profile.types.js';
import type { OrganizationContext } from '../../rbac/rbac.types.js';
import type { OrganizationProfile } from '@siteflow/database/schema';

const logger = createLogger({ name: 'org-profile-service' });
const tracer = trace.getTracer('org-profile-service');

export function toOrgProfileDTO(profile: OrganizationProfile): OrgProfileDTO {
  return {
    organizationId: profile.organizationId,
    legalName: profile.legalName ?? null,
    businessName: profile.businessName ?? null,
    businessType: profile.businessType ?? null,
    registrationNumber: profile.registrationNumber ?? null,
    taxIdentificationNumber: profile.taxIdentificationNumber ?? null,
    primaryEmail: profile.primaryEmail ?? null,
    primaryPhone: profile.primaryPhone ?? null,
    secondaryPhone: profile.secondaryPhone ?? null,
    website: profile.website ?? null,
    addressLine1: profile.addressLine1 ?? null,
    addressLine2: profile.addressLine2 ?? null,
    city: profile.city ?? null,
    stateProvince: profile.stateProvince ?? null,
    postalCode: profile.postalCode ?? null,
    country: profile.country ?? null,
    createdAt: profile.createdAt.toISOString(),
    updatedAt: profile.updatedAt.toISOString(),
  };
}

export class OrgProfileService {
  constructor(private repo = new OrgProfileRepository()) {}

  private get db() {
    return getDb();
  }

  async getProfile(orgId: string): Promise<OrgProfileDTO> {
    return withSpan(tracer, 'profile.getProfile', async (span) => {
      span.setAttribute('organization.id', orgId);
      const profile = await this.repo.findByOrgId(orgId);
      if (!profile) throw new NotFoundError('Organization profile not found');
      return toOrgProfileDTO(profile);
    });
  }

  async updateProfile(
    orgId: string,
    actorCtx: OrganizationContext,
    input: UpdateProfileInput,
  ): Promise<OrgProfileDTO> {
    return withSpan(tracer, 'profile.updateProfile', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('user.id', actorCtx.userId);
      logger.info({ orgId, userId: actorCtx.userId }, 'Updating organization profile');

      const updated = await this.db.transaction(async (tx) => {
        const result = await this.repo.upsert(orgId, input, tx);

        await auditService.log(
          {
            organizationId: orgId,
            actorUserId: actorCtx.userId,
            action: 'organization.profile_updated',
            resourceType: 'OrganizationProfile',
            resourceId: orgId,
            metadata: input as Record<string, unknown>,
          },
          tx,
        );

        return result;
      });

      return toOrgProfileDTO(updated);
    });
  }
}
