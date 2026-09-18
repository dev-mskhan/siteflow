// apps/server/tests/unit/membership/membership.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MembershipService } from '../../../src/modules/membership/membership.service.js';
import { ForbiddenError, ValidationError, NotFoundError } from '../../../src/modules/membership/membership.errors.js';

describe('MembershipService (Unit)', () => {
  let mockRepo: any;
  let membershipService: MembershipService;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findByOrgAndUser: vi.fn(),
      findByOrg: vi.fn(),
      findMemberWithDetails: vi.fn(),
      countActiveAdmins: vi.fn(),
      update: vi.fn(),
      softRemove: vi.fn(),
    };
    membershipService = new MembershipService(mockRepo);
  });

  it('should throw ForbiddenError if member does not belong to target organization', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'mem-1',
      organizationId: 'org-A',
      userId: 'user-1',
      status: 'ACTIVE',
    });

    const actorCtx = {
      organizationId: 'org-B',
      membershipId: 'actor-mem',
      userId: 'actor-user',
      roleId: 'role-1',
      permissions: ['member:remove'],
    };

    await expect(
      membershipService.removeMember('org-B', 'mem-1', actorCtx),
    ).rejects.toThrow(ForbiddenError);
  });

  it('should throw ValidationError when attempting to remove the last Organization Admin', async () => {
    mockRepo.findById.mockResolvedValue({
      id: 'admin-mem-1',
      organizationId: 'org-A',
      userId: 'admin-user',
      roleId: 'admin-role',
      status: 'ACTIVE',
    });
    mockRepo.countActiveAdmins.mockResolvedValue(1);

    const actorCtx = {
      organizationId: 'org-A',
      membershipId: 'admin-mem-1',
      userId: 'admin-user',
      roleId: 'admin-role',
      permissions: ['member:remove'],
    };

    await expect(
      membershipService.removeMember('org-A', 'admin-mem-1', actorCtx),
    ).rejects.toThrow(ValidationError);
  });
});
