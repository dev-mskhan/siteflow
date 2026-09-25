// apps/server/src/modules/organization/organization.service.ts
import { eq } from 'drizzle-orm';
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
  organizationProfiles,
  organizationSettings,
  documentSequences,
  users,
  type Organization,
} from '@siteflow/database/schema';
import { ConflictError, NotFoundError, ForbiddenError } from './organization.errors.js';
import type { CreateOrgInput, UpdateOrgInput, OrgDTO } from './organization.types.js';
import { DEFAULT_DOCUMENT_SEQUENCES } from './sequences/sequences.seed.js';

const logger = createLogger({ name: 'organization-service' });
const tracer = trace.getTracer('organization-service');

/**
 * Derives a URL-safe slug from an organization name.
 * Example: "Khan Construction LLC" → "khan-construction-llc"
 */
function deriveSlug(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // remove non-alphanumeric except spaces and hyphens
    .replace(/\s+/g, '-')          // spaces → hyphens
    .replace(/-+/g, '-')           // collapse multiple hyphens
    .replace(/^-|-$/g, '')         // strip leading/trailing hyphens
    .substring(0, 50);             // truncate to 50 chars
}

const MAX_ORGS_PER_USER = 5;

export function toOrgDTO(org: Organization): OrgDTO {
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    status: org.status,
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
      span.setAttribute('organization.slug', input.slug ?? deriveSlug(input.name));
      logger.info({ userId, slug: input.slug }, 'Creating organization');

      // Guard 1: email must be verified
      const creator = await this.db
        .select({ emailVerifiedAt: users.emailVerifiedAt })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      if (!creator[0] || !creator[0].emailVerifiedAt) {
        throw new ForbiddenError('You must verify your email address before creating an organization');
      }

      // Guard 2: org cap per user
      const orgCount = await this.repo.countByCreator(userId);
      if (orgCount >= MAX_ORGS_PER_USER) {
        throw new ForbiddenError(`You have reached the maximum limit of ${MAX_ORGS_PER_USER} organizations`);
      }

      // Derive slug from name if not provided
      let slug = input.slug ? input.slug.toLowerCase().trim() : deriveSlug(input.name);

      // Ensure slug is unique — try up to 10 suffixes on collision
      const baseSlug = slug;
      let attempt = 0;
      while (true) {
        const existing = await this.repo.findBySlug(slug);
        if (!existing) break;
        attempt++;
        if (attempt > 10) {
          throw new ConflictError(`Could not generate a unique slug for '${baseSlug}'. Please provide one explicitly.`);
        }
        slug = `${baseSlug}-${attempt + 1}`;
      }

      const result = await this.db.transaction(async (tx) => {
        // 1. Create Organization row
        const org = await this.repo.create(
          {
            name: input.name,
            slug, // ← resolved slug, not input.slug
            createdBy: userId,
            status: 'ACTIVE',
          },
          tx,
        );

        span.setAttribute('organization.id', org.id);

        // 1b. Create empty Organization Profile
        await tx.insert(organizationProfiles).values({
          organizationId: org.id,
        });

        // 1c. Create Organization Settings with defaults
        await tx.insert(organizationSettings).values({
          organizationId: org.id,
          // All other fields use column defaults (UTC, USD, en-US, etc.)
        });

        // 1d. Seed Document Sequences (7 types)
        for (const seq of DEFAULT_DOCUMENT_SEQUENCES) {
          await tx.insert(documentSequences).values({
            id: generateId(),
            organizationId: org.id,
            type: seq.type,
            prefix: seq.prefix,
            padding: seq.padding,
            nextValue: 1,
          });
        }

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
}
