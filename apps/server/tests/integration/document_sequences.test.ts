// apps/server/tests/integration/document_sequences.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { getDb } from '../../src/lib/db/index.js';
import { users, auditLogs } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';
import { createAccessToken } from '../../src/modules/auth/token.service.js';
import type { ApiSuccessResponse, ApiErrorResponse } from '../../src/shared/response.js';
import type { DocumentSequenceDTO } from '../../src/modules/organization/sequences/sequences.types.js';
import type { OrgDTO } from '../../src/modules/organization/organization.types.js';

describe('Document Sequences API (Integration)', () => {
  let app: FastifyInstance;
  let authToken: string;
  let userId: string;
  let createdOrgId: string;
  const runId = Math.random().toString(36).substring(7);
  const testEmail = `sequences_owner_${runId}@example.com`;

  beforeAll(async () => {
    app = await createTestApp();
    const db = getDb();

    // Insert test user with verified email
    const insertedUser = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: testEmail,
        passwordHash: 'dummyhash',
        firstName: 'Test',
        lastName: 'User',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      })
      .returning();

    userId = insertedUser[0]!.id;
    authToken = createAccessToken({ sub: userId, email: testEmail, status: 'ACTIVE' });

    // Create an org via the API (also creates profile, settings, sequences atomically)
    const orgRes = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations',
      headers: { authorization: `Bearer ${authToken}` },
      payload: { name: `Sequences Test Org ${runId}` },
    });

    expect(orgRes.statusCode).toBe(201);
    createdOrgId = orgRes.json<ApiSuccessResponse<{ organization: OrgDTO }>>().data.organization.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /document-sequences returns 7 default sequences', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/document-sequences`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<{ sequences: DocumentSequenceDTO[] }>>();
    expect(body.success).toBe(true);
    expect(body.data.sequences).toHaveLength(7);

    const types = body.data.sequences.map((s) => s.type);
    expect(types).toContain('PROJECT');
    expect(types).toContain('ESTIMATE');
    expect(types).toContain('INVOICE');
    expect(types).toContain('PURCHASE_ORDER');
    expect(types).toContain('CHANGE_ORDER');
    expect(types).toContain('RFI');
    expect(types).toContain('SUBMITTAL');
  });

  it('GET /document-sequences/PROJECT returns the PROJECT sequence', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/document-sequences/PROJECT`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<{ sequence: DocumentSequenceDTO }>>();
    expect(body.success).toBe(true);
    expect(body.data.sequence.type).toBe('PROJECT');
    expect(body.data.sequence.prefix).toBe('PRJ');
    expect(body.data.sequence.padding).toBe(4);
    expect(body.data.sequence.nextValue).toBe(1);
  });

  it('PATCH /document-sequences/PROJECT with prefix and padding returns 200 with updated sequence', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrgId}/document-sequences/PROJECT`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        prefix: 'P',
        padding: 5,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<{ sequence: DocumentSequenceDTO }>>();
    expect(body.success).toBe(true);
    expect(body.data.sequence.prefix).toBe('P');
    expect(body.data.sequence.padding).toBe(5);
    expect(body.data.sequence.type).toBe('PROJECT');
  });

  it('GET after PATCH returns the new prefix', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/document-sequences/PROJECT`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(200);
    const body = res.json<ApiSuccessResponse<{ sequence: DocumentSequenceDTO }>>();
    expect(body.data.sequence.prefix).toBe('P');
    expect(body.data.sequence.padding).toBe(5);
  });

  it('PATCH with nextValue in body — field is stripped/ignored, returns 200', async () => {
    // First record the current nextValue
    const beforeRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/document-sequences/ESTIMATE`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    const beforeNextValue = beforeRes.json<ApiSuccessResponse<{ sequence: DocumentSequenceDTO }>>()
      .data.sequence.nextValue;

    // PATCH with nextValue included — it should be ignored
    const patchRes = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${createdOrgId}/document-sequences/ESTIMATE`,
      headers: { authorization: `Bearer ${authToken}` },
      payload: {
        prefix: 'EST',
        // nextValue intentionally sent to verify it is stripped
        nextValue: 9999,
      },
    });

    // Should succeed (extra fields are stripped by the validation schema)
    expect(patchRes.statusCode).toBe(200);

    // Verify nextValue is unchanged after the patch
    const afterRes = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/document-sequences/ESTIMATE`,
      headers: { authorization: `Bearer ${authToken}` },
    });
    const afterNextValue = afterRes.json<ApiSuccessResponse<{ sequence: DocumentSequenceDTO }>>()
      .data.sequence.nextValue;

    expect(afterNextValue).toBe(beforeNextValue);
  });

  it('organization.document_sequence_updated audit log written after PATCH', async () => {
    const db = getDb();
    const logs = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.organizationId, createdOrgId));

    const actions = logs.map((l) => l.action);
    expect(actions).toContain('organization.document_sequence_updated');

    const seqLog = logs.find((l) => l.action === 'organization.document_sequence_updated')!;
    expect(seqLog.actorUserId).toBe(userId);
    expect(seqLog.resourceType).toBe('DocumentSequence');
  });

  it('GET /document-sequences/INVALID_TYPE returns 404', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/document-sequences/INVALID_TYPE`,
      headers: { authorization: `Bearer ${authToken}` },
    });

    expect(res.statusCode).toBe(404);
    const body = res.json<ApiErrorResponse>();
    expect(body.success).toBe(false);
  });

  it('non-member user returns 403', async () => {
    const db = getDb();
    const nonMemberEmail = `nonmember_sequences_${runId}@example.com`;

    const nonMember = await db
      .insert(users)
      .values({
        id: crypto.randomUUID(),
        email: nonMemberEmail,
        passwordHash: 'dummyhash',
        firstName: 'Non',
        lastName: 'Member',
        status: 'ACTIVE',
        emailVerifiedAt: new Date(),
      })
      .returning();

    const nonMemberToken = createAccessToken({
      sub: nonMember[0]!.id,
      email: nonMemberEmail,
      status: 'ACTIVE',
    });

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${createdOrgId}/document-sequences`,
      headers: { authorization: `Bearer ${nonMemberToken}` },
    });

    expect(res.statusCode).toBe(403);
  });
});
