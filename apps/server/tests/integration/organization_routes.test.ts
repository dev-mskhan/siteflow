// apps/server/tests/integration/organization_routes.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import {
  organizationProfiles,
  organizationSettings,
  documentSequences,
  auditLogs,
} from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { outboxService } from '../../src/lib/outbox/outbox.service.js';
import {
  createVerifiedUser,
  createUnverifiedUser,
  createOrgWithAdmin,
  addMemberDirectly,
} from '../helpers/fixtures.js';
import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/shared/response.js';
import type { OrgDTO } from '../../src/modules/organization/organization.types.js';
import type { OrgProfileDTO } from '../../src/modules/organization/profile/profile.types.js';
import type { OrgSettingsDTO } from '../../src/modules/organization/settings/settings.types.js';
import type { DocumentSequenceDTO } from '../../src/modules/organization/sequences/sequences.types.js';

const runId = Math.random().toString(36).slice(2, 9);

describe('Organization Routes — comprehensive integration', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('POST /api/v1/organizations', () => {
    describe('Validation → 422', () => {
      let adminToken: string;

      beforeAll(async () => {
        const { token } = await createVerifiedUser({
          email: `org_val_admin_${runId}@test.dev`,
        });
        adminToken = token;
      });

      it('missing name → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: {},
        });
        expect(res.statusCode).toBe(422);
      });

      it('name too short "A" (min 2) → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: 'A' },
        });
        expect(res.statusCode).toBe(422);
      });

      it('name too long (101 chars) → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: 'A'.repeat(101) },
        });
        expect(res.statusCode).toBe(422);
      });

      it('slug uppercase "MySlug" → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: 'Valid Org', slug: 'MySlug' },
        });
        expect(res.statusCode).toBe(422);
      });

      it('slug with spaces "my slug" → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: 'Valid Org', slug: 'my slug' },
        });
        expect(res.statusCode).toBe(422);
      });

      it('slug too short "a" (min 2) → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: 'Valid Org', slug: 'a' },
        });
        expect(res.statusCode).toBe(422);
      });

      it('slug too long (51 chars) → 422', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: 'Valid Org', slug: 'a'.repeat(51) },
        });
        expect(res.statusCode).toBe(422);
      });

      it('extra unknown field → 201 (silently dropped)', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `Extra Field Org ${runId}`, hackerField: 'evil' },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json<ApiSuccessResponse<{ organization: any }>>();
        expect(body.data.organization.hackerField).toBeUndefined();
      });

      it('SQL injection name → 201 (stored as harmless text)', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `'; DROP TABLE org_${runId}` },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
        expect(body.data.organization.name).toBe(`'; DROP TABLE org_${runId}`);
      });
    });

    describe('Auth', () => {
      it('no auth → 401', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          payload: { name: 'No Auth Org' },
        });
        expect(res.statusCode).toBe(401);
      });

      it('email NOT verified → 403 FORBIDDEN', async () => {
        const { token } = await createUnverifiedUser(
          `org_unverified_${runId}@test.dev`,
        );
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${token}` },
          payload: { name: 'Unverified Org' },
        });
        expect(res.statusCode).toBe(403);
        expect(res.json<ApiErrorResponse>().error.code).toBe('FORBIDDEN');
      });
    });

    describe('Business logic', () => {
      let adminToken: string;

      beforeAll(async () => {
        const { token } = await createVerifiedUser({
          email: `org_biz_admin_${runId}@test.dev`,
        });
        adminToken = token;
      });

      it('no slug → 201, slug = lowercase-hyphenated name', async () => {
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `Apex Build ${runId}` },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
        expect(body.data.organization.slug).toBe(`apex-build-${runId}`);
      });

      it('explicit slug → 201, slug respected exactly', async () => {
        const slug = `custom-slug-${runId}`;
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `Custom Slug Org ${runId}`, slug },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
        expect(body.data.organization.slug).toBe(slug);
      });

      it('duplicate slug → 409 CONFLICT', async () => {
        const slug = `dup-slug-${runId}`;
        const first = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `Dup 1 ${runId}`, slug },
        });
        expect(first.statusCode).toBe(201);

        // Need a new token for a new user (same user hitting cap)
        const { token: token2 } = await createVerifiedUser({
          email: `dup_slug2_${runId}@test.dev`,
        });
        const second = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${token2}` },
          payload: { name: `Dup 2 ${runId}`, slug },
        });
        expect(second.statusCode).toBe(409);
        expect(second.json<ApiErrorResponse>().error.code).toBe('CONFLICT');
      });

      it('same name twice, no slug → 201 for both (second gets slug-2)', async () => {
        const { token: t1 } = await createVerifiedUser({
          email: `same_name_a_${runId}@test.dev`,
        });
        const { token: t2 } = await createVerifiedUser({
          email: `same_name_b_${runId}@test.dev`,
        });
        const name = `Shared Name ${runId}`;

        const first = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${t1}` },
          payload: { name },
        });
        expect(first.statusCode).toBe(201);

        const second = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${t2}` },
          payload: { name },
        });
        expect(second.statusCode).toBe(201);
        const secondSlug = second.json<ApiSuccessResponse<{ organization: OrgDTO }>>()
          .data.organization.slug;
        expect(secondSlug).not.toBe(
          first.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.slug,
        );
      });
    });

    describe('Response contract', () => {
      let orgId: string;
      let adminToken: string;

      beforeAll(async () => {
        const { token } = await createVerifiedUser({
          email: `org_contract_${runId}@test.dev`,
        });
        adminToken = token;
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `Contract Org ${runId}` },
        });
        expect(res.statusCode).toBe(201);
        orgId = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;
      });

      it('OrgDTO shape (id/name/slug/status/createdBy/createdAt/updatedAt)', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}`,
          headers: { authorization: `Bearer ${adminToken}` },
        });
        const org = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization;
        expect(org.id).toBeDefined();
        expect(org.name).toBeDefined();
        expect(org.slug).toBeDefined();
        expect(org.status).toBeDefined();
        expect(org.createdBy).toBeDefined();
        expect(org.createdAt).toBeDefined();
        expect(org.updatedAt).toBeDefined();
      });

      it('NO country field in OrgDTO response', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}`,
          headers: { authorization: `Bearer ${adminToken}` },
        });
        const org = res.json<ApiSuccessResponse<{ organization: any }>>().data.organization;
        expect(org.country).toBeUndefined();
      });

      it('NO settings field in OrgDTO response', async () => {
        const res = await app.inject({
          method: 'GET',
          url: `/api/v1/organizations/${orgId}`,
          headers: { authorization: `Bearer ${adminToken}` },
        });
        const org = res.json<ApiSuccessResponse<{ organization: any }>>().data.organization;
        expect(org.settings).toBeUndefined();
      });

      it('success=true, data.organization present, meta.timestamp present', async () => {
        const { token } = await createVerifiedUser({
          email: `org_meta_${runId}@test.dev`,
        });
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${token}` },
          payload: { name: `Meta Test Org ${runId}` },
        });
        expect(res.statusCode).toBe(201);
        const body = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
        expect(body.success).toBe(true);
        expect(body.data.organization).toBeDefined();
        expect(body.meta?.timestamp).toBeDefined();
      });
    });

    describe('Side effects', () => {
      let orgId: string;
      let adminToken: string;

      beforeAll(async () => {
        const { token } = await createVerifiedUser({
          email: `org_side_${runId}@test.dev`,
        });
        adminToken = token;
        const res = await app.inject({
          method: 'POST',
          url: '/api/v1/organizations',
          headers: { authorization: `Bearer ${adminToken}` },
          payload: { name: `Side Effects Org ${runId}` },
        });
        orgId = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;
      });

      it('profile row exists in DB after creation', async () => {
        const db = getDb();
        const profiles = await db
          .select()
          .from(organizationProfiles)
          .where(eq(organizationProfiles.organizationId, orgId));
        expect(profiles.length).toBe(1);
      });

      it('settings row has correct defaults (timezone=UTC, currency=USD, weekStartsOn=1)', async () => {
        const db = getDb();
        const settings_rows = await db
          .select()
          .from(organizationSettings)
          .where(eq(organizationSettings.organizationId, orgId));
        expect(settings_rows.length).toBe(1);
        expect(settings_rows[0]!.timezone).toBe('UTC');
        expect(settings_rows[0]!.currency).toBe('USD');
        expect(settings_rows[0]!.weekStartsOn).toBe(1);
        expect(settings_rows[0]!.fiscalYearStartMonth).toBe(1);
      });

      it('exactly 7 document sequence rows exist', async () => {
        const db = getDb();
        const seqs = await db
          .select()
          .from(documentSequences)
          .where(eq(documentSequences.organizationId, orgId));
        expect(seqs.length).toBe(7);
      });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/organizations', () => {
    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations',
      });
      expect(res.statusCode).toBe(401);
    });

    it('valid → 200, data.organizations is array', async () => {
      const { token } = await createVerifiedUser({
        email: `list_orgs_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations',
        headers: { authorization: `Bearer ${token}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ organizations: OrgDTO[] }>>();
      expect(Array.isArray(body.data.organizations)).toBe(true);
    });

    it('only own orgs returned (not other users\' orgs)', async () => {
      const { token: tA } = await createVerifiedUser({
        email: `list_own_a_${runId}@test.dev`,
      });
      const { token: tB } = await createVerifiedUser({
        email: `list_own_b_${runId}@test.dev`,
      });

      // Create org as user A
      await app.inject({
        method: 'POST',
        url: '/api/v1/organizations',
        headers: { authorization: `Bearer ${tA}` },
        payload: { name: `List Own A ${runId}` },
      });

      // User B should not see user A's org
      const resB = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations',
        headers: { authorization: `Bearer ${tB}` },
      });
      expect(resB.statusCode).toBe(200);
      const body = resB.json<ApiSuccessResponse<{ organizations: OrgDTO[] }>>();
      const orgNames = body.data.organizations.map((o) => o.name);
      expect(orgNames).not.toContain(`List Own A ${runId}`);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/organizations/:id', () => {
    let adminToken: string;
    let orgId: string;

    beforeAll(async () => {
      const { token } = await createVerifiedUser({
        email: `get_org_admin_${runId}@test.dev`,
      });
      adminToken = token;
      const res = await app.inject({
        method: 'POST',
        url: '/api/v1/organizations',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: `Get Org Test ${runId}` },
      });
      orgId = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;
    });

    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('non-UUID id "not-a-uuid" → 422', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/not-a-uuid',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(422);
    });

    it('valid UUID but doesn\'t exist → 403 (not-a-member, org existence not revealed)', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/organizations/00000000-0000-0000-0000-000000000099',
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('is a member → 200, OrgDTO shape', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
      expect(body.data.organization.id).toBe(orgId);
    });

    it('NOT a member (cross-tenant) → 403', async () => {
      const { token: stranger } = await createVerifiedUser({
        email: `get_stranger_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${stranger}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('PATCH /api/v1/organizations/:id', () => {
    let adminToken: string;
    let pmToken: string;
    let orgId: string;
    let roleMap: Map<string, string>;

    beforeAll(async () => {
      const { token, user } = await createVerifiedUser({
        email: `patch_org_admin_${runId}@test.dev`,
      });
      adminToken = token;
      const { orgId: oid, roleMap: rm } = await createOrgWithAdmin(
        app,
        adminToken,
        `Patch Org Test ${runId}`,
      );
      orgId = oid;
      roleMap = rm;

      const { user: pmUser, token: pmTok } = await createVerifiedUser({
        email: `patch_org_pm_${runId}@test.dev`,
      });
      pmToken = pmTok;
      await addMemberDirectly(orgId, pmUser.id, roleMap.get('Project Manager')!);
    });

    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}`,
        payload: { name: 'New Name' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('non-UUID id → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: '/api/v1/organizations/not-a-uuid',
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'New Name' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('cross-tenant → 403', async () => {
      const { token: stranger } = await createVerifiedUser({
        email: `patch_stranger_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${stranger}` },
        payload: { name: 'Hacked Name' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Project Manager role (no organization:update) → 403', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${pmToken}` },
        payload: { name: 'PM Update Attempt' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Org Admin → 200', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: `Updated Name ${runId}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
      expect(body.data.organization.name).toBe(`Updated Name ${runId}`);
    });

    it('empty body {} → 200, name unchanged', async () => {
      const before = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const nameBefore = before.json<ApiSuccessResponse<{ organization: OrgDTO }>>()
        .data.organization.name;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ organization: OrgDTO }>>();
      expect(body.data.organization.name).toBe(nameBefore);
    });

    it('name too short → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'X' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('name too long → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { name: 'A'.repeat(101) },
      });
      expect(res.statusCode).toBe(422);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/organizations/:id/profile', () => {
    let adminToken: string;
    let clientToken: string;
    let orgId: string;
    let roleMap: Map<string, string>;

    beforeAll(async () => {
      const { token, user } = await createVerifiedUser({
        email: `get_prof_admin_${runId}@test.dev`,
      });
      adminToken = token;
      const result = await createOrgWithAdmin(
        app,
        adminToken,
        `Get Profile Org ${runId}`,
      );
      orgId = result.orgId;
      roleMap = result.roleMap;

      const { user: clientUser, token: clientTok } = await createVerifiedUser({
        email: `get_prof_client_${runId}@test.dev`,
      });
      clientToken = clientTok;
      await addMemberDirectly(orgId, clientUser.id, roleMap.get('Client')!);
    });

    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/profile`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('cross-tenant → 403', async () => {
      const { token: stranger } = await createVerifiedUser({
        email: `get_prof_stranger_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${stranger}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Client role (has organization:read) → 200', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${clientToken}` },
      });
      expect(res.statusCode).toBe(200);
    });

    it('Admin → 200, all nullable fields null initially, correct shape', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ profile: OrgProfileDTO }>>();
      const profile = body.data.profile;
      expect(profile.organizationId).toBe(orgId);
      expect(profile.legalName).toBeNull();
      expect(profile.businessName).toBeNull();
      expect(profile.primaryEmail).toBeNull();
      expect(profile.website).toBeNull();
      expect(profile.country).toBeNull();
      expect(profile.createdAt).toBeDefined();
      expect(profile.updatedAt).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('PATCH /api/v1/organizations/:id/profile', () => {
    let adminToken: string;
    let pmToken: string;
    let orgId: string;
    let roleMap: Map<string, string>;

    beforeAll(async () => {
      const { token } = await createVerifiedUser({
        email: `patch_prof_admin_${runId}@test.dev`,
      });
      adminToken = token;
      const result = await createOrgWithAdmin(
        app,
        adminToken,
        `Patch Profile Org ${runId}`,
      );
      orgId = result.orgId;
      roleMap = result.roleMap;

      const { user: pmUser, token: pmTok } = await createVerifiedUser({
        email: `patch_prof_pm_${runId}@test.dev`,
      });
      pmToken = pmTok;
      await addMemberDirectly(orgId, pmUser.id, roleMap.get('Project Manager')!);
    });

    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        payload: { businessName: 'Test' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('Project Manager (no organization:update) → 403', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${pmToken}` },
        payload: { businessName: 'PM Attempt' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('primaryEmail "not-an-email" → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { primaryEmail: 'not-an-email' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('website "not-a-url" → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { website: 'not-a-url' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('country "USA" (3 chars) → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { country: 'USA' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('country "us" (lowercase, fails /^[A-Z]{2}$/) → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { country: 'us' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('country "US" → 200', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { country: 'US' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ profile: OrgProfileDTO }>>();
      expect(body.data.profile.country).toBe('US');
    });

    it('businessType "INVALID_TYPE" → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { businessType: 'INVALID_TYPE' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('empty body {} → 200, nothing changes', async () => {
      const before = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const beforeProfile = before.json<ApiSuccessResponse<{ profile: OrgProfileDTO }>>()
        .data.profile;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const afterProfile = res.json<ApiSuccessResponse<{ profile: OrgProfileDTO }>>()
        .data.profile;
      expect(afterProfile.country).toBe(beforeProfile.country);
    });

    it('explicit null values → 200, fields set to null', async () => {
      // First set a value
      await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { businessName: 'Some Business' },
      });

      // Then null it out
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { businessName: null },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ profile: OrgProfileDTO }>>();
      expect(body.data.profile.businessName).toBeNull();
    });

    it('valid body → 200, fields updated, audit organization.profile_updated in DB', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/profile`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {
          businessName: 'Apex Construction',
          primaryEmail: 'info@apex.com',
        },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ profile: OrgProfileDTO }>>();
      expect(body.data.profile.businessName).toBe('Apex Construction');
      expect(body.data.profile.primaryEmail).toBe('info@apex.com');

      const db = getDb();
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, orgId));
      expect(logs.some((l) => l.action === 'organization.profile_updated')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/organizations/:id/settings', () => {
    let adminToken: string;
    let pmToken: string;
    let orgId: string;
    let roleMap: Map<string, string>;

    beforeAll(async () => {
      const { token } = await createVerifiedUser({
        email: `get_sett_admin_${runId}@test.dev`,
      });
      adminToken = token;
      const result = await createOrgWithAdmin(
        app,
        adminToken,
        `Get Settings Org ${runId}`,
      );
      orgId = result.orgId;
      roleMap = result.roleMap;

      const { user: pmUser, token: pmTok } = await createVerifiedUser({
        email: `get_sett_pm_${runId}@test.dev`,
      });
      pmToken = pmTok;
      await addMemberDirectly(orgId, pmUser.id, roleMap.get('Project Manager')!);
    });

    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/settings`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('cross-tenant → 403', async () => {
      const { token: stranger } = await createVerifiedUser({
        email: `get_sett_stranger_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${stranger}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Project Manager (no settings:read) → 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${pmToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Admin → 200, defaults: timezone=UTC, currency=USD, weekStartsOn=1, fiscalYearStartMonth=1', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>();
      const s = body.data.settings;
      expect(s.timezone).toBe('UTC');
      expect(s.currency).toBe('USD');
      expect(s.weekStartsOn).toBe(1);
      expect(s.fiscalYearStartMonth).toBe(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('PATCH /api/v1/organizations/:id/settings', () => {
    let adminToken: string;
    let pmToken: string;
    let orgId: string;
    let roleMap: Map<string, string>;

    beforeAll(async () => {
      const { token } = await createVerifiedUser({
        email: `patch_sett_admin_${runId}@test.dev`,
      });
      adminToken = token;
      const result = await createOrgWithAdmin(
        app,
        adminToken,
        `Patch Settings Org ${runId}`,
      );
      orgId = result.orgId;
      roleMap = result.roleMap;

      const { user: pmUser, token: pmTok } = await createVerifiedUser({
        email: `patch_sett_pm_${runId}@test.dev`,
      });
      pmToken = pmTok;
      await addMemberDirectly(orgId, pmUser.id, roleMap.get('Project Manager')!);
    });

    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        payload: { currency: 'EUR' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('missing settings:update → 403', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${pmToken}` },
        payload: { currency: 'EUR' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('timezone "Mars/Olympus" → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { timezone: 'Mars/Olympus' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('timezone "" (empty) → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { timezone: '' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('currency "usd" (lowercase) → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { currency: 'usd' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('currency "US" (2 chars) → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { currency: 'US' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('currency "USDD" (4 chars) → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { currency: 'USDD' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('weekStartsOn -1 → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { weekStartsOn: -1 },
      });
      expect(res.statusCode).toBe(422);
    });

    it('weekStartsOn 7 → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { weekStartsOn: 7 },
      });
      expect(res.statusCode).toBe(422);
    });

    it('weekStartsOn 0 → 200', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { weekStartsOn: 0 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>();
      expect(body.data.settings.weekStartsOn).toBe(0);
    });

    it('fiscalYearStartMonth 0 → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { fiscalYearStartMonth: 0 },
      });
      expect(res.statusCode).toBe(422);
    });

    it('fiscalYearStartMonth 13 → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { fiscalYearStartMonth: 13 },
      });
      expect(res.statusCode).toBe(422);
    });

    it('dateFormat "DMY" → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { dateFormat: 'DMY' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('timeFormat "24H" → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { timeFormat: '24H' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('unitSystem "BOTH" → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { unitSystem: 'BOTH' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('unknown field {hackerField: true} → 200 (silently dropped, nextValue unchanged)', async () => {
      const before = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const beforeBody = before.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>()
        .data.settings;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { hackerField: true },
      });
      expect(res.statusCode).toBe(200);
      const afterBody = res.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>()
        .data.settings;
      expect((afterBody as any).hackerField).toBeUndefined();
      expect(afterBody.currency).toBe(beforeBody.currency);
    });

    it('empty body {} → 200, nothing changes', async () => {
      const before = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      const beforeSettings = before.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>()
        .data.settings;

      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: {},
      });
      expect(res.statusCode).toBe(200);
      const afterSettings = res.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>()
        .data.settings;
      expect(afterSettings.currency).toBe(beforeSettings.currency);
      expect(afterSettings.timezone).toBe(beforeSettings.timezone);
    });

    it('valid partial → 200, only updated fields changed, audit organization.settings_updated', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/settings`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { currency: 'EUR', timezone: 'America/New_York' },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ settings: OrgSettingsDTO }>>();
      expect(body.data.settings.currency).toBe('EUR');
      expect(body.data.settings.timezone).toBe('America/New_York');

      const db = getDb();
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, orgId));
      expect(logs.some((l) => l.action === 'organization.settings_updated')).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/organizations/:id/document-sequences', () => {
    let adminToken: string;
    let pmToken: string;
    let orgId: string;
    let roleMap: Map<string, string>;

    beforeAll(async () => {
      const { token } = await createVerifiedUser({
        email: `get_seq_admin_${runId}@test.dev`,
      });
      adminToken = token;
      const result = await createOrgWithAdmin(
        app,
        adminToken,
        `Get Seq Org ${runId}`,
      );
      orgId = result.orgId;
      roleMap = result.roleMap;

      const { user: pmUser, token: pmTok } = await createVerifiedUser({
        email: `get_seq_pm_${runId}@test.dev`,
      });
      pmToken = pmTok;
      await addMemberDirectly(orgId, pmUser.id, roleMap.get('Project Manager')!);
    });

    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/document-sequences`,
      });
      expect(res.statusCode).toBe(401);
    });

    it('cross-tenant → 403', async () => {
      const { token: stranger } = await createVerifiedUser({
        email: `get_seq_stranger_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/document-sequences`,
        headers: { authorization: `Bearer ${stranger}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Project Manager (no settings:read) → 403', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/document-sequences`,
        headers: { authorization: `Bearer ${pmToken}` },
      });
      expect(res.statusCode).toBe(403);
    });

    it('Admin → 200, 7 sequences, each has id/type/prefix/padding/nextValue/organizationId/updatedAt', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/document-sequences`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ sequences: DocumentSequenceDTO[] }>>();
      expect(body.data.sequences).toHaveLength(7);
      const seq = body.data.sequences[0]!;
      expect(seq.id).toBeDefined();
      expect(seq.type).toBeDefined();
      expect(seq.prefix).toBeDefined();
      expect(seq.padding).toBeDefined();
      expect(seq.nextValue).toBeDefined();
      expect(seq.organizationId).toBeDefined();
      expect(seq.updatedAt).toBeDefined();
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('GET /api/v1/organizations/:id/document-sequences/:type', () => {
    let adminToken: string;
    let orgId: string;
    let roleMap: Map<string, string>;

    beforeAll(async () => {
      const { token } = await createVerifiedUser({
        email: `get_seqtype_admin_${runId}@test.dev`,
      });
      adminToken = token;
      const result = await createOrgWithAdmin(
        app,
        adminToken,
        `Get Seq Type Org ${runId}`,
      );
      orgId = result.orgId;
      roleMap = result.roleMap;
    });

    it('valid type PROJECT → 200, prefix=PRJ, padding=4, nextValue=1', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/document-sequences/PROJECT`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ sequence: DocumentSequenceDTO }>>();
      expect(body.data.sequence.prefix).toBe('PRJ');
      expect(body.data.sequence.padding).toBe(4);
      expect(body.data.sequence.nextValue).toBe(1);
    });

    it('invalid type FAKETYPE → 404 NOT_FOUND', async () => {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/document-sequences/FAKETYPE`,
        headers: { authorization: `Bearer ${adminToken}` },
      });
      expect(res.statusCode).toBe(404);
    });

    it('cross-tenant → 403', async () => {
      const { token: stranger } = await createVerifiedUser({
        email: `get_seqtype_stranger_${runId}@test.dev`,
      });
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${orgId}/document-sequences/PROJECT`,
        headers: { authorization: `Bearer ${stranger}` },
      });
      expect(res.statusCode).toBe(403);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  describe('PATCH /api/v1/organizations/:id/document-sequences/:type', () => {
    let adminToken: string;
    let pmToken: string;
    let orgId: string;
    let roleMap: Map<string, string>;

    beforeAll(async () => {
      const { token } = await createVerifiedUser({
        email: `patch_seq_admin_${runId}@test.dev`,
      });
      adminToken = token;
      const result = await createOrgWithAdmin(
        app,
        adminToken,
        `Patch Seq Org ${runId}`,
      );
      orgId = result.orgId;
      roleMap = result.roleMap;

      const { user: pmUser, token: pmTok } = await createVerifiedUser({
        email: `patch_seq_pm_${runId}@test.dev`,
      });
      pmToken = pmTok;
      await addMemberDirectly(orgId, pmUser.id, roleMap.get('Project Manager')!);
    });

    it('no auth → 401', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/PROJECT`,
        payload: { prefix: 'P' },
      });
      expect(res.statusCode).toBe(401);
    });

    it('missing settings:update → 403', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/PROJECT`,
        headers: { authorization: `Bearer ${pmToken}` },
        payload: { prefix: 'P' },
      });
      expect(res.statusCode).toBe(403);
    });

    it('invalid type FAKETYPE → 404', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/FAKETYPE`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { prefix: 'X' },
      });
      expect(res.statusCode).toBe(404);
    });

    it('prefix "" → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/PROJECT`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { prefix: '' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('prefix 11-char string → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/PROJECT`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { prefix: 'X'.repeat(11) },
      });
      expect(res.statusCode).toBe(422);
    });

    it('padding 0 → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/PROJECT`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { padding: 0 },
      });
      expect(res.statusCode).toBe(422);
    });

    it('padding 11 → 422', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/PROJECT`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { padding: 11 },
      });
      expect(res.statusCode).toBe(422);
    });

    it('nextValue 999 in body → 200, nextValue NOT changed (silently dropped), stays 1', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/ESTIMATE`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { prefix: 'EST', nextValue: 999 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ sequence: DocumentSequenceDTO }>>();
      expect(body.data.sequence.nextValue).toBe(1);
    });

    it('valid {prefix: "P", padding: 5} → 200, prefix updated, padding updated', async () => {
      const res = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/PROJECT`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { prefix: 'P', padding: 5 },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json<ApiSuccessResponse<{ sequence: DocumentSequenceDTO }>>();
      expect(body.data.sequence.prefix).toBe('P');
      expect(body.data.sequence.padding).toBe(5);
    });

    it('audit organization.document_sequence_updated written', async () => {
      const db = getDb();
      const logs = await db
        .select()
        .from(auditLogs)
        .where(eq(auditLogs.organizationId, orgId));
      expect(
        logs.some((l) => l.action === 'organization.document_sequence_updated'),
      ).toBe(true);
    });

    it('calling twice with same values (idempotent) → 200 both times', async () => {
      const first = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/INVOICE`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { prefix: 'INV', padding: 4 },
      });
      expect(first.statusCode).toBe(200);

      const second = await app.inject({
        method: 'PATCH',
        url: `/api/v1/organizations/${orgId}/document-sequences/INVOICE`,
        headers: { authorization: `Bearer ${adminToken}` },
        payload: { prefix: 'INV', padding: 4 },
      });
      expect(second.statusCode).toBe(200);
    });
  });
});
