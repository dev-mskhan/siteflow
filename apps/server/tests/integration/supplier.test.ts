import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, inArray } from 'drizzle-orm';
import {
  auditLogs,
  permissions,
  rolePermissions,
  supplierContacts,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { rbacCacheService } from '../../src/modules/rbac/rbac.cache.service.js';
import { createTestApp } from '../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';

const runId = crypto.randomUUID().replace(/-/g, '').slice(0, 10);
const catalogPermissions = ['supplier:create', 'supplier:read', 'supplier:update'];

function authHeader(token: string) {
  return { authorization: `Bearer ${token}` };
}

function supplierPayload(seed: string, overrides: Record<string, unknown> = {}) {
  return {
    supplierCode: `sup-${seed}`,
    legalName: `Supplier ${seed}`,
    displayName: `Display ${seed}`,
    supplierType: 'MATERIAL_SUPPLIER',
    email: `${seed}@example.com`,
    phone: '555-0100',
    website: 'https://example.com',
    currencyCode: 'usd',
    paymentTerms: 'Net 30',
    notes: `Supplier created for ${seed}`,
    ...overrides,
  };
}

async function grantSupplierPermissions(roleId: string, organizationId: string) {
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

describe('Supplier catalog routes', () => {
  let app: FastifyInstance;
  let adminToken: string;
  let adminUserId: string;
  let orgId: string;
  let otherOrgId: string;
  let otherOrgToken: string;
  let outsiderToken: string;

  const createSupplier = async (
    payload: Record<string, unknown>,
    token = adminToken,
    targetOrgId = orgId,
  ) =>
    app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${targetOrgId}/suppliers`,
      headers: authHeader(token),
      payload,
    });

  const listSuppliers = (targetOrgId = orgId, query = '', token = adminToken) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${targetOrgId}/suppliers${query}`,
      headers: authHeader(token),
    });

  beforeAll(async () => {
    app = await createTestApp();

    const admin = await createVerifiedUser({ email: `supplier-admin-${runId}@example.com` });
    adminToken = admin.token;
    adminUserId = admin.user.id;
    const ownOrg = await createOrgWithAdmin(app, adminToken, `Supplier Org ${runId}`);
    orgId = ownOrg.orgId;
    await grantSupplierPermissions(ownOrg.roleMap.get('Organization Admin')!, orgId);

    const otherUser = await createVerifiedUser({ email: `supplier-other-${runId}@example.com` });
    otherOrgToken = otherUser.token;
    const otherOrg = await createOrgWithAdmin(app, otherOrgToken, `Supplier Other Org ${runId}`);
    otherOrgId = otherOrg.orgId;
    await grantSupplierPermissions(otherOrg.roleMap.get('Organization Admin')!, otherOrgId);

    const outsider = await createVerifiedUser({ email: `supplier-outsider-${runId}@example.com` });
    outsiderToken = outsider.token;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('creates a full supplier, normalizes its code, persists its fields, and audits the resource', async () => {
    const payload = supplierPayload(`full-${runId}`);
    const response = await createSupplier(payload);

    expect(response.statusCode).toBe(201);
    const body = response.json();
    expect(body.success).toBe(true);
    expect(body.data.organizationId).toBe(orgId);
    expect(body.data.supplierCode).toBe(`SUP-FULL-${runId.toUpperCase()}`);
    expect(body.data.legalName).toBe(payload.legalName);
    expect(body.data.email).toBe(payload.email);

    const [row] = await getDb().select().from(suppliers).where(
      and(eq(suppliers.id, body.data.id), eq(suppliers.organizationId, orgId)),
    );
    expect(row).toMatchObject({
      organizationId: orgId,
      supplierCode: `SUP-FULL-${runId.toUpperCase()}`,
      legalName: payload.legalName,
      displayName: payload.displayName,
    });

    const [audit] = await getDb().select().from(auditLogs).where(
      and(
        eq(auditLogs.action, 'supplier.created'),
        eq(auditLogs.organizationId, orgId),
        eq(auditLogs.resourceId, body.data.id),
      ),
    );
    expect(audit).toMatchObject({
      organizationId: orgId,
      actorUserId: adminUserId,
      action: 'supplier.created',
      resourceType: 'Supplier',
      resourceId: body.data.id,
    });
  });

  it('creates a supplier with only required fields', async () => {
    const response = await createSupplier({
      supplierCode: `minimal-${runId}`,
      legalName: `Minimal legal ${runId}`,
      displayName: `Minimal ${runId}`,
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data).toMatchObject({
      organizationId: orgId,
      supplierCode: `MINIMAL-${runId.toUpperCase()}`,
      legalName: `Minimal legal ${runId}`,
      displayName: `Minimal ${runId}`,
    });
  });

  it('enforces supplier-code uniqueness within an org but isolates different orgs', async () => {
    const payload = supplierPayload(`duplicate-${runId}`);
    expect((await createSupplier(payload)).statusCode).toBe(201);
    const duplicate = await createSupplier(payload);
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().success).toBe(false);

    const crossOrg = await createSupplier(payload, otherOrgToken, otherOrgId);
    expect(crossOrg.statusCode).toBe(201);
    expect(crossOrg.json().data.organizationId).toBe(otherOrgId);
  });

  it.each([
    ['missing legalName', { supplierCode: `missing-${runId}`, displayName: `Missing ${runId}` }],
    ['invalid email', supplierPayload(`bad-email-${runId}`, { email: 'not-an-email' })],
    ['invalid website', supplierPayload(`bad-url-${runId}`, { website: 'not-a-url' })],
    ['currency code with wrong length', supplierPayload(`bad-currency-${runId}`, { currencyCode: 'US' })],
    ['supplier code longer than 50 characters', supplierPayload('x'.repeat(51))],
  ])('rejects supplier creation with %s', async (_scenario, payload) => {
    const response = await createSupplier(payload);
    expect(response.statusCode).toBe(422);
    expect(response.json()).toMatchObject({
      success: false,
      error: { code: 'VALIDATION_ERROR' },
    });
  });

  it('requires authentication and org membership to create suppliers', async () => {
    const unauthenticated = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/suppliers`,
      payload: supplierPayload(`unauth-${runId}`),
    });
    expect(unauthenticated.statusCode).toBe(401);

    const noPermission = await createSupplier(supplierPayload(`outsider-${runId}`), outsiderToken);
    expect(noPermission.statusCode).toBe(403);

    const wrongOrg = await createSupplier(
      supplierPayload(`wrong-org-${runId}`),
      adminToken,
      otherOrgId,
    );
    expect(wrongOrg.statusCode).toBe(403);
  });

  it('does not allow client-supplied supplier identity or tenant fields', async () => {
    const injectedId = crypto.randomUUID();
    const response = await createSupplier(
      supplierPayload(`privileged-${runId}`, {
        id: injectedId,
        organizationId: otherOrgId,
        status: 'SUSPENDED',
      }),
    );

    if (response.statusCode === 201) {
      expect(response.json().data).toMatchObject({
        organizationId: orgId,
        status: 'ACTIVE',
      });
      expect(response.json().data.id).not.toBe(injectedId);
      const [row] = await getDb().select().from(suppliers).where(eq(suppliers.id, response.json().data.id));
      expect(row?.organizationId).toBe(orgId);
      expect(row?.status).toBe('ACTIVE');
    } else {
      expect(response.statusCode).toBe(422);
    }
  });

  it('lists only its org suppliers and returns a usable cursor for limit-one pages', async () => {
    const ownOne = await createSupplier(supplierPayload(`page-one-${runId}`));
    const ownTwo = await createSupplier(supplierPayload(`page-two-${runId}`));
    const foreign = await createSupplier(
      supplierPayload(`page-foreign-${runId}`),
      otherOrgToken,
      otherOrgId,
    );
    expect([ownOne.statusCode, ownTwo.statusCode, foreign.statusCode]).toEqual([201, 201, 201]);
    const ownIds = [ownOne.json().data.id, ownTwo.json().data.id];
    const foreignId = foreign.json().data.id;

    const response = await listSuppliers();
    expect(response.statusCode).toBe(200);
    const data = response.json().data as Array<{ id: string; organizationId: string }>;
    expect(data.some(({ id }) => ownIds.includes(id))).toBe(true);
    expect(data.some(({ id }) => id === foreignId)).toBe(false);
    expect(data.every(({ organizationId }) => organizationId === orgId)).toBe(true);

    const firstPage = await listSuppliers(orgId, '?limit=1');
    expect(firstPage.statusCode).toBe(200);
    const cursor = firstPage.json().meta.nextCursor;
    expect(cursor).toBeTruthy();
    const firstId = firstPage.json().data[0].id;
    const secondPage = await listSuppliers(orgId, `?limit=1&cursor=${encodeURIComponent(cursor)}`);
    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json().data).toHaveLength(1);
    expect(secondPage.json().data[0].id).not.toBe(firstId);
  });

  it('filters supplier lists by inactive status without including active suppliers', async () => {
    const inactive = await createSupplier(supplierPayload(`inactive-filter-${runId}`));
    const active = await createSupplier(supplierPayload(`active-filter-${runId}`));
    expect(inactive.statusCode).toBe(201);
    expect(active.statusCode).toBe(201);

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/suppliers/${inactive.json().data.id}`,
      headers: authHeader(adminToken),
      payload: { status: 'INACTIVE' },
    });
    expect(patch.statusCode).toBe(200);

    const response = await listSuppliers(orgId, '?status=INACTIVE');
    expect(response.statusCode).toBe(200);
    const ids = (response.json().data as Array<{ id: string }>).map(({ id }) => id);
    expect(ids).toContain(inactive.json().data.id);
    expect(ids).not.toContain(active.json().data.id);
  });

  it('gets an own-org supplier and returns 404 for foreign or nonexistent IDs', async () => {
    const own = await createSupplier(supplierPayload(`get-own-${runId}`));
    const foreign = await createSupplier(
      supplierPayload(`get-foreign-${runId}`),
      otherOrgToken,
      otherOrgId,
    );
    expect(own.statusCode).toBe(201);
    expect(foreign.statusCode).toBe(201);

    const ownResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/suppliers/${own.json().data.id}`,
      headers: authHeader(adminToken),
    });
    expect(ownResponse.statusCode).toBe(200);
    expect(ownResponse.json().data).toMatchObject({
      id: own.json().data.id,
      supplierCode: own.json().data.supplierCode,
    });

    const foreignResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/suppliers/${foreign.json().data.id}`,
      headers: authHeader(adminToken),
    });
    expect(foreignResponse.statusCode).toBe(404);

    const missingResponse = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/suppliers/${crypto.randomUUID()}`,
      headers: authHeader(adminToken),
    });
    expect(missingResponse.statusCode).toBe(404);
    expect(foreignResponse.json().error.code).toBe(missingResponse.json().error.code);
  });

  it('updates supplier fields, suspends the supplier, and invalidates a cached read', async () => {
    const created = await createSupplier(supplierPayload(`update-${runId}`));
    expect(created.statusCode).toBe(201);
    const supplierId = created.json().data.id;

    const cachedRead = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/suppliers/${supplierId}`,
      headers: authHeader(adminToken),
    });
    expect(cachedRead.statusCode).toBe(200);
    expect(cachedRead.json().data.displayName).toBe(`Display update-${runId}`);

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/suppliers/${supplierId}`,
      headers: authHeader(adminToken),
      payload: { displayName: `Updated ${runId}` },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.displayName).toBe(`Updated ${runId}`);

    const suspended = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/suppliers/${supplierId}`,
      headers: authHeader(adminToken),
      payload: { status: 'SUSPENDED' },
    });
    expect(suspended.statusCode).toBe(200);
    expect(suspended.json().data.status).toBe('SUSPENDED');

    const reread = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${orgId}/suppliers/${supplierId}`,
      headers: authHeader(adminToken),
    });
    expect(reread.statusCode).toBe(200);
    expect(reread.json().data).toMatchObject({
      displayName: `Updated ${runId}`,
      status: 'SUSPENDED',
    });
    const [persisted] = await getDb().select().from(suppliers).where(
      and(eq(suppliers.id, supplierId), eq(suppliers.organizationId, orgId)),
    );
    expect(persisted).toMatchObject({ displayName: `Updated ${runId}`, status: 'SUSPENDED' });
  });

  it('returns 404 when updating a supplier owned by another organization', async () => {
    const foreign = await createSupplier(
      supplierPayload(`update-foreign-${runId}`),
      otherOrgToken,
      otherOrgId,
    );
    expect(foreign.statusCode).toBe(201);
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/suppliers/${foreign.json().data.id}`,
      headers: authHeader(adminToken),
      payload: { displayName: `Unauthorized ${runId}` },
    });
    expect(response.statusCode).toBe(404);
  });

  it('rejects unauthenticated supplier updates', async () => {
    const created = await createSupplier(supplierPayload(`update-unauth-${runId}`));
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/suppliers/${created.json().data.id}`,
      payload: { displayName: 'Unauthenticated change' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('creates a primary contact and rejects a second primary contact', async () => {
    const supplierResponse = await createSupplier(supplierPayload(`contact-primary-${runId}`));
    const supplierId = supplierResponse.json().data.id;

    const primary = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/suppliers/${supplierId}/contacts`,
      headers: authHeader(adminToken),
      payload: { name: `Primary ${runId}`, email: `primary-${runId}@example.com`, isPrimary: true },
    });
    expect(primary.statusCode).toBe(201);
    expect(primary.json().data).toMatchObject({
      organizationId: orgId,
      supplierId,
      isPrimary: true,
      isActive: true,
    });

    const [persistedPrimary] = await getDb().select().from(supplierContacts).where(
      and(
        eq(supplierContacts.id, primary.json().data.id),
        eq(supplierContacts.organizationId, orgId),
        eq(supplierContacts.supplierId, supplierId),
      ),
    );
    expect(persistedPrimary?.isPrimary).toBe(true);

    const duplicate = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/suppliers/${supplierId}/contacts`,
      headers: authHeader(adminToken),
      payload: { name: `Secondary ${runId}`, isPrimary: true },
    });
    expect(duplicate.statusCode).toBe(409);
  });

  it('rejects invalid contact email values', async () => {
    const supplierResponse = await createSupplier(supplierPayload(`contact-email-${runId}`));
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/suppliers/${supplierResponse.json().data.id}/contacts`,
      headers: authHeader(adminToken),
      payload: { name: `Invalid ${runId}`, email: 'invalid-email' },
    });
    expect(response.statusCode).toBe(422);
    expect(response.json().error.code).toBe('VALIDATION_ERROR');
  });

  it('hides a foreign organization supplier when creating a contact', async () => {
    const foreign = await createSupplier(
      supplierPayload(`contact-foreign-supplier-${runId}`),
      otherOrgToken,
      otherOrgId,
    );
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/suppliers/${foreign.json().data.id}/contacts`,
      headers: authHeader(adminToken),
      payload: { name: `Cross-org contact ${runId}` },
    });
    expect(response.statusCode).toBe(404);
  });

  it('promotes a contact by demoting the existing primary and can deactivate it', async () => {
    const supplierResponse = await createSupplier(supplierPayload(`contact-promote-${runId}`));
    const supplierId = supplierResponse.json().data.id;
    const createContact = (name: string, isPrimary: boolean) =>
      app.inject({
        method: 'POST',
        url: `/api/v1/organizations/${orgId}/suppliers/${supplierId}/contacts`,
        headers: authHeader(adminToken),
        payload: { name, isPrimary },
      });

    const originalPrimary = await createContact(`Primary ${runId}`, true);
    const promotedContact = await createContact(`Promoted ${runId}`, false);
    expect(originalPrimary.statusCode).toBe(201);
    expect(promotedContact.statusCode).toBe(201);

    const promoted = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/suppliers/${supplierId}/contacts/${promotedContact.json().data.id}`,
      headers: authHeader(adminToken),
      payload: { isPrimary: true },
    });
    expect(promoted.statusCode).toBe(200);
    expect(promoted.json().data.isPrimary).toBe(true);

    const scopedContacts = await getDb().select().from(supplierContacts).where(
      and(
        eq(supplierContacts.organizationId, orgId),
        eq(supplierContacts.supplierId, supplierId),
      ),
    );
    expect(scopedContacts.find(({ id }) => id === originalPrimary.json().data.id)?.isPrimary).toBe(false);
    expect(scopedContacts.find(({ id }) => id === promotedContact.json().data.id)?.isPrimary).toBe(true);

    const deactivated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/suppliers/${supplierId}/contacts/${promotedContact.json().data.id}`,
      headers: authHeader(adminToken),
      payload: { isActive: false },
    });
    expect(deactivated.statusCode).toBe(200);
    expect(deactivated.json().data.isActive).toBe(false);
    const [persistedInactive] = await getDb().select().from(supplierContacts).where(
      and(
        eq(supplierContacts.id, promotedContact.json().data.id),
        eq(supplierContacts.organizationId, orgId),
        eq(supplierContacts.supplierId, supplierId),
      ),
    );
    expect(persistedInactive?.isActive).toBe(false);
  });

  it('returns 404 when updating a contact belonging to another org supplier', async () => {
    const foreignSupplier = await createSupplier(
      supplierPayload(`contact-update-foreign-${runId}`),
      otherOrgToken,
      otherOrgId,
    );
    const foreignContact = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${otherOrgId}/suppliers/${foreignSupplier.json().data.id}/contacts`,
      headers: authHeader(otherOrgToken),
      payload: { name: `Foreign contact ${runId}` },
    });
    expect(foreignContact.statusCode).toBe(201);

    const ownSupplier = await createSupplier(supplierPayload(`contact-update-own-${runId}`));
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${orgId}/suppliers/${ownSupplier.json().data.id}/contacts/${foreignContact.json().data.id}`,
      headers: authHeader(adminToken),
      payload: { isActive: false },
    });
    expect(response.statusCode).toBe(404);
  });
});
