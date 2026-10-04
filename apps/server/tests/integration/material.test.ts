import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import { auditLogs, materials, permissions, rolePermissions } from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { getRedis } from '../../src/lib/redis/redis.js';
import { rbacCacheService } from '../../src/modules/rbac/rbac.cache.service.js';
import { createTestApp } from '../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';

const runId = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
const catalogPermissions = ['material:create', 'material:read', 'material:update'];

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

function materialPayload(seed: string, overrides: Record<string, unknown> = {}) {
  return {
    materialCode: `mat-${seed}`,
    name: `Material ${seed}`,
    description: `Description for ${seed}`,
    category: 'PIPING',
    defaultUnitCode: 'ea',
    materialType: 'MATERIAL',
    defaultCurrencyCode: 'usd',
    ...overrides,
  };
}

async function grantMaterialPermissions(roleId: string, organizationId: string) {
  const db = getDb();
  await db
    .insert(permissions)
    .values(catalogPermissions.map((key) => ({ id: crypto.randomUUID(), key })))
    .onConflictDoNothing({ target: permissions.key });

  const permissionRows = await db
    .select({ id: permissions.id })
    .from(permissions)
    .where(inArray(permissions.key, catalogPermissions));
  await db
    .insert(rolePermissions)
    .values(permissionRows.map(({ id }) => ({ roleId, permissionId: id })))
    .onConflictDoNothing();

  await rbacCacheService.invalidateRolePermissions(roleId);
  await rbacCacheService.invalidateOrg(organizationId);
}

