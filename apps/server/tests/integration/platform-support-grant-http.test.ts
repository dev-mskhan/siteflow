// apps/server/tests/integration/platform-support-grant-http.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../src/lib/db/index.js';
import {
  users,
  platformUserRoles,
  platformSupportGrants,
  organizations,
  auditLogs,
} from '@siteflow/database/schema';
import { createTestApp } from '../helpers/test-app.js';
import { createVerifiedUser, createOrgWithAdmin } from '../helpers/fixtures.js';
import { PlatformRbacRepository } from '../../src/modules/platform/platform-rbac.repository.js';

const ADMIN_ROLE_ID = 'prole_admin';
const SUPPORT_ROLE_ID = 'prole_support';
const BASE = '/api/v1/platform/support-grants';

const reauth = { password: 'password123' };

describe('platform support grants HTTP (Phase 11-05)', () => {
  let app: FastifyInstance;
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const rbac = new PlatformRbacRepository();

  let owner: { user: { id: string }; token: string };
  let orgId: string;
  let admin1: { user: { id: string }; token: string };
  let admin2: { user: { id: string }; token: string };
  let support: { user: { id: string }; token: string };
  let support2: { user: { id: string }; token: string };

  beforeAll(async () => {
    app = await createTestApp();

    async function newUser(label: string) {
      const u = await createVerifiedUser({ firstName: label });
      createdUserIds.push(u.user.id);
      return u;
    }

    owner = await newUser('grant-org-owner');
    const org = await createOrgWithAdmin(app, owner.token);
    orgId = org.orgId;
    createdOrgIds.push(orgId);

    admin1 = await newUser('grant-admin-1');
    admin2 = await newUser('grant-admin-2');
    support = await newUser('grant-support-1');
    support2 = await newUser('grant-support-2');

    await rbac.grantPlatformRole(admin1.user.id, ADMIN_ROLE_ID);
    await rbac.grantPlatformRole(admin2.user.id, ADMIN_ROLE_ID);
    await rbac.grantPlatformRole(support.user.id, SUPPORT_ROLE_ID);
    await rbac.grantPlatformRole(support2.user.id, SUPPORT_ROLE_ID);
  });

  afterAll(async () => {
    const db = getDb();
    if (createdUserIds.length > 0) {
      await db
        .delete(platformSupportGrants)
        .where(inArray(platformSupportGrants.operatorUserId, createdUserIds));
      await db
        .delete(platformUserRoles)
        .where(inArray(platformUserRoles.userId, createdUserIds));
    }
    if (createdOrgIds.length > 0) {
      await db.delete(auditLogs).where(inArray(auditLogs.organizationId, createdOrgIds));
      await db.delete(organizations).where(inArray(organizations.id, createdOrgIds));
    }
    if (createdUserIds.length > 0) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
    await app.close();
  });

  async function requestGrant(
    token: string,
    scopes: string[],
    operatorUserId = support.user.id,
  ) {
    return app.inject({
      method: 'POST',
      url: BASE,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        ...reauth,
        reasonCode: 'CUSTOMER_REQUEST',
        reasonNote: 'Support case reference SUP-1001',
        operatorUserId,
        organizationId: orgId,
        scopes,
      },
    });
  }

  async function latestGrantId(operatorUserId: string) {
    const rows = await getDb()
      .select({ id: platformSupportGrants.id })
      .from(platformSupportGrants)
      .where(
        and(
          eq(platformSupportGrants.operatorUserId, operatorUserId),
          eq(platformSupportGrants.organizationId, orgId),
        ),
      )
      .orderBy(desc(platformSupportGrants.requestedAt));
    return rows[0]!.id;
  }

  async function grantStatus(grantId: string) {
    const rows = await getDb()
      .select({ status: platformSupportGrants.status })
      .from(platformSupportGrants)
      .where(eq(platformSupportGrants.id, grantId));
    return rows[0]!.status;
  }

  it('rejects unauthenticated grant requests', async () => {
    const res = await app.inject({
      method: 'POST',
      url: BASE,
      payload: {},
    });
    expect([401, 403]).toContain(res.statusCode);
  });

  it('denies an organization owner with no platform role', async () => {
    const res = await requestGrant(owner.token, ['read:org_summary']);
    expect(res.statusCode).toBe(403);
  });

  it('denies a support operator from requesting grants (lacks manage:support_grants)', async () => {
    const res = await requestGrant(support.token, ['read:org_summary']);
    expect(res.statusCode).toBe(403);
  });

  it('rejects sensitive or unknown scopes at request time', async () => {
    const res = await requestGrant(admin1.token, ['export:confidential_data']);
    expect(res.statusCode).toBe(422);
  });

  it('rejects self-approval (requester cannot approve own grant)', async () => {
    const req = await requestGrant(admin1.token, ['read:org_summary']);
    expect(req.statusCode).toBe(201);
    const grantId = await latestGrantId(support.user.id);

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/${grantId}/approve`,
      headers: { authorization: `Bearer ${admin1.token}` },
      payload: { ...reauth, durationMinutes: 30 },
    });
    expect(res.statusCode).toBeGreaterThanOrEqual(400);
    expect(await grantStatus(grantId)).toBe('pending');
  });

  it('rejects durations above the 24-hour cap', async () => {
    const req = await requestGrant(admin1.token, ['read:org_summary']);
    expect(req.statusCode).toBe(201);
    const grantId = await latestGrantId(support.user.id);

    const res = await app.inject({
      method: 'POST',
      url: `${BASE}/${grantId}/approve`,
      headers: { authorization: `Bearer ${admin2.token}` },
      payload: { ...reauth, durationMinutes: 1441 },
    });
    expect(res.statusCode).toBe(422);
  });

  it('approved grant allows only its granted scope and operator, and revocation blocks access', async () => {
    const req = await requestGrant(admin1.token, ['read:org_summary']);
    expect(req.statusCode).toBe(201);
    const grantId = await latestGrantId(support.user.id);

    const approve = await app.inject({
      method: 'POST',
      url: `${BASE}/${grantId}/approve`,
      headers: { authorization: `Bearer ${admin2.token}` },
      payload: { ...reauth, durationMinutes: 30 },
    });
    expect(approve.statusCode).toBe(200);
    expect(await grantStatus(grantId)).toBe('active');

    const ok = await app.inject({
      method: 'GET',
      url: `${BASE}/${grantId}/organization?scope=read:org_summary`,
      headers: { authorization: `Bearer ${support.token}` },
    });
    expect(ok.statusCode).toBe(200);

    const wrongScope = await app.inject({
      method: 'GET',
      url: `${BASE}/${grantId}/organization?scope=read:org_subscription`,
      headers: { authorization: `Bearer ${support.token}` },
    });
    expect(wrongScope.statusCode).toBe(403);

    const otherOperator = await app.inject({
      method: 'GET',
      url: `${BASE}/${grantId}/organization?scope=read:org_summary`,
      headers: { authorization: `Bearer ${support2.token}` },
    });
    expect(otherOperator.statusCode).toBe(403);

    const revoke = await app.inject({
      method: 'POST',
      url: `${BASE}/${grantId}/revoke`,
      headers: { authorization: `Bearer ${admin2.token}` },
      payload: reauth,
    });
    expect(revoke.statusCode).toBe(200);
    expect(await grantStatus(grantId)).toBe('revoked');

    const afterRevoke = await app.inject({
      method: 'GET',
      url: `${BASE}/${grantId}/organization?scope=read:org_summary`,
      headers: { authorization: `Bearer ${support.token}` },
    });
    expect(afterRevoke.statusCode).toBe(403);
  });
});
