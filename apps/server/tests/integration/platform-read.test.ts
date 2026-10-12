// apps/server/tests/integration/platform-read.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../src/lib/db/index.js';
import {
  users,
  organizations,
  organizationMemberships,
  roles,
} from '@siteflow/database/schema';
import { PlatformReadRepository, maskEmail } from '../../src/modules/platform/platform-read.repository.js';

describe('platform read repository (Phase 11-02)', () => {
  const repo = new PlatformReadRepository();
  const tag = randomUUID().slice(0, 8);
  const userIds: string[] = [];
  const orgIds: string[] = [];
  const roleIds: string[] = [];
  const slugPrefix = `plat-read-${tag}`;
  let ownerUserId: string;
  let memberUserId: string;

  beforeAll(async () => {
    const db = getDb();
    ownerUserId = `test-plat-read-owner-${tag}`;
    memberUserId = `test-plat-read-member-${tag}`;
    await db.insert(users).values([
      { id: ownerUserId, email: `owner.${tag}@example.test`, firstName: 'Owner', passwordHash: 'secret-hash' },
      { id: memberUserId, email: `member.${tag}@example.test`, firstName: 'Member', passwordHash: null },
    ]);
    userIds.push(ownerUserId, memberUserId);

    for (let i = 0; i < 3; i++) {
      const orgId = `test-plat-read-org-${tag}-${i}`;
      await db.insert(organizations).values({
        id: orgId,
        name: `Org ${i}`,
        slug: `${slugPrefix}-${i}`,
        createdBy: ownerUserId,
      });
      orgIds.push(orgId);

      const roleId = `test-plat-read-role-${tag}-${i}`;
      await db.insert(roles).values({
        id: roleId,
        organizationId: orgId,
        name: 'Organization Admin',
        isSystem: true,
      });
      roleIds.push(roleId);

      await db.insert(organizationMemberships).values({
        id: `test-plat-read-mem-owner-${tag}-${i}`,
        organizationId: orgId,
        userId: ownerUserId,
        roleId,
        status: 'ACTIVE',
      });
      if (i === 0) {
        await db.insert(organizationMemberships).values({
          id: `test-plat-read-mem-member-${tag}-${i}`,
          organizationId: orgId,
          userId: memberUserId,
          roleId,
          status: 'ACTIVE',
        });
      }
    }
  });

  afterAll(async () => {
    const db = getDb();
    if (orgIds.length) await db.delete(organizations).where(inArray(organizations.id, orgIds));
    if (roleIds.length) await db.delete(roles).where(inArray(roles.id, roleIds));
    if (userIds.length) await db.delete(users).where(inArray(users.id, userIds));
  });

  it('masks emails without exposing the local part', () => {
    expect(maskEmail('alice@example.com')).toBe('a***@example.com');
    expect(maskEmail('not-an-email')).toBe('***');
  });

  it('paginates organizations with keyset cursors without overlap', async () => {
    const first = await repo.listOrganizations({ limit: 2, search: slugPrefix });
    expect(first.rows).toHaveLength(2);
    expect(first.hasMore).toBe(true);

    const last = first.rows[first.rows.length - 1]!;
    const second = await repo.listOrganizations({
      limit: 2,
      search: slugPrefix,
      cursor: { createdAt: last.createdAt, id: last.id },
    });
    expect(second.rows).toHaveLength(1);
    expect(second.hasMore).toBe(false);

    const seen = [...first.rows, ...second.rows].map((r) => r.id);
    expect(new Set(seen).size).toBe(3);
  });

  it('resolves owner from the Organization Admin membership and counts active members', async () => {
    const page = await repo.listOrganizations({ limit: 10, search: slugPrefix });
    const withMember = page.rows.find((r) => r.id === orgIds[0])!;
    expect(withMember.memberCount).toBe(2);
    expect(withMember.ownerUserId).toBe(ownerUserId);
    expect(withMember.ownerEmailMasked).toBe(maskEmail(`owner.${tag}@example.test`));

    const other = page.rows.find((r) => r.id === orgIds[1])!;
    expect(other.memberCount).toBe(1);
  });

  it('returns accounts with masked email and no credential fields', async () => {
    const page = await repo.listAccounts({ limit: 100, emailPrefix: `owner.${tag}` });
    expect(page.rows).toHaveLength(1);
    const row = page.rows[0]!;
    expect(row.emailMasked).toBe(maskEmail(`owner.${tag}@example.test`));
    expect(row.membershipCount).toBe(3);
    expect(Object.keys(row)).not.toContain('passwordHash');
    expect(JSON.stringify(row)).not.toContain('secret-hash');
  });
});
