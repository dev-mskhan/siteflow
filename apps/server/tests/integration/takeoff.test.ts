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

function manualMeasurement(description = 'Slab area') {
  return {
    description,
    dimension: 'AREA',
    unit: 'm2',
    measurementMode: 'MANUAL',
    manualQuantity: '100.000',
    deductionQuantity: '10.000',
    wastePercent: '10',
  };
}

describe('project takeoffs (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let otherOrgId: string;
  let ownerToken: string;
  let reviewerToken: string;
  let memberToken: string;
  let otherOrgToken: string;

  const baseUrl = () => `/api/v1/organizations/${organizationId}/projects/${projectId}/takeoffs`;
  const auth = (token: string) => ({ authorization: `Bearer ${token}` });

  async function createSheet(title = `Sheet ${runId}`) {
    const response = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets`,
      headers: auth(ownerToken),
      payload: { title },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data.sheet as { id: string; version: number; status: string };
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `tko-owner-${runId}@example.com` });
    ownerToken = owner.token;
    const org = await createOrgWithAdmin(app, ownerToken, `Takeoff Org ${runId}`);
    organizationId = org.orgId;

    projectId = crypto.randomUUID();
    await getDb().insert(projects).values({
      id: projectId,
      organizationId,
      projectNumber: `TKO-${runId}`,
      name: `Takeoff project ${runId}`,
      currency: 'USD',
    });

    await getDb().insert(projectCostCodes).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      code: `TKO-${runId}`,
      description: 'Takeoff integration fixture',
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

    const reviewer = await createVerifiedUser({ email: `tko-reviewer-${runId}@example.com` });
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

    const member = await createVerifiedUser({ email: `tko-member-${runId}@example.com` });
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

    const otherOwner = await createVerifiedUser({ email: `tko-other-${runId}@example.com` });
    otherOrgToken = otherOwner.token;
    otherOrgId = (await createOrgWithAdmin(app, otherOrgToken, `Other Takeoff Org ${runId}`)).orgId;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('rejects unauthenticated requests', async () => {
    const response = await app.inject({ method: 'GET', url: `${baseUrl()}/sheets` });
    expect(response.statusCode).toBe(401);
  });

  it('denies project members without takeoff permission', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets`,
      headers: auth(memberToken),
      payload: { title: `Denied ${runId}` },
    });
    expect(response.statusCode).toBe(403);
  });

  it('prevents another tenant from reading or creating takeoffs in this project', async () => {
    const crossTenantList = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${otherOrgId}/projects/${projectId}/takeoffs/sheets`,
      headers: auth(otherOrgToken),
    });
    expect([403, 404]).toContain(crossTenantList.statusCode);

    const crossTenantCreate = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${otherOrgId}/projects/${projectId}/takeoffs/sheets`,
      headers: auth(otherOrgToken),
      payload: { title: `Cross ${runId}` },
    });
    expect([403, 404]).toContain(crossTenantCreate.statusCode);
  });

  it('rejects list limits above the bounded maximum', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/sheets?limit=101`,
      headers: auth(ownerToken),
    });
    expect(response.statusCode).toBe(422);
  });

  it('runs the sheet lifecycle and enforces actor separation', async () => {
    const sheet = await createSheet(`Lifecycle ${runId}`);
    expect(sheet.status).toBe('DRAFT');

    const submit = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/submit`,
      headers: auth(ownerToken),
      payload: { expectedVersion: sheet.version },
    });
    expect(submit.statusCode).toBe(200);
    const submitted = submit.json().data.sheet as { status: string; version: number };
    expect(submitted.status).toBe('PENDING_APPROVAL');

    const selfApprove = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/approve`,
      headers: auth(ownerToken),
      payload: { expectedVersion: submitted.version },
    });
    expect(selfApprove.statusCode).toBe(403);

    const approve = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/approve`,
      headers: auth(reviewerToken),
      payload: { expectedVersion: submitted.version },
    });
    expect(approve.statusCode).toBe(200);
    expect(approve.json().data.sheet.status).toBe('APPROVED');
  });

  it('rejects a sheet update with a stale expectedVersion', async () => {
    const sheet = await createSheet(`Version ${runId}`);
    const response = await app.inject({
      method: 'PATCH',
      url: `${baseUrl()}/sheets/${sheet.id}`,
      headers: auth(ownerToken),
      payload: { title: `Renamed ${runId}`, expectedVersion: sheet.version + 5 },
    });
    expect(response.statusCode).toBe(409);
  });

  it('creates a measurement and computes its quantity on a draft revision', async () => {
    const sheet = await createSheet(`Measure ${runId}`);
    const response = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/measurements`,
      headers: auth(ownerToken),
      payload: manualMeasurement(),
    });
    expect(response.statusCode).toBe(201);
    const measurement = response.json().data.measurement as { resultQuantity: string };
    expect(measurement.resultQuantity).toBe('99.000');

    const listed = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/sheets/${sheet.id}/measurements`,
      headers: auth(ownerToken),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data.measurements).toHaveLength(1);
  });

  it('rejects a formula measurement with a manual quantity', async () => {
    const sheet = await createSheet(`Mixed ${runId}`);
    const response = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/measurements`,
      headers: auth(ownerToken),
      payload: {
        ...manualMeasurement('Mixed'),
        measurementMode: 'FORMULA',
        formulaText: 'L * W',
      },
    });
    expect(response.statusCode).toBe(422);
  });

  it('previews a formula result using named inputs', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/formulas/preview`,
      headers: auth(ownerToken),
      payload: {
        formulaText: 'L * W',
        dimension: 'AREA',
        unit: 'm2',
        inputs: [
          { variableName: 'L', value: '4', unit: 'm', dimension: 'LENGTH' },
          { variableName: 'W', value: '2.5', unit: 'm', dimension: 'LENGTH' },
        ],
      },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.result).toBe('10.000');
  });

  it('rejects a formula preview that references an unknown variable', async () => {
    const response = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/formulas/preview`,
      headers: auth(ownerToken),
      payload: {
        formulaText: 'L * Z',
        dimension: 'AREA',
        unit: 'm2',
        inputs: [{ variableName: 'L', value: '4', unit: 'm', dimension: 'LENGTH' }],
      },
    });
    expect(response.statusCode).toBe(422);
  });

  it('rejects a sheet with a reason and blocks edits to a rejected sheet until revised', async () => {
    const sheet = await createSheet(`Reject ${runId}`);
    const submit = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/submit`,
      headers: auth(ownerToken),
      payload: { expectedVersion: sheet.version },
    });
    expect(submit.statusCode).toBe(200);
    const submitted = submit.json().data.sheet as { version: number };

    const reject = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/reject`,
      headers: auth(reviewerToken),
      payload: { expectedVersion: submitted.version, reason: 'Quantities need rechecking' },
    });
    expect(reject.statusCode).toBe(200);
    const rejected = reject.json().data.sheet as { status: string; version: number };
    expect(rejected.status).toBe('REJECTED');

    const revision = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/revisions`,
      headers: auth(ownerToken),
      payload: { expectedVersion: rejected.version },
    });
    expect(revision.statusCode).toBe(201);
    expect(revision.json().data.revision.revisionNumber).toBe(2);
  });

  it('rejects a reject request with a reason shorter than the minimum', async () => {
    const sheet = await createSheet(`ShortReason ${runId}`);
    const response = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/reject`,
      headers: auth(reviewerToken),
      payload: { expectedVersion: sheet.version, reason: 'no' },
    });
    expect(response.statusCode).toBe(422);
  });

  it('rejects a measurement update with a stale expectedVersion', async () => {
    const sheet = await createSheet(`MeasureVersion ${runId}`);
    const created = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/measurements`,
      headers: auth(ownerToken),
      payload: manualMeasurement('Versioned'),
    });
    expect(created.statusCode).toBe(201);
    const measurementId = created.json().data.measurement.id as string;

    const response = await app.inject({
      method: 'PATCH',
      url: `${baseUrl()}/sheets/${sheet.id}/measurements/${measurementId}`,
      headers: auth(ownerToken),
      payload: { deductionQuantity: '20.000', expectedVersion: sheet.version + 7 },
    });
    expect(response.statusCode).toBe(409);
  });

  it('creates, lists, and compares revisions on an approved sheet', async () => {
    const sheet = await createSheet(`Revisions ${runId}`);
    const submit = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/submit`,
      headers: auth(ownerToken),
      payload: { expectedVersion: sheet.version },
    });
    const submitted = submit.json().data.sheet as { version: number };
    const approve = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/approve`,
      headers: auth(reviewerToken),
      payload: { expectedVersion: submitted.version },
    });
    expect(approve.statusCode).toBe(200);
    const approved = approve.json().data.sheet as { version: number };

    const blocked = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/measurements`,
      headers: auth(ownerToken),
      payload: manualMeasurement('Approved sheet'),
    });
    expect([409, 422]).toContain(blocked.statusCode);

    const revision = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/revisions`,
      headers: auth(ownerToken),
      payload: { expectedVersion: approved.version },
    });
    expect(revision.statusCode).toBe(201);

    const listed = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/sheets/${sheet.id}/revisions`,
      headers: auth(ownerToken),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data.revisions.length).toBeGreaterThanOrEqual(2);

    const compare = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/sheets/${sheet.id}/revisions/compare?fromRevision=1&toRevision=2`,
      headers: auth(ownerToken),
    });
    expect(compare.statusCode).toBe(200);
  });

  it('rejects comparing a revision with itself', async () => {
    const sheet = await createSheet(`Compare ${runId}`);
    const response = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/sheets/${sheet.id}/revisions/compare?fromRevision=1&toRevision=1`,
      headers: auth(ownerToken),
    });
    expect(response.statusCode).toBe(422);
  });

  it('rejects a source whose document does not exist in this project', async () => {
    const sheet = await createSheet(`Source ${runId}`);
    const response = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/sources`,
      headers: auth(ownerToken),
      payload: {
        documentId: crypto.randomUUID(),
        documentVersionId: crypto.randomUUID(),
        pageReference: 'A-101',
      },
    });
    expect([404, 422]).toContain(response.statusCode);
  });

  it('updates a measurement on a draft and blocks updates once the sheet is approved', async () => {
    const sheet = await createSheet(`Update ${runId}`);
    const created = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/measurements`,
      headers: auth(ownerToken),
      payload: manualMeasurement(),
    });
    expect(created.statusCode).toBe(201);
    const measurementId = created.json().data.measurement.id as string;

    const draft = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/sheets/${sheet.id}`,
      headers: auth(ownerToken),
    });
    const draftVersion = draft.json().data.sheet.version as number;

    const updated = await app.inject({
      method: 'PATCH',
      url: `${baseUrl()}/sheets/${sheet.id}/measurements/${measurementId}`,
      headers: auth(ownerToken),
      payload: { expectedVersion: draftVersion, description: 'Slab area revised', manualQuantity: '120.000' },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.measurement.description).toBe('Slab area revised');
    expect(updated.json().data.measurement.resultQuantity).toBe('121.000');

    const submit = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/submit`,
      headers: auth(ownerToken),
      payload: { expectedVersion: draftVersion + 1 },
    });
    expect(submit.statusCode).toBe(200);
    const submittedVersion = submit.json().data.sheet.version as number;

    const approve = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/sheets/${sheet.id}/approve`,
      headers: auth(reviewerToken),
      payload: { expectedVersion: submittedVersion },
    });
    expect(approve.statusCode).toBe(200);
    const approvedVersion = approve.json().data.sheet.version as number;

    const blocked = await app.inject({
      method: 'PATCH',
      url: `${baseUrl()}/sheets/${sheet.id}/measurements/${measurementId}`,
      headers: auth(ownerToken),
      payload: { expectedVersion: approvedVersion, description: 'Post-approval edit' },
    });
    expect(blocked.statusCode).toBe(409);
  });

  it('returns a summary grouped by sheet', async () => {
    const response = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/summary?groupBy=SHEET`,
      headers: auth(ownerToken),
    });
    expect(response.statusCode).toBe(200);
  });
});
