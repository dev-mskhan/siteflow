import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);

type Body = { data: Record<string, any> };

function extractId(body: Body, key: 'proposal' | 'tender'): string {
  const scoped = body.data[key] ?? body.data;
  return scoped.id as string;
}

describe('Proposal and tender (integration)', () => {
  let app: FastifyInstance;
  let token: string;
  let orgId: string;
  let projectId: string;
  let foreignToken: string;
  let foreignOrgId: string;

  const tenderPath = () => `/api/v1/organizations/${orgId}/tenders`;
  const proposalPath = (project = projectId) =>
    `/api/v1/organizations/${orgId}/projects/${project}/proposals`;

  function tenderPayload(overrides: Record<string, unknown> = {}) {
    return {
      title: `Tender ${runId}`,
      clientName: `Client ${runId}`,
      submissionDeadline: '2035-06-30T17:00:00+00:00',
      submissionTimezone: 'UTC',
      currencyCode: 'USD',
      ...overrides,
    };
  }

  function proposalPayload(overrides: Record<string, unknown> = {}) {
    return {
      title: `Proposal ${runId}`,
      currencyCode: 'USD',
      lines: [],
      ...overrides,
    };
  }

  async function createProposal(payload: Record<string, unknown> = proposalPayload()) {
    return app.inject({
      method: 'POST',
      url: proposalPath(),
      headers: { authorization: `Bearer ${token}` },
      payload,
    });
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `prop_owner_${runId}@example.com` });
    token = owner.token;
    orgId = (await createOrgWithAdmin(app, token, `Prop Org ${runId}`)).orgId;

    const trialRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/trial`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(trialRes.statusCode).toBe(201);

    const projectRes = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects`,
      headers: { authorization: `Bearer ${token}` },
      payload: { name: `Prop Project ${runId}`, currency: 'USD' },
    });
    expect(projectRes.statusCode).toBe(201);
    projectId = projectRes.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project.id;

    const foreign = await createVerifiedUser({ email: `prop_foreign_${runId}@example.com` });
    foreignToken = foreign.token;
    foreignOrgId = (await createOrgWithAdmin(app, foreignToken, `Prop Foreign ${runId}`)).orgId;
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  describe('tenders', () => {
    it('rejects anonymous tender creation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: tenderPath(),
        payload: tenderPayload(),
      });
      expect(res.statusCode).toBe(401);
    });

    it('rejects tender payloads missing required fields', async () => {
      const res = await app.inject({
        method: 'POST',
        url: tenderPath(),
        headers: { authorization: `Bearer ${token}` },
        payload: tenderPayload({ clientName: undefined }),
      });
      expect(res.statusCode).toBe(422);
    });

    it('creates, reads, and lists a tender', async () => {
      const created = await app.inject({
        method: 'POST',
        url: tenderPath(),
        headers: { authorization: `Bearer ${token}` },
        payload: tenderPayload(),
      });
      expect(created.statusCode).toBe(201);
      const tenderId = extractId(created.json<Body>(), 'tender');

      const fetched = await app.inject({
        method: 'GET',
        url: `${tenderPath()}/${tenderId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(fetched.statusCode).toBe(200);
      expect(extractId(fetched.json<Body>(), 'tender')).toBe(tenderId);

      const listed = await app.inject({
        method: 'GET',
        url: tenderPath(),
        headers: { authorization: `Bearer ${token}` },
      });
      expect(listed.statusCode).toBe(200);
      expect(JSON.stringify(listed.json())).toContain(tenderId);
    });

    it('hides tenders from another organization', async () => {
      const created = await app.inject({
        method: 'POST',
        url: tenderPath(),
        headers: { authorization: `Bearer ${token}` },
        payload: tenderPayload({ title: `Hidden ${runId}` }),
      });
      expect(created.statusCode).toBe(201);
      const tenderId = extractId(created.json<Body>(), 'tender');

      const foreignRead = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${foreignOrgId}/tenders/${tenderId}`,
        headers: { authorization: `Bearer ${foreignToken}` },
      });
      expect(foreignRead.statusCode).not.toBe(200);
    });
  });

  describe('proposals', () => {
    it('rejects anonymous proposal creation', async () => {
      const res = await app.inject({
        method: 'POST',
        url: proposalPath(),
        payload: proposalPayload(),
      });
      expect(res.statusCode).toBe(401);
    });

    it('requires a tax basis when tax percent is above zero', async () => {
      const res = await createProposal(proposalPayload({ taxPercent: '5' }));
      expect(res.statusCode).toBe(422);
    });

    it('creates a draft proposal and reads it back', async () => {
      const created = await createProposal();
      expect(created.statusCode).toBe(201);
      const proposalId = extractId(created.json<Body>(), 'proposal');

      const fetched = await app.inject({
        method: 'GET',
        url: `${proposalPath()}/${proposalId}`,
        headers: { authorization: `Bearer ${token}` },
      });
      expect(fetched.statusCode).toBe(200);
      expect(extractId(fetched.json<Body>(), 'proposal')).toBe(proposalId);
    });

    it('rejects an update with a stale expectedVersion', async () => {
      const created = await createProposal();
      expect(created.statusCode).toBe(201);
      const proposalId = extractId(created.json<Body>(), 'proposal');

      const res = await app.inject({
        method: 'PATCH',
        url: `${proposalPath()}/${proposalId}`,
        headers: { authorization: `Bearer ${token}` },
        payload: proposalPayload({ title: `Stale ${runId}`, expectedVersion: 999 }),
      });
      expect(res.statusCode).toBe(409);
      expect(res.json().error?.code ?? res.json().code).toMatch(/VERSION_CONFLICT/);
    });

    it('blocks access to a proposal from another organization', async () => {
      const created = await createProposal();
      const proposalId = extractId(created.json<Body>(), 'proposal');

      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/organizations/${foreignOrgId}/projects/${projectId}/proposals/${proposalId}`,
        headers: { authorization: `Bearer ${foreignToken}` },
      });
      expect(res.statusCode).not.toBe(200);
    });

    it('requires a reason of at least 10 characters to reject', async () => {
      const created = await createProposal();
      const proposalId = extractId(created.json<Body>(), 'proposal');

      const res = await app.inject({
        method: 'POST',
        url: `${proposalPath()}/${proposalId}/reject`,
        headers: { authorization: `Bearer ${token}` },
        payload: { expectedVersion: 1, reason: 'short' },
      });
      expect(res.statusCode).toBe(422);
    });

    it('submits a draft proposal for approval', async () => {
      const created = await createProposal();
      const proposalId = extractId(created.json<Body>(), 'proposal');
      const version = created.json<Body>().data.proposal?.version ?? created.json<Body>().data.version;

      const res = await app.inject({
        method: 'POST',
        url: `${proposalPath()}/${proposalId}/submit`,
        headers: { authorization: `****** },
        payload: { expectedVersion: version },
      });
      expect(res.statusCode).toBe(200);

      const fetched = await app.inject({
        method: 'GET',
        url: `${proposalPath()}/${proposalId}`,
        headers: { authorization: `****** },
      });
      const detail = fetched.json<Body>().data.proposal ?? fetched.json<Body>().data;
      expect(detail.status).toBe('PENDING_APPROVAL');
    });

    it('rejects submit with a stale expectedVersion', async () => {
      const created = await createProposal();
      const proposalId = extractId(created.json<Body>(), 'proposal');

      const res = await app.inject({
        method: 'POST',
        url: `${proposalPath()}/${proposalId}/submit`,
        headers: { authorization: `****** },
        payload: { expectedVersion: 999 },
      });
      expect(res.statusCode).toBe(409);
    });

    it('does not let the submitter approve their own proposal', async () => {
      const created = await createProposal();
      const proposalId = extractId(created.json<Body>(), 'proposal');
      const version = created.json<Body>().data.proposal?.version ?? created.json<Body>().data.version;

      const submitted = await app.inject({
        method: 'POST',
        url: `${proposalPath()}/${proposalId}/submit`,
        headers: { authorization: `****** },
        payload: { expectedVersion: version },
      });
      expect(submitted.statusCode).toBe(200);

      const approved = await app.inject({
        method: 'POST',
        url: `${proposalPath()}/${proposalId}/approve`,
        headers: { authorization: `****** },
        payload: { expectedVersion: version + 1 },
      });
      expect(approved.statusCode).toBeGreaterThanOrEqual(400);

      const fetched = await app.inject({
        method: 'GET',
        url: `${proposalPath()}/${proposalId}`,
        headers: { authorization: `****** },
      });
      const detail = fetched.json<Body>().data.proposal ?? fetched.json<Body>().data;
      expect(detail.status).toBe('PENDING_APPROVAL');
    });
  });
});
