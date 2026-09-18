// apps/server/src/modules/rbac/rbac.service.ts
import { RbacRepository } from './rbac.repository.js';
import { rbacCacheService, RbacCacheService } from './rbac.cache.service.js';
import type { OrganizationContext } from './rbac.types.js';
import { ForbiddenError } from '../auth/auth.errors.js';

export class RbacService {
  constructor(
    private repo = new RbacRepository(),
    private cache: RbacCacheService = rbacCacheService,
  ) {}

  async getOrganizationContext(
    orgId: string,
    userId: string,
  ): Promise<OrganizationContext> {
    const membership = await this.repo.findActiveMembership(orgId, userId);
    if (!membership) {
      throw new ForbiddenError('Not a member of this organization');
    }

    // 1. Try cache
    let permissions = await this.cache.getPermissions(orgId, userId);

    // 2. Miss or unavailable → DB
    if (!permissions) {
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
  }

  hasPermission(ctx: OrganizationContext, requiredPermission: string): boolean {
    return ctx.permissions.includes(requiredPermission);
  }
}

export const rbacService = new RbacService();
