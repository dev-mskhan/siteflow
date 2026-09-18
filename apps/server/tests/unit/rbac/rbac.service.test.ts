// apps/server/tests/unit/rbac/rbac.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RbacService } from '../../../src/modules/rbac/rbac.service.js';
import { ForbiddenError } from '../../../src/modules/auth/auth.errors.js';

describe('RbacService (Unit)', () => {
  let mockRepo: any;
  let mockCache: any;
  let rbacService: RbacService;

  beforeEach(() => {
    mockRepo = {
      findActiveMembership: vi.fn(),
      getPermissionsForMembership: vi.fn(),
    };
    mockCache = {
      getPermissions: vi.fn(),
      setPermissions: vi.fn(),
      invalidate: vi.fn(),
      invalidateOrg: vi.fn(),
    };
    rbacService = new RbacService(mockRepo, mockCache);
  });

  it('should throw ForbiddenError if active membership is not found', async () => {
    mockRepo.findActiveMembership.mockResolvedValue(undefined);

    await expect(
      rbacService.getOrganizationContext('org-123', 'user-456'),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should return context from cache on cache hit', async () => {
    mockRepo.findActiveMembership.mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-123',
      userId: 'user-456',
      roleId: 'role-789',
      status: 'ACTIVE',
    });
    mockCache.getPermissions.mockResolvedValue(['organization:read', 'member:read']);

    const ctx = await rbacService.getOrganizationContext('org-123', 'user-456');

    expect(ctx.organizationId).toBe('org-123');
    expect(ctx.permissions).toEqual(['organization:read', 'member:read']);
    expect(mockRepo.getPermissionsForMembership).not.toHaveBeenCalled();
  });

  it('should query DB and populate cache on cache miss', async () => {
    mockRepo.findActiveMembership.mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-123',
      userId: 'user-456',
      roleId: 'role-789',
      status: 'ACTIVE',
    });
    mockCache.getPermissions.mockResolvedValue(null);
    mockRepo.getPermissionsForMembership.mockResolvedValue(['organization:read', 'organization:update']);

    const ctx = await rbacService.getOrganizationContext('org-123', 'user-456');

    expect(ctx.permissions).toEqual(['organization:read', 'organization:update']);
    expect(mockRepo.getPermissionsForMembership).toHaveBeenCalledWith('mem-1');
    expect(mockCache.setPermissions).toHaveBeenCalledWith('org-123', 'user-456', [
      'organization:read',
      'organization:update',
    ]);
  });

  it('should evaluate permissions correctly using hasPermission', () => {
    const ctx = {
      organizationId: 'org-123',
      membershipId: 'mem-1',
      userId: 'user-456',
      roleId: 'role-789',
      permissions: ['organization:read', 'member:read'],
    };

    expect(rbacService.hasPermission(ctx, 'organization:read')).toBe(true);
    expect(rbacService.hasPermission(ctx, 'organization:update')).toBe(false);
  });
});
