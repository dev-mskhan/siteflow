import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { projectMembers, projects } from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createOrgWithAdmin, createVerifiedUser, addMemberDirectly } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);

const HEADER = 'item_key,section_key,description,unit,quantity,unit_rate';
const VALID_CSV = [
  HEADER,
  'A1,S1,Concrete slab,m3,2.5,10.01',
  'A2,S1,Rebar,kg,100,1.20',
  'B1,S2,Brickwork,m2,40,25.00',
].join('\n');
const INVALID_CSV = [HEADER, 'A1,S1,Concrete slab,m3,-1,10.00'].join('\n');

describe('project BOQ (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let ownerToken: string;
  let approverToken: string;
  let memberToken: string;
  let otherOrgToken: string;

  const baseUrl = () => `/api/v1/organizations/${organizationId}/projects/${projectId}/boqs`;
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  async function createBoq(title = 'Level 1 BOQ') {
    const res = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken),
      payload: { title, currencyCode: 'USD' },
    });
    expect(res.statusCode).toBe(201);
    return res.json().data.boq as { id: string; version: number; status: string };
  }

  async function previewImport(boqId: string, version: number, csvText: string) {
    return app.inject({
      method: 'POST',
      url: `${baseUrl()}/${boqId}/imports/preview`,
      headers: auth(ownerToken),
      payload: { csvText, expectedVersion: version },
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `boq-owner-${runId}@example.com` });
    ownerToken = owner.token;
    const org = await createOrgWithAdmin(app, ownerToken, `BOQ Org ${runId}`);
    organizationId = org.orgId;

    projectId = crypto.randomUUID();
    await getDb().insert(projects).values({
      id: projectId,
      organizationId,
      projectNumber: `BOQ-${runId}`,
      name: `BOQ project ${runId}`,
      currency: 'USD',
    });

    await getDb().insert(projectMembers).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      userId: owner.user.id,
      role: 'PROJECT_MANAGER',
      status: 'ACTIVE',
      addedBy: owner.user.id,
    });

    const approver = await createVerifiedUser({ email: `boq-approver-${runId}@example.com` });
    approverToken = approver.token;
    await addMemberDirectly(organizationId, approver.user.id, org.roleMap.get('Project Manager')!);
    await getDb().insert(projectMembers).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      userId: approver.user.id,
      role: 'PROJECT_MANAGER',
      status: 'ACTIVE',
      addedBy: owner.user.id,
    });

    const member = await createVerifiedUser({ email: `boq-member-${runId}@example.com` });
    memberToken = member.token;
    await addMemberDirectly(organizationId, member.user.id, org.roleMap.get('Project Manager')!);
    await getDb().insert(projectMembers).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      userId: member.user.id,
      role: 'PROJECT_MEMBER',
      status: 'ACTIVE',
      addedBy: owner.user.id,
    });

    const otherOwner = await createVerifiedUser({ email: `boq-other-${runId}@example.com` });
    otherOrgToken = otherOwner.token;
    await createOrgWithAdmin(app, otherOrgToken, `Other BOQ Org ${runId}`);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests and project members without BOQ permission', async () => {
    const noAuth = await app.inject({ method: 'GET', url: baseUrl() });
    expect(noAuth.statusCode).toBe(401);

    const memberCreate = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(memberToken),
      payload: { title: 'Nope', currencyCode: 'USD' },
    });
    expect(memberCreate.statusCode).toBe(403);
  });

  it('prevents another tenant from reading BOQs in this project', async () => {
    const res = await app.inject({
      method: 'GET',
      url: baseUrl(),
      headers: auth(otherOrgToken),
    });
    expect([403, 404]).toContain(res.statusCode);
  });

  it('rejects an invalid payload with 422', async () => {
    const res = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken),
      payload: { title: 'Bad', currencyCode: 'usd', extra: true },
    });
    expect(res.statusCode).toBe(422);
  });

  it('runs the full lifecycle: create, import, submit, approve, lock', async () => {
    const boq = await createBoq('Lifecycle BOQ');
    expect(boq.status).toBe('DRAFT');

    const preview = await previewImport(boq.id, boq.version, VALID_CSV);
    expect(preview.statusCode).toBe(200);
    const importId = preview.json().data.preview.importId as string;
    expect(importId).toBeTruthy();

    const commit = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${boq.id}/imports/commit`,
      headers: auth(ownerToken),
      payload: { importId, csvText: VALID_CSV, expectedVersion: boq.version },
    });
    expect(commit.statusCode).toBe(200);
    const committed = commit.json().data.boq as { version: number; status: string };
    expect(committed.status).toBe('DRAFT');
    expect(committed.version).toBe(boq.version + 1);

    const retry = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${boq.id}/imports/commit`,
      headers: auth(ownerToken),
      payload: { importId, csvText: VALID_CSV, expectedVersion: boq.version },
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().data.boq.version).toBe(committed.version);

    const submitted = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${boq.id}/submit`,
      headers: auth(ownerToken),
      payload: { expectedVersion: committed.version },
    });
    expect(submitted.statusCode).toBe(200);
    const inReview = submitted.json().data.boq as { version: number; status: string };
    expect(inReview.status).toBe('IN_REVIEW');

    const selfApprove = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${boq.id}/approve`,
      headers: auth(ownerToken),
      payload: { expectedVersion: inReview.version },
    });
    expect(selfApprove.statusCode).toBeGreaterThanOrEqual(400);

    const approved = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${boq.id}/approve`,
      headers: auth(approverToken),
      payload: { expectedVersion: inReview.version },
    });
    expect(approved.statusCode).toBe(200);
    const approvedBoq = approved.json().data.boq as { version: number; status: string };
    expect(approvedBoq.status).toBe('APPROVED');

    const locked = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${boq.id}/lock`,
      headers: auth(approverToken),
      payload: { expectedVersion: approvedBoq.version },
    });
    expect(locked.statusCode).toBe(200);
    expect(locked.json().data.boq.status).toBe('LOCKED');
  });

  it('rejects a CSV with validation errors at preview with 422', async () => {
    const boq = await createBoq('Invalid CSV BOQ');
    const res = await previewImport(boq.id, boq.version, INVALID_CSV);
    expect(res.statusCode).toBe(422);
  });

  it('rejects a commit whose CSV does not match the previewed hash', async () => {
    const boq = await createBoq('Hash mismatch BOQ');
    const preview = await previewImport(boq.id, boq.version, VALID_CSV);
    expect(preview.statusCode).toBe(200);
    const importId = preview.json().data.preview.importId as string;

    const tampered = VALID_CSV.replace('Rebar', 'Rebar 2');
    const res = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${boq.id}/imports/commit`,
      headers: auth(ownerToken),
      payload: { importId, csvText: tampered, expectedVersion: boq.version },
    });
    expect(res.statusCode).toBe(422);
  });

  it('returns 409 for a stale expectedVersion', async () => {
    const boq = await createBoq('Stale version BOQ');
    const res = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${boq.id}/submit`,
      headers: auth(ownerToken),
      payload: { expectedVersion: boq.version + 5 },
    });
    expect(res.statusCode).toBe(409);
  });

  it('exports the current revision as CSV', async () => {
    const boq = await createBoq('Export BOQ');
    const preview = await previewImport(boq.id, boq.version, VALID_CSV);
    const importId = preview.json().data.preview.importId as string;
    await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${boq.id}/imports/commit`,
      headers: auth(ownerToken),
      payload: { importId, csvText: VALID_CSV, expectedVersion: boq.version },
    });

    const res = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/${boq.id}/export`,
      headers: auth(ownerToken),
    });
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain('attachment');
    expect(res.body).toContain('Concrete slab');
  });
});
