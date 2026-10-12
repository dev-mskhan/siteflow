// apps/server/tests/integration/platform-rbac.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { getDb } from '../../src/lib/db/index.js';
import { users, platformUserRoles } from '@siteflow/database/schema';
import { requirePlatformPermission } from '../../src/modules/platform/platform-permission.middleware.js';
import { PlatformRbacRepository } from '../../src/modules/platform/platform-rbac.repository.js';

const SUPPORT_ROLE_ID = 'prole_support';

describe('platform RBAC guard (Phase 11-01)', () => {
  let app: FastifyInstance;
  const createdUserIds: string[] = [];

  async function createUser(label: string): Promise<string> {
    const id = `test-plat-${label}-${randomUUID()}`;
    await getDb()
      .insert(users)
      .values({
        id,
        email: `${id}@example.test`,
        firstName: label,
        passwordHash: null,
      });
    createdUserIds.push(id);
    return id;
  }

  beforeAll(async () => {
    app = Fastify();
    app.addHook('onRequest', async (request) => {
      const sub = request.headers['x-test-user'];
      if (typeof sub === 'string') {
        request.user = { sub } as typeof request.user;
      }
    });
    app.get(
      '/platform/organizations',
      { preHandler: requirePlatformPermission('read:organizations') },
      async () => ({ ok: true }),
    );
    app.get(
      '/platform/billing',
      { preHandler: requirePlatformPermission('read:billing') },
      async () => ({ ok: true }),
    );
    await app.ready();
  });

  afterAll(async () => {
    if (createdUserIds.length > 0) {
      await getDb()
        .delete(platformUserRoles)
        .where(inArray(platformUserRoles.userId, createdUserIds));
      await getDb().delete(users).where(inArray(users.id, createdUserIds));
    }
    await app.close();
  });

  it('denies a user with no platform role (deny-by-default, no org membership consulted)', async () => {
    const userId = await createUser('no-role');
    const res = await app.inject({
      method: 'GET',
      url: '/platform/organizations',
      headers: { 'x-test-user': userId },
    });
    expect(res.statusCode).toBe(403);
  });

  it('rejects a request with no authenticated user', async () => {
    const res = await app.inject({ method: 'GET', url: '/platform/organizations' });
    expect(res.statusCode).toBe(401);
  });

  it('allows platform_support to read organizations', async () => {
    const userId = await createUser('support');
    await getDb()
      .insert(platformUserRoles)
      .values({ userId, platformRoleId: SUPPORT_ROLE_ID });

    const res = await app.inject({
      method: 'GET',
      url: '/platform/organizations',
      headers: { 'x-test-user': userId },
    });
    expect(res.statusCode).toBe(200);
  });

  it('denies platform_support billing access (role has only read:organizations)', async () => {
    const userId = await createUser('support-billing');
    await getDb()
      .insert(platformUserRoles)
      .values({ userId, platformRoleId: SUPPORT_ROLE_ID });

    const res = await app.inject({
      method: 'GET',
      url: '/platform/billing',
      headers: { 'x-test-user': userId },
    });
    expect(res.statusCode).toBe(403);
  });

  it('denies a revoked platform grant', async () => {
    const userId = await createUser('revoked');
    await getDb()
      .insert(platformUserRoles)
      .values({
        userId,
        platformRoleId: SUPPORT_ROLE_ID,
        grantedAt: new Date(Date.now() - 60_000),
        revokedAt: new Date(),
      });

    const res = await app.inject({
      method: 'GET',
      url: '/platform/organizations',
      headers: { 'x-test-user': userId },
    });
    expect(res.statusCode).toBe(403);
  });

  it('enforces one active grant per user and role', async () => {
    const userId = await createUser('dup-grant');
    await getDb()
      .insert(platformUserRoles)
      .values({ userId, platformRoleId: SUPPORT_ROLE_ID });

    await expect(
      getDb().insert(platformUserRoles).values({ userId, platformRoleId: SUPPORT_ROLE_ID }),
    ).rejects.toThrow();

    const rows = await getDb()
      .select({ userId: platformUserRoles.userId })
      .from(platformUserRoles)
      .where(eq(platformUserRoles.userId, userId));
    expect(rows).toHaveLength(1);
  });

  it('revocation invalidates the cached permission immediately', async () => {
    const userId = await createUser('cache-revoke');
    const repo = new PlatformRbacRepository();
    await repo.grantPlatformRole(userId, SUPPORT_ROLE_ID);

    const before = await app.inject({
      method: 'GET',
      url: '/platform/organizations',
      headers: { 'x-test-user': userId },
    });
    expect(before.statusCode).toBe(200);

    await repo.revokePlatformRole(userId, SUPPORT_ROLE_ID);

    const after = await app.inject({
      method: 'GET',
      url: '/platform/organizations',
      headers: { 'x-test-user': userId },
    });
    expect(after.statusCode).toBe(403);
  });

  it('bootstrap grants platform_admin once and is idempotent', async () => {
    const userId = await createUser('bootstrap');
    const email = `${userId}@example.test`;
    const repo = new PlatformRbacRepository();

    expect(await repo.bootstrapPlatformOperator(email)).toBe(true);
    expect(await repo.bootstrapPlatformOperator(email)).toBe(true);
    expect(await repo.bootstrapPlatformOperator(undefined)).toBe(false);

    const rows = await getDb()
      .select({ id: platformUserRoles.platformRoleId })
      .from(platformUserRoles)
      .where(eq(platformUserRoles.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe('prole_admin');
  });
});
