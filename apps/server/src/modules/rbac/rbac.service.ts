// apps/server/src/modules/rbac/rbac.service.ts
import { trace } from '@opentelemetry/api';
import { withSpan } from '@siteflow/observability/server';
import { RbacRepository } from './rbac.repository.js';
import { rbacCacheService, RbacCacheService } from './rbac.cache.service.js';
import type { OrganizationContext } from './rbac.types.js';
import { ForbiddenError } from '../auth/auth.errors.js';

const tracer = trace.getTracer('rbac-service');

export class RbacService {
  constructor(
    private repo = new RbacRepository(),
    private cache: RbacCacheService = rbacCacheService,
  ) {}

  async getOrganizationContext(
    orgId: string,
    userId: string,
  ): Promise<OrganizationContext> {
    return withSpan(tracer, 'rbac.getOrganizationContext', async (span) => {
      span.setAttribute('organization.id', orgId);
      span.setAttribute('user.id', userId);

      const res = await this.repo.findActiveMembershipWithOrgStatus(orgId, userId);
      if (!res) {
        throw new ForbiddenError('Not a member of this organization');
      }

      if (res.orgStatus !== 'ACTIVE') {
        throw new ForbiddenError('Organization is suspended or archived');
      }

      const membership = res.membership;

      span.setAttribute('membership.id', membership.id);
      span.setAttribute('role.id', membership.roleId);

      // 1. Try cache
      let permissions = await this.cache.getPermissions(orgId, userId);

      if (permissions) {
        span.setAttribute('cache.hit', true);
      } else {
        span.setAttribute('cache.hit', false);
        // 2. Miss or unavailable → DB
        permissions = await this.repo.getPermissionsForMembership(membership.id);
        // 3. Populate cache only on successful DB read
        await this.cache.setPermissions(orgId, userId, permissions);
      }

      return {
        organizationId: orgId,
        membershipId: membership.id,
        userId,
        roleId: membership.roleId,
        permissions,
      };
    });
  }

  hasPermission(ctx: OrganizationContext, requiredPermission: string): boolean {
    return ctx.permissions.includes(requiredPermission);
  }
}

export const rbacService = new RbacService();
