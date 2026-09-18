// apps/server/tests/unit/organization/organization.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OrganizationService } from '../../../src/modules/organization/organization.service.js';
import { ConflictError, NotFoundError } from '../../../src/modules/organization/organization.errors.js';

describe('OrganizationService (Unit)', () => {
  let mockRepo: any;
  let orgService: OrganizationService;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      listByUserId: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    orgService = new OrganizationService(mockRepo);
  });

  it('should throw ConflictError if organization slug is already taken', async () => {
    mockRepo.findBySlug.mockResolvedValue({
      id: 'existing-org',
      name: 'Existing Org',
      slug: 'acme-corp',
    });

    await expect(
      orgService.createOrganization('user-123', {
        name: 'New Acme Corp',
        slug: 'acme-corp',
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('should throw NotFoundError if getting an un-existing organization', async () => {
    mockRepo.findById.mockResolvedValue(undefined);

    await expect(orgService.getOrganization('non-existing-id')).rejects.toThrow(NotFoundError);
  });
});