describe('Material catalog routes', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;
  let orgId: string;
  let otherOrgId: string;
  let otherOrgToken: string;
  let outsiderToken: string;

  const createMaterial = async (
    payload: Record<string, unknown>,
    token = adminToken,
    targetOrgId = orgId,
  ) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${targetOrgId}/materials`,
      headers: authHeader(token),
      payload,
    });

  const listMaterials = (targetOrgId = orgId, query = '', token = adminToken) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${targetOrgId}/materials${query}`,
      headers: authHeader(token),
    });

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await createVerifiedUser({ email: `material-admin-${runId}@example.com` });
    adminToken = admin.token;
    adminUserId = admin.user.id;
    const ownOrg = await createOrgWithAdmin(app, adminToken, `Material Org ${runId}`);
    orgId = ownOrg.orgId;
    await grantMaterialPermissions(ownOrg.roleMap.get('Organization Admin')!, orgId);

    const otherUser = await createVerifiedUser({ email: `material-other-${runId}@example.com` });
    otherOrgToken = otherUser.token;
    const otherOrg = await createOrgWithAdmin(app, otherOrgToken, `Material Other Org ${runId}`);
    otherOrgId = otherOrg.orgId;
    await grantMaterialPermissions(otherOrg.roleMap.get('Organization Admin')!, otherOrgId);

    const outsider = await createVerifiedUser({ email: `material-outsider-${runId}@example.com` });
    outsiderToken = outsider.token;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('creates and persists a material with a normalized material code and unit', async () => {
    const payload = materialPayload(`full-${runId}`);
    const response = await createMaterial(payload);

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data).toMatchObject({
      organizationId: orgId,
      materialCode: `MAT-FULL-${runId.toUpperCase()}`,
      name: payload.name,
      defaultUnitCode: 'EA',
      materialType: 'MATERIAL',
      status: 'ACTIVE',
    });

    const [row] = await getDb().select().from(materials).where(
      and(eq(materials.id, body.data.id), eq(materials.organizationId, orgId)),
    );
    expect(row).toMatchObject({
      organizationId: orgId,
      materialCode: `MAT-FULL-${runId.toUpperCase()}`,
      name: payload.name,
      defaultUnitCode: 'EA',
      materialType: 'MATERIAL',
      status: 'ACTIVE',
    });

    const [audit] = await getDb().select().from(auditLogs).where(
      and(
        eq(auditLogs.action, 'material.created'),
        eq(auditLogs.organizationId, orgId),
        eq(auditLogs.resourceId, body.data.id),
      ),
    );
    expect(audit).toMatchObject({
      organizationId: orgId,
      actorUserId: adminUserId,
      action: 'material.created',
      resourceType: 'Material',
      resourceId: body.data.id,
    });
  });

  it('enforces material-code uniqueness within an org but isolates different orgs', async () => {
    const payload = materialPayload(`duplicate-${runId}`);
    expect((await createMaterial(payload)).statusCode).toBe(201);
    const duplicate = await createMaterial(payload);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().success).toBe(false);

    const crossOrg = await createMaterial(payload, otherOrgToken, otherOrgId);
    expect(crossOrg.statusCode).toBe(201);
    expect(crossOrg.json().data.organizationId).toBe(otherOrgId);
  });

  it.each([
    ['missing materialCode', { name: `Missing ${runId}`, category: 'PIPING', defaultUnitCode: 'EA' }],
    [
      'invalid materialType enum',
      { materialCode: `bad-type-${runId}`, name: `Bad ${runId}`, defaultUnitCode: 'EA', materialType: 'INVALID' },
    ],
    ['missing defaultUnitCode', { materialCode: `missing-unit-${runId}`, name: `Bad ${runId}` }],
  ])('rejects material creation with %s', async (_scenario, payload) => {
    const response = await createMaterial(payload);
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('requires authentication and org membership to create materials', async () => {
    const unauthenticated = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/materials`,
      payload: materialPayload(`unauth-${runId}`),
    });
    expect(unauthenticated.statusCode).toBe(401);

    const noPermission = await createMaterial(materialPayload(`outsider-${runId}`), outsiderToken);
    expect(noPermission.statusCode).toBe(403);

    const wrongOrg = await createMaterial(
      materialPayload(`wrong-org-${runId}`),
      adminToken,
      otherOrgId,
    );
    expect(wrongOrg.statusCode).toBe(403);
  });

  it('lists only its org materials and uses a cursor to continue pagination', async () => {
    const ownOne = await createMaterial(materialPayload(`page-one-${runId}`));
    const ownTwo = await createMaterial(materialPayload(`page-two-${runId}`));
    const foreign = await createMaterial(
      materialPayload(`page-foreign-${runId}`),
      otherOrgToken,
      otherOrgId,
    );
    expect([ownOne.statusCode, ownTwo.statusCode, foreign.statusCode]).toEqual([201, 201, 201]);
    const ownIds = [ownOne.json().data.id, ownTwo.json().data.id];
    const foreignId = foreign.json().data.id;

    const response = await listMaterials();
    expect(response.statusCode).toBe(200);
    const data = response.json().data as Array<{ id: string; organizationId: string }>;
    expect(data.some(({ id }) => ownIds.includes(id))).toBe(true);
    expect(data.some(({ id }) => id === foreignId)).toBe(false);
    expect(data.every(({ organizationId }) => organizationId === orgId)).toBe(true);

    const firstPage = await listMaterials(orgId, '?limit=1');
    expect(firstPage.statusCode).toBe(200);
    const cursor = firstPage.json().meta.nextCursor;
    expect(cursor).toBeTruthy();
    const firstId = firstPage.json().data[0].id;
    const secondPage = await listMaterials(orgId, `?limit=1&cursor=${encodeURIComponent(cursor)}`);
    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json().data).toHaveLength(1);
    expect(secondPage.json().data[0].id).not.toBe(firstId);
  });

  it('filters materials by inactive status and category', async () => {
    const inactive = await createMaterial(materialPayload(`inactive-${runId}`, {
      category: `FILTER-${runId}`,
    }));
    const active = await createMaterial(materialPayload(`active-${runId}`, {
      category: `FILTER-${runId}`,
    }));
    const otherCategory = await createMaterial(materialPayload(`other-category-${runId}`, {
      category: `OTHER-${runId}`,
    }));
    expect([inactive.statusCode, active.statusCode, otherCategory.statusCode]).toEqual([201, 201, 201]);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/materials/${inactive.json().data.id}`,
      headers: authHeader(adminToken),
      payload: { status: 'INACTIVE' },
    });
    expect(patch.statusCode).toBe(200);

    const inactiveList = await listMaterials(orgId, '?status=INACTIVE');
    expect(inactiveList.statusCode).toBe(200);
    const inactiveIds = (inactiveList.json().data as Array<{ id: string }>).map(({ id }) => id);
    expect(inactiveIds).toContain(inactive.json().data.id);
    expect(inactiveIds).not.toContain(active.json().data.id);

    const categoryList = await listMaterials(orgId, `?category=${encodeURIComponent(`FILTER-${runId}`)}`);
    expect(categoryList.statusCode).toBe(200);
    const categoryItems = categoryList.json().data as Array<{ id: string; category: string }>;
    expect(categoryItems.some(({ id }) => id === inactive.json().data.id)).toBe(true);
    expect(categoryItems.some(({ id }) => id === active.json().data.id)).toBe(true);
    expect(categoryItems.some(({ id }) => id === otherCategory.json().data.id)).toBe(false);
    expect(categoryItems.every(({ category }) => category === `FILTER-${runId}`)).toBe(true);
  });

  it('gets an own-org material and returns 404 for a foreign organization material', async () => {
    const own = await createMaterial(materialPayload(`get-own-${runId}`));
    const foreign = await createMaterial(
      materialPayload(`get-foreign-${runId}`),
      otherOrgToken,
      otherOrgId,
    );
    expect(own.statusCode).toBe(201);
    expect(foreign.statusCode).toBe(201);

    const ownResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/materials/${own.json().data.id}`,
      headers: authHeader(adminToken),
    });
    expect(ownResponse.statusCode).toBe(200);
    expect(ownResponse.json().data).toMatchObject({
      id: own.json().data.id,
      materialCode: own.json().data.materialCode,
    });

    const foreignResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/materials/${foreign.json().data.id}`,
      headers: authHeader(adminToken),
    });
    expect(foreignResponse.statusCode).toBe(404);
  });

  it('serves the cached material written by create', async () => {
    const created = await createMaterial(materialPayload(`cache-create-${runId}`));
    expect(created.statusCode).toBe(201);
    const material = created.json().data;

    const cached = await getRedis().get(`siteflow:v1:org:${orgId}:material:${material.id}`);
    expect(cached).toBeTruthy();
    expect(JSON.parse(cached!)).toMatchObject({
      id: material.id,
      organizationId: orgId,
      materialCode: material.materialCode,
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/materials/${material.id}`,
      headers: authHeader(adminToken),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data).toMatchObject({
      id: material.id,
      materialCode: material.materialCode,
      name: material.name,
    });
  });

  it('updates material details and status, persists the patch, and invalidates its cached read', async () => {
    const created = await createMaterial(materialPayload(`update-${runId}`));
    const materialId = created.json().data.id;
    const before = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/materials/${materialId}`,
      headers: authHeader(adminToken),
    });
    expect(before.statusCode).toBe(200);
    expect(before.json().data.name).toBe(`Material update-${runId}`);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/materials/${materialId}`,
      headers: authHeader(adminToken),
      payload: { name: `Updated ${runId}`, materialType: 'EQUIPMENT' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data).toMatchObject({
      name: `Updated ${runId}`,
      materialType: 'EQUIPMENT',
    });

    const inactive = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/materials/${materialId}`,
      headers: authHeader(adminToken),
      payload: { status: 'INACTIVE' },
    });
    expect(inactive.statusCode).toBe(200);
    expect(inactive.json().data.status).toBe('INACTIVE');

    const after = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/materials/${materialId}`,
      headers: authHeader(adminToken),
    });
    expect(after.statusCode).toBe(200);
    expect(after.json().data).toMatchObject({
      name: `Updated ${runId}`,
      materialType: 'EQUIPMENT',
      status: 'INACTIVE',
    });
    const [persisted] = await getDb().select().from(materials).where(
      and(eq(materials.id, materialId), eq(materials.organizationId, orgId)),
    );
    expect(persisted).toMatchObject({
      name: `Updated ${runId}`,
      materialType: 'EQUIPMENT',
      status: 'INACTIVE',
    });
  });

  it('returns 404 when updating a material owned by another organization', async () => {
    const foreign = await createMaterial(
      materialPayload(`update-foreign-${runId}`),
      otherOrgToken,
      otherOrgId,
    );
    expect(foreign.statusCode).toBe(201);
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/materials/${foreign.json().data.id}`,
      headers: authHeader(adminToken),
      payload: { name: `Unauthorized ${runId}` },
    });
    expect(response.statusCode).toBe(404);
  });

  it('rejects a material update with an invalid material type', async () => {
    const created = await createMaterial(materialPayload(`invalid-update-${runId}`));
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/materials/${created.json().data.id}`,
      headers: authHeader(adminToken),
      payload: { materialType: 'NOT_VALID' },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('does not expose another org material in a list and ignores injected tenant and status fields', async () => {
    const foreign = await createMaterial(
      materialPayload(`list-foreign-${runId}`),
      otherOrgToken,
      otherOrgId,
    );
    const injectedId = crypto.randomUUID();
    const created = await createMaterial(materialPayload(`privileged-${runId}`, {
      id: injectedId,
      organizationId: otherOrgId,
      status: 'INACTIVE',
    }));

    expect(created.statusCode).toBe(201);
    const body = created.json().data;
    expect(body).toMatchObject({ organizationId: orgId, status: 'ACTIVE' });
    expect(body.id).not.toBe(injectedId);

    const [row] = await getDb().select().from(materials).where(eq(materials.id, body.id));
    expect(row).toMatchObject({ organizationId: orgId, status: 'ACTIVE' });

    const list = await listMaterials();
    expect(list.statusCode).toBe(200);
    const ids = (list.json().data as Array<{ id: string }>).map(({ id }) => id);
    expect(ids).toContain(body.id);
    expect(ids).not.toContain(foreign.json().data.id);
  });
});
