// apps/server/tests/unit/organization/organization.service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the DB module before importing anything that depends on it
vi.mock('../../../src/lib/db/index.js', () => {
  const mockTx = {
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi
          .fn()
          .mockResolvedValue([
            {
              id: 'new-org-id',
              name: 'New Org',
              slug: 'new-org',
              status: 'ACTIVE',
              createdBy: 'user-123',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ]),
        onConflictDoNothing: vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([]) }),
      }),
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ emailVerifiedAt: new Date() }]),
        }),
      }),
    }),
    execute: vi.fn().mockResolvedValue(undefined),
  };

  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([{ emailVerifiedAt: new Date() }]),
        }),
      }),
    }),
    transaction: vi.fn().mockImplementation(async (fn: (tx: any) => Promise<any>) => fn(mockTx)),
  };

  return {
    getDb: vi.fn(() => mockDb),
    db: mockDb,
  };
});

// Mock audit service to avoid DB calls
vi.mock('../../../src/modules/audit/audit.service.js', () => ({
  auditService: {
    log: vi.fn().mockResolvedValue(undefined),
  },
}));

import { OrganizationService } from '../../../src/modules/organization/organization.service.js';
import {
  ConflictError,
  NotFoundError,
} from '../../../src/modules/organization/organization.errors.js';

describe('OrganizationService (Unit)', () => {
  let mockRepo: any;
  let orgService: OrganizationService;

  beforeEach(() => {
    mockRepo = {
      findById: vi.fn(),
      findBySlug: vi.fn(),
      listByUserId: vi.fn(),
      countByCreator: vi.fn().mockResolvedValue(0),
      create: vi.fn().mockResolvedValue({
        id: 'new-org-id',
        name: 'New Org',
        slug: 'new-org',
        status: 'ACTIVE',
        createdBy: 'user-123',
        createdAt: new Date(),
        updatedAt: new Date(),
      }),
      update: vi.fn(),
    };
    orgService = new OrganizationService(mockRepo);
  });

  it('should throw ConflictError if organization slug is already taken', async () => {
    // Slug exists on first check, and still exists on retry attempts
    mockRepo.findBySlug.mockResolvedValue({
      id: 'existing-org',
      name: 'Existing Org',
      slug: 'acme-corp',
    });

    await expect(
      orgService.createOrganization('user-123', {
        name: 'New Acme Corp',
        slug: 'acme-corp', // explicit slug — no auto-suffix retries
      }),
    ).rejects.toThrow(ConflictError);
  });

  it('should throw NotFoundError if getting an un-existing organization', async () => {
    mockRepo.findById.mockResolvedValue(undefined);

    await expect(orgService.getOrganization('non-existing-id')).rejects.toThrow(NotFoundError);
  });
});
