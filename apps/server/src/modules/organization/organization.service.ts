// apps/server/src/modules/organization/organization.service.ts
import { trace } from '@opentelemetry/api';
import { createLogger, withSpan } from '@siteflow/observability/server';
import { getDb } from '../../lib/db/index.js';
import { generateId } from '../../lib/id.js';
import { OrganizationRepository } from './organization.repository.js';
import { auditService } from '../audit/audit.service.js';
import { SYSTEM_PERMISSIONS, DEFAULT_ORG_ROLES } from '../rbac/permissions.seed.js';
import {
  permissions,
  roles,
  rolePermissions,
  organizationMemberships,
  type Organization,
} from '@siteflow/database/schema';
import { ConflictError, NotFoundError } from './organization.errors.js';
import type {
  CreateOrgInput,
  UpdateOrgInput,
  OrgDTO,
  OrgSettings,
} from './organization.types.js';

const logger = createLogger({ name: 'organization-service' });
const tracer = trace.getTracer('organization-service');

const DEFAULT_SETTINGS: OrgSettings = {
  timezone: 'UTC',
  locale: 'en-US',
  currency: 'USD',
  dateFormat: 'YYYY-MM-DD',
};

export function toOrgDTO(org: Organization): OrgDTO {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(org.settings as Partial<OrgSettings>),
    },
    createdBy: org.createdBy,
    createdAt: org.createdAt.toISOString(),
    updatedAt: org.updatedAt.toISOString(),
  };
}

export class OrganizationService {
  constructor(private repo = new OrganizationRepository()) {}

  private get db() {
    return getDb();
  }

  async createOrganization(userId: string, input: CreateOrgInput): Promise<OrgDTO> {
    return withSpan(tracer, 'org.createOrganization', async (span) => {
      span.setAttribute('user.id', userId);
      span.setAttribute('organization.slug', input.slug);
      logger.info({ userId, slug: input.slug }, 'Creating organization');

      const existing = await this.repo.findBySlug(input.slug);
      if (existing) {
        throw new ConflictError(`Organization slug '${input.slug}' is already taken`);
      }

      const settings = {
        ...DEFAULT_SETTINGS,
        ...input.settings,
      };

      const result = await this.db.transaction(async (tx) => {
        // 1. Create Organization
        const org = await this.repo.create(
          {
            name: input.name,
            slug: input.slug,
            settings,
            createdBy: userId,
            status: 'ACTIVE',
          },
          tx,
        );

        span.setAttribute('organization.id', org.id);

        // 2. Ensure system permissions exist (upsert)
        for (const permKey of SYSTEM_PERMISSIONS) {
          await tx
            .insert(permissions)
            .values({ id: generateId(), key: permKey })
            .onConflictDoNothing({ target: permissions.key });
        }

        // Fetch all system permissions for role-permission mapping
        const permMap = new Map<string, string>(); // key -> permissionId
        const allPerms = await tx.select().from(permissions);
        allPerms.forEach((p) => permMap.set(p.key, p.id));

        // 3. Seed Org Roles & RolePermissions
        let adminRoleId: string | undefined;

        for (const [roleName, permKeys] of Object.entries(DEFAULT_ORG_ROLES)) {
          const createdRole = await tx
            .insert(roles)
            .values({
              id: generateId(),
              organizationId: org.id,
              name: roleName,
              isSystem: true,
            })
            .returning();

          const role = createdRole[0]!;
          if (roleName === 'Organization Admin') {
            adminRoleId = role.id;
          }

          // Link role permissions
          const rolePermValues = permKeys
            .map((k) => permMap.get(k))
            .filter((id): id is string => Boolean(id))
            .map((permissionId) => ({
              roleId: role.id,
              permissionId,
            }));

          if (rolePermValues.length > 0) {
            await tx.insert(rolePermissions).values(rolePermValues);
          }
        }

        if (!adminRoleId) {
          throw new Error('Failed to create Organization Admin role during org initialization');
        }

        // 4. Create Creator Membership (Organization Admin)
        await tx.insert(organizationMemberships).values({
          id: generateId(),
          organizationId: org.id,
          userId,
          roleId: adminRoleId,
          status: 'ACTIVE',
          joinedAt: new Date(),
        });

        // 5. Audit Log (same transaction)
        await auditService.log(
          {
            organizationId: org.id,
            actorUserId: userId,
            action: 'organization.created',
            resourceType: 'Organization',
            resourceId: org.id,
            metadata: { name: org.name, slug: org.slug },
          },
          tx,
        );

        return toOrgDTO(org);
      });

      return result;
    });
  }

  async getOrganization(id: string): Promise<OrgDTO> {
    return withSpan(tracer, 'org.getOrganization', async (span) => {
      span.setAttribute('organization.id', id);
      const org = await this.repo.findById(id);
      if (!org) throw new NotFoundError('Organization not found');
      return toOrgDTO(org);
    });
  }

  async listOrganizations(userId: string): Promise<OrgDTO[]> {
    return withSpan(tracer, 'org.listOrganizations', async (span) => {
      span.setAttribute('user.id', userId);
      const orgs = await this.repo.listByUserId(userId);
      return orgs.map(toOrgDTO);
    });
  }

  async updateOrganization(
    orgId: string,
    actorUserId: string,
    input: UpdateOrgInput,
  ): Promise<OrgDTO> {
    return withSpan(tracer, 'org.updateOrganization', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('user.id', actorUserId);

      const existing = await this.repo.findById(orgId);
      if (!existing) throw new NotFoundError('Organization not found');

      const updateData: Partial<Organization> = {};
      if (input.name) updateData.name = input.name;
      if (input.settings) {
        updateData.settings = {
          ...(existing.settings as Record<string, unknown>),
          ...input.settings,
        };
      }

      const updated = await this.db.transaction(async (tx) => {
        const result = await this.repo.update(orgId, updateData, tx);
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'organization.updated',
            resourceType: 'Organization',
            resourceId: orgId,
            metadata: input as Record<string, unknown>,
          },
          tx,
        );
        return result!;
      });

      return toOrgDTO(updated);
    });
  }

  async updateSettings(
    orgId: string,
    actorUserId: string,
    newSettings: Partial<OrgSettings>,
  ): Promise<OrgSettings> {
    return withSpan(tracer, 'org.updateSettings', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('user.id', actorUserId);

      const existing = await this.repo.findById(orgId);
      if (!existing) throw new NotFoundError('Organization not found');

      const mergedSettings = {
        ...DEFAULT_SETTINGS,
        ...(existing.settings as Partial<OrgSettings>),
        ...newSettings,
      };

      await this.db.transaction(async (tx) => {
        await this.repo.update(orgId, { settings: mergedSettings }, tx);
        await auditService.log(
          {
            organizationId: orgId,
            actorUserId,
            action: 'settings.updated',
            resourceType: 'OrganizationSettings',
            resourceId: orgId,
            metadata: newSettings as Record<string, unknown>,
          },
          tx,
        );
      });

      return mergedSettings;
    });
  }
}
