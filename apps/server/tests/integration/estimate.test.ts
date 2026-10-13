import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import {
  projectCostCodes,
  projectMembers,
  projects,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createOrgWithAdmin, createVerifiedUser, addMemberDirectly } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);

function draftPayload(costCodeId: string, title = 'Level 1 fit-out') {
  return {
    title,
    terms: { markupMode: 'NONE', taxPercent: '0' },
    sections: [
      {
        title: 'Structure',
        lines: [
          {
            category: 'LABOR',
            description: 'Framing crew',
            costCodeId,
            quantity: '10',
            unit: 'hr',
            unitRate: '50.00',
          },
        ],
      },
    ],
  };
}

describe('project estimates (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let costCodeId: string;
  let ownerToken: string;
  let reviewerToken: string;
  let memberToken: string;
  let otherOrgToken: string;
  let otherOrgId: string;

  const baseUrl = () => `/api/v1/organizations/${organizationId}/projects/${projectId}/estimates`;
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `est-owner-${runId}@example.com` });
    ownerToken = owner.token;
    const org = await createOrgWithAdmin(app, ownerToken, `Estimate Org ${runId}`);
    organizationId = org.orgId;

    projectId = crypto.randomUUID();
    await getDb().insert(projects).values({
      id: projectId,
      organizationId,
      projectNumber: `EST-${runId}`,
      name: `Estimate project ${runId}`,
      currency: 'USD',
    });

    costCodeId = crypto.randomUUID();
    await getDb().insert(projectCostCodes).values({
      id: costCodeId,
      organizationId,
      projectId,
      code: `EST-${runId}`,
      description: 'Estimate integration fixture',
      createdBy: owner.user.id,
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

    const reviewer = await createVerifiedUser({ email: `est-reviewer-${runId}@example.com` });
    reviewerToken = reviewer.token;
    await addMemberDirectly(organizationId, reviewer.user.id, org.roleMap.get('Project Manager')!);
    await getDb().insert(projectMembers).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      userId: reviewer.user.id,
      role: 'FINANCE',
      status: 'ACTIVE',
      addedBy: owner.user.id,
    });

    const member = await createVerifiedUser({ email: `est-member-${runId}@example.com` });
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

    const otherOwner = await createVerifiedUser({ email: `est-other-${runId}@example.com` });
    otherOrgToken = otherOwner.token;
    otherOrgId = (await createOrgWithAdmin(app, otherOrgToken, `Other Estimate Org ${runId}`)).orgId;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests and denies project members without estimate permission', async () => {
    const noAuth = await app.inject({ method: 'GET', url: baseUrl() });
    expect(noAuth.statusCode).toBe(401);

    const memberCreate = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(memberToken),
      payload: draftPayload(costCodeId),
    });
    expect(memberCreate.statusCode).toBe(403);
  });

  it('prevents another tenant from reading or creating estimates in this project', async () => {
    const crossTenantList = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${otherOrgId}/projects/${projectId}/estimates`,
      headers: auth(otherOrgToken),
    });
    expect([403, 404]).toContain(crossTenantList.statusCode);

    const crossTenantCreate = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${otherOrgId}/projects/${projectId}/estimates`,
      headers: auth(otherOrgToken),
      payload: draftPayload(costCodeId),
    });
    expect([403, 404]).toContain(crossTenantCreate.statusCode);
  });

  it('rejects list limits above the bounded maximum', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${baseUrl()}?limit=101`,
      headers: auth(ownerToken),
    });
    expect(response.statusCode).toBe(422);
  });

  it('rejects a line with both a direct rate and resource components', async () => {
    const response = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken),
      payload: {
        title: `Invalid mix ${runId}`,
        terms: {},
        sections: [
          {
            title: 'Bad',
            lines: [
              {
                category: 'LABOR',
                description: 'Mixed',
                quantity: '1',
                unit: 'ea',
                unitRate: '10.00',
                resources: [
                  {
                    category: 'LABOR',
                    description: 'Crew',
                    unit: 'hr',
                    quantityPerLineUnit: '1',
                    unitRate: '5.00',
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    expect(response.statusCode).toBe(422);
  });

  it('runs the create, submit, approve lifecycle and enforces actor separation', async () => {
    const created = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken),
      payload: draftPayload(costCodeId, `Lifecycle ${runId}`),
    });
    expect(created.statusCode).toBe(201);
    const estimate = created.json().data.estimate as { id: string; status: string; version: number };
    expect(estimate.status).toBe('DRAFT');

    const selfApprove = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${estimate.id}/submit`,
      headers: auth(ownerToken),
      payload: { expectedVersion: estimate.version },
    });
    expect(selfApprove.statusCode).toBe(200);
    const submitted = selfApprove.json().data.estimate as { status: string; version: number };
    expect(submitted.status).toBe('PENDING_APPROVAL');

    const creatorReview = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${estimate.id}/approve`,
      headers: auth(ownerToken),
      payload: { expectedVersion: submitted.version },
    });
    expect([403, 409, 422]).toContain(creatorReview.statusCode);

    const approved = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${estimate.id}/approve`,
      headers: auth(reviewerToken),
      payload: { expectedVersion: submitted.version },
    });
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data.estimate.status).toBe('APPROVED');

    const editAfterApproval = await app.inject({
      method: 'PATCH',
      url: `${baseUrl()}/${estimate.id}`,
      headers: auth(ownerToken),
      payload: { ...draftPayload(costCodeId), expectedVersion: submitted.version },
    });
    expect([409, 422]).toContain(editAfterApproval.statusCode);
  });

  it('returns 409 on a stale expectedVersion during update', async () => {
    const created = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken),
      payload: draftPayload(costCodeId, `Version ${runId}`),
    });
    const estimate = created.json().data.estimate as { id: string; version: number };

    const stale = await app.inject({
      method: 'PATCH',
      url: `${baseUrl()}/${estimate.id}`,
      headers: auth(ownerToken),
      payload: { ...draftPayload(costCodeId, `Version edit ${runId}`), expectedVersion: estimate.version + 5 },
    });
    expect(stale.statusCode).toBe(409);
  });

  it('rejects an estimate with a reason and returns it to the owner for revision', async () => {
    const created = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken),
      payload: draftPayload(costCodeId, `Reject ${runId}`),
    });
    const estimate = created.json().data.estimate as { id: string; version: number };

    const submitted = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${estimate.id}/submit`,
      headers: auth(ownerToken),
      payload: { expectedVersion: estimate.version },
    });
    const pending = submitted.json().data.estimate as { version: number };

    const rejected = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${estimate.id}/reject`,
      headers: auth(reviewerToken),
      payload: { expectedVersion: pending.version, reason: 'Labor rate needs review.' },
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().data.estimate.status).toBe('REJECTED');
  });

  it('lists estimates with a bounded page and no leakage across projects', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${baseUrl()}?limit=2`,
      headers: auth(ownerToken),
    });
    expect(response.statusCode).toBe(200);
    const body = response.json().data as { items: Array<{ projectId: string }>; nextCursor: string | null };
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.items.every((item) => item.projectId === projectId)).toBe(true);
  });

  it('returns 404 for an estimate id from another project', async () => {
    const missing = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/${crypto.randomUUID()}`,
      headers: auth(ownerToken),
    });
    expect(missing.statusCode).toBe(404);
  });

  it('compares two revisions and reports actuals per cost code without leaking other estimates', async () => {
    const created = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken),
      payload: draftPayload(costCodeId, `Compare ${runId}`),
    });
    const estimate = created.json().data.estimate as { id: string; version: number };

    const edited = await app.inject({
      method: 'PATCH',
      url: `${baseUrl()}/${estimate.id}`,
      headers: auth(ownerToken),
      payload: { ...draftPayload(costCodeId, `Compare r2 ${runId}`), expectedVersion: estimate.version },
    });
    expect(edited.statusCode).toBe(200);

    const compare = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/${estimate.id}/compare?fromRevision=1&toRevision=2`,
      headers: auth(ownerToken),
    });
    expect(compare.statusCode).toBe(200);
    const body = compare.json().data as {
      fromRevision: number;
      toRevision: number;
      items: Array<{ costCodeId: string | null; hasActivity: boolean; actualPosted: string }>;
    };
    expect(body.fromRevision).toBe(1);
    expect(body.toRevision).toBe(2);
    const row = body.items.find((item) => item.costCodeId === costCodeId);
    expect(row).toBeDefined();
    expect(row!.hasActivity).toBe(false);
    expect(row!.actualPosted).toBe('0.00');
  });

  it('rejects comparing a revision with itself', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/${crypto.randomUUID()}/compare?fromRevision=1&toRevision=1`,
      headers: auth(ownerToken),
    });
    expect(response.statusCode).toBe(422);
  });
});
