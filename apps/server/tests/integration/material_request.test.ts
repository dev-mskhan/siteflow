import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, sql } from 'drizzle-orm';
import {
  auditLogs,
  materials,
  materialRequestItems,
  materialRequests,
  projectMembers,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createTestApp } from '../helpers/test-app.js';
import {
  addMemberDirectly,
  createOrgWithAdmin,
  createVerifiedUser,
} from '../helpers/fixtures.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const suffix = () => crypto.randomUUID().replaceAll('-', '').slice(0, 10);
const requestPath = (orgId: string, projectId: string) =>
  `/api/v1/organizations/${orgId}/projects/${projectId}/material-requests`;

describe('Material requests (integration)', () => {
  let app: FastifyInstance;
  let token: string;
  let ownerUserId: string;
  let orgId: string;
  let projectId: string;
  let otherProjectId: string;
  let otherOrgId: string;
  let otherOrgToken: string;
  let memberToken: string;
  let materialId: string;
  let otherOrgMaterialId: string;
  let otherProjectTaskId: string;

  async function createProject(org: string, auth: string, name: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${org}/projects`,
      headers: { authorization: `Bearer ${auth}` },
      payload: { name, currency: 'USD' },
    });
    expect(response.statusCode).toBe(201);
    return response.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project.id;
  }

  async function createRequest(
    project = projectId,
    auth = token,
    payload: Record<string, unknown> = validPayload(),
  ) {
    return app.inject({
      method: 'POST',
      url: requestPath(orgId, project),
      headers: { authorization: `Bearer ${auth}` },
      payload,
    });
  }

  async function createRequestData(
    project = projectId,
    auth = token,
    payload: Record<string, unknown> = validPayload(),
  ) {
    const response = await createRequest(project, auth, payload);
    expect(response.statusCode).toBe(201);
    return response.json().data;
  }

  function validPayload(overrides: Record<string, unknown> = {}) {
    return {
      priority: 'NORMAL',
      notes: `MR ${suffix()}`,
      items: [{ materialId, quantity: '2', unitCode: 'EA' }],
      ...overrides,
    };
  }

  async function createTask(project: string): Promise<string> {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/projects/${project}/tasks`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        name: `MR task ${suffix()}`,
        taskType: 'TASK',
        currentStartDate: '2026-10-05',
        currentFinishDate: '2026-10-05',
        currentDurationDays: 1,
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data.id as string;
  }

  async function getEvent(eventType: string, field: string, resourceId: string) {
    const rows = await getDb().execute(sql`
      SELECT id, event_type, organization_id, payload
      FROM app.outbox_events
      WHERE event_type = ${eventType}
        AND organization_id = ${orgId}
        AND payload ->> ${field}::text = ${resourceId}
    `);
    return Array.from(rows as unknown as Iterable<unknown>);
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `mr_owner_${runId}@example.com` });
    token = owner.token;
    ownerUserId = owner.user.id;
    const org = await createOrgWithAdmin(app, token, `MR Org ${runId}`);
    orgId = org.orgId;
    projectId = await createProject(orgId, token, `MR Project ${runId}`);
    otherProjectId = await createProject(orgId, token, `MR Other Project ${runId}`);

    const foreignUser = await createVerifiedUser({ email: `mr_foreign_${runId}@example.com` });
    otherOrgToken = foreignUser.token;
    otherOrgId = (await createOrgWithAdmin(app, otherOrgToken, `MR Foreign Org ${runId}`)).orgId;
    const foreignProjectId = await createProject(otherOrgId, otherOrgToken, `MR Foreign Project ${runId}`);

    const db = getDb();
    materialId = crypto.randomUUID();
    otherOrgMaterialId = crypto.randomUUID();
    await db.insert(materials).values([
      {
        id: materialId,
        organizationId: orgId,
        materialCode: `MR-${runId}`,
        name: `Test material ${runId}`,
        defaultUnitCode: 'EA',
      },
      {
        id: otherOrgMaterialId,
        organizationId: otherOrgId,
        materialCode: `MRF-${runId}`,
        name: `Foreign material ${runId}`,
        defaultUnitCode: 'EA',
      },
    ]);
    await db.insert(suppliers).values([
      {
        id: crypto.randomUUID(),
        organizationId: orgId,
        supplierCode: `MRS-${runId}`,
        legalName: `MR Supplier ${runId}`,
        displayName: `MR Supplier ${runId}`,
      },
      {
        id: crypto.randomUUID(),
        organizationId: otherOrgId,
        supplierCode: `MRSF-${runId}`,
        legalName: `Foreign MR Supplier ${runId}`,
        displayName: `Foreign MR Supplier ${runId}`,
      },
    ]);
    otherProjectTaskId = await createTask(otherProjectId);
    // Also exercise creation of an actual tenant-owned request for the foreign project.
    const foreignMaterial = otherOrgMaterialId;
    const foreignRequest = await app.inject({
      method: 'POST',
      url: requestPath(otherOrgId, foreignProjectId),
      headers: { authorization: `Bearer ${otherOrgToken}` },
      payload: { items: [{ materialId: foreignMaterial, quantity: '1', unitCode: 'EA' }] },
    });
    expect(foreignRequest.statusCode).toBe(201);

    const member = await createVerifiedUser({ email: `mr_member_${runId}@example.com` });
    memberToken = member.token;
    const memberRoleId = org.roleMap.get('Client');
    if (!memberRoleId) throw new Error('Client organization role was not seeded');
    await addMemberDirectly(orgId, member.user.id, memberRoleId);
    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      organizationId: orgId,
      projectId,
      userId: member.user.id,
      role: 'PROJECT_MEMBER',
      status: 'ACTIVE',
      addedBy: ownerUserId,
    });
  }, 90000);

  afterAll(async () => {
    await app.close();
  });

  it('creates a scoped DRAFT request with an allocated number and persisted items', async () => {
    const response = await createRequest();
    expect(response.statusCode).toBe(201);
    const created = response.json().data;
    expect(created.status).toBe('DRAFT');
    expect(created.requestNumber).toMatch(/^MR-\d{6}-\d{3}$/);
    expect(created.organizationId).toBe(orgId);
    expect(created.projectId).toBe(projectId);
    expect(created.items).toHaveLength(1);
    const rows = await getDb()
      .select()
      .from(materialRequestItems)
      .where(and(eq(materialRequestItems.materialRequestId, created.id), eq(materialRequestItems.organizationId, orgId)));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.quantity).toBe('2.000');
  });

  it.each([
    ['empty items', { items: [] }],
    ['zero quantity', { items: [{ materialId, quantity: '0', unitCode: 'EA' }] }],
  ])('rejects create payload with %s', async (_label, overrides) => {
    const response = await createRequest(projectId, token, validPayload(overrides));
    expect(response.statusCode).toBe(422);
  });

  it('rejects an item unit that differs from the material default', async () => {
    const response = await createRequest(projectId, token, validPayload({
      items: [{ materialId, quantity: '1', unitCode: 'BOX' }],
    }));
    expect(response.statusCode).toBe(422);
  });

  it('rejects a material owned by another organization without exposing it', async () => {
    const response = await createRequest(projectId, token, validPayload({
      items: [{ materialId: otherOrgMaterialId, quantity: '1', unitCode: 'EA' }],
    }));
    expect([404, 422]).toContain(response.statusCode);
  });

  it('rejects a task from another project', async () => {
    const response = await createRequest(projectId, token, validPayload({
      items: [{ materialId, quantity: '1', unitCode: 'EA', taskId: otherProjectTaskId }],
    }));
    expect.soft(response.statusCode).toBe(422);
    expect(response.json().success).toBe(false);
    expect(JSON.stringify(response.json())).not.toContain(otherProjectTaskId);
  });

  it('requires authentication and the exact project mutation permission', async () => {
    const unauthenticated = await app.inject({
      method: 'POST',
      url: requestPath(orgId, projectId),
      payload: validPayload(),
    });
    expect(unauthenticated.statusCode).toBe(401);

    const created = await createRequestData();
    const requestId = created.id as string;
    const denied = await app.inject({
      method: 'PATCH',
      url: `${requestPath(orgId, projectId)}/${requestId}`,
      headers: { authorization: `Bearer ${memberToken}` },
      payload: { notes: 'member cannot update a request' },
    });
    expect(denied.statusCode).toBe(403);
  });

  it('lists only the current project, supports status filtering and cursor pagination with populated items', async () => {
    const ownDraftA = await createRequestData();
    const ownDraftB = await createRequestData();
    const otherProjectRequest = await createRequestData(otherProjectId);
    const submitted = await createRequestData();
    const submit = await app.inject({
      method: 'POST',
      url: `${requestPath(orgId, projectId)}/${submitted.id}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(submit.statusCode).toBe(200);

    const list = await app.inject({
      method: 'GET',
      url: requestPath(orgId, projectId),
      headers: { authorization: `Bearer ${token}` },
    });
    expect(list.statusCode).toBe(200);
    const entries = list.json().data as Array<{ id: string; items: unknown[] }>;
    expect(entries.some((entry) => entry.id === ownDraftA.id)).toBe(true);
    expect(entries.some((entry) => entry.id === ownDraftB.id)).toBe(true);
    expect(entries.some((entry) => entry.id === otherProjectRequest.id)).toBe(false);
    expect(entries.find((entry) => entry.id === ownDraftA.id)?.items).toHaveLength(1);
    expect(entries.find((entry) => entry.id === ownDraftB.id)?.items).toHaveLength(1);

    const filtered = await app.inject({
      method: 'GET',
      url: `${requestPath(orgId, projectId)}?status=SUBMITTED`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(filtered.statusCode).toBe(200);
    expect(filtered.json().data.some((entry: { id: string }) => entry.id === submitted.id)).toBe(true);
    expect(filtered.json().data.some((entry: { id: string }) => entry.id === ownDraftA.id)).toBe(false);

    const firstPage = await app.inject({
      method: 'GET',
      url: `${requestPath(orgId, projectId)}?limit=1`,
      headers: { authorization: `Bearer ${token}` },
    });
    const cursor = firstPage.json().meta.nextCursor as string;
    expect(firstPage.statusCode).toBe(200);
    expect(cursor).toBeTruthy();
    const secondPage = await app.inject({
      method: 'GET',
      url: `${requestPath(orgId, projectId)}?limit=1&cursor=${encodeURIComponent(cursor)}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(secondPage.statusCode).toBe(200);
    expect(secondPage.json().data[0].id).not.toBe(firstPage.json().data[0].id);
  });

  it('returns own request details with items and hides another project request by explicit ID', async () => {
    const own = await createRequestData();
    const foreignProject = await createRequestData(otherProjectId);
    const ownResponse = await app.inject({
      method: 'GET',
      url: `${requestPath(orgId, projectId)}/${own.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(ownResponse.statusCode).toBe(200);
    expect(ownResponse.json().data.items).toHaveLength(1);
    const hidden = await app.inject({
      method: 'GET',
      url: `${requestPath(orgId, projectId)}/${foreignProject.id}`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(hidden.statusCode).toBe(404);
  });

  it('updates only DRAFT requests and verifies the persisted value', async () => {
    const created = await createRequestData();
    const response = await app.inject({
      method: 'PATCH',
      url: `${requestPath(orgId, projectId)}/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { notes: 'updated while draft' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.notes).toBe('updated while draft');
    const [row] = await getDb().select().from(materialRequests)
      .where(and(eq(materialRequests.id, created.id), eq(materialRequests.organizationId, orgId)));
    expect(row?.notes).toBe('updated while draft');
  });

  it('rejects updates after a material request has been submitted', async () => {
    const created = await createRequestData();
    const submit = await app.inject({
      method: 'POST',
      url: `${requestPath(orgId, projectId)}/${created.id}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(submit.statusCode).toBe(200);

    const update = await app.inject({
      method: 'PATCH',
      url: `${requestPath(orgId, projectId)}/${created.id}`,
      headers: { authorization: `Bearer ${token}` },
      payload: { notes: 'must not update a submitted request' },
    });
    expect(update.statusCode).toBe(422);
    const [persisted] = await getDb().select().from(materialRequests)
      .where(and(eq(materialRequests.id, created.id), eq(materialRequests.organizationId, orgId)));
    expect(persisted?.status).toBe('SUBMITTED');
    expect(persisted?.notes).not.toBe('must not update a submitted request');
  });

  it('submits once, records timestamp, audit and resource-scoped outbox event; rejects duplicate submit', async () => {
    const created = await createRequestData();
    const url = `${requestPath(orgId, projectId)}/${created.id}/submit`;
    const response = await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.status).toBe('SUBMITTED');
    expect(response.json().data.submittedAt).not.toBeNull();
    const [persisted] = await getDb().select().from(materialRequests)
      .where(and(eq(materialRequests.id, created.id), eq(materialRequests.organizationId, orgId)));
    expect(persisted?.status).toBe('SUBMITTED');
    expect(persisted?.submittedAt).toBeInstanceOf(Date);
    const event = await getEvent('procurement.material_request.submitted', 'requestId', created.id);
    expect(event).toHaveLength(1);
    const audit = await getDb().select().from(auditLogs).where(and(
      eq(auditLogs.organizationId, orgId),
      eq(auditLogs.action, 'material_request.submitted'),
      eq(auditLogs.resourceId, created.id),
    ));
    expect(audit).toHaveLength(1);
    const duplicate = await app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } });
    expect(duplicate.statusCode).toBe(422);
  });

  it('serializes simultaneous submits so one request transitions and the other is rejected', async () => {
    const created = await createRequestData();
    const url = `${requestPath(orgId, projectId)}/${created.id}/submit`;
    const results = await Promise.all([
      app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } }),
      app.inject({ method: 'POST', url, headers: { authorization: `Bearer ${token}` } }),
    ]);
    expect.soft(results.map((result) => result.statusCode).sort()).toEqual([200, 422]);
    const [persisted] = await getDb().select().from(materialRequests)
      .where(and(eq(materialRequests.id, created.id), eq(materialRequests.organizationId, orgId)));
    expect(persisted?.status).toBe('SUBMITTED');
  });

  it('rejects submit when a legacy/empty request has no items', async () => {
    const id = crypto.randomUUID();
    await getDb().insert(materialRequests).values({
      id,
      organizationId: orgId,
      projectId,
      requestNumber: `MR-EMPTY-${suffix()}`,
    });
    const response = await app.inject({
      method: 'POST',
      url: `${requestPath(orgId, projectId)}/${id}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(response.statusCode).toBe(422);
    const [persisted] = await getDb().select().from(materialRequests)
      .where(and(eq(materialRequests.id, id), eq(materialRequests.organizationId, orgId)));
    expect(persisted?.status).toBe('DRAFT');
    expect(await getDb().select().from(materialRequestItems).where(eq(materialRequestItems.materialRequestId, id))).toHaveLength(0);
  });

  it('cancels DRAFT and SUBMITTED requests, rejects repeat cancellation and emits scoped events', async () => {
    const draft = await createRequestData();
    const draftCancel = await app.inject({
      method: 'POST',
      url: `${requestPath(orgId, projectId)}/${draft.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(draftCancel.statusCode).toBe(200);
    expect(draftCancel.json().data.status).toBe('CANCELLED');

    const submitted = await createRequestData();
    const submit = await app.inject({
      method: 'POST',
      url: `${requestPath(orgId, projectId)}/${submitted.id}/submit`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(submit.statusCode).toBe(200);
    const submittedCancel = await app.inject({
      method: 'POST',
      url: `${requestPath(orgId, projectId)}/${submitted.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(submittedCancel.statusCode).toBe(200);
    expect(submittedCancel.json().data.status).toBe('CANCELLED');
    const repeated = await app.inject({
      method: 'POST',
      url: `${requestPath(orgId, projectId)}/${draft.id}/cancel`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(repeated.statusCode).toBe(422);
    expect(await getEvent('procurement.material_request.cancelled', 'requestId', draft.id)).toHaveLength(1);
    expect(await getEvent('procurement.material_request.cancelled', 'requestId', submitted.id)).toHaveLength(1);

    const otherProjectRequest = await createRequestData(otherProjectId);
    const hidden = await app.inject({
      method: 'POST',
      url: `${requestPath(orgId, projectId)}/${otherProjectRequest.id}/cancel`,
      headers: { authorization: 'Bearer ' + token },
    });
    expect(hidden.statusCode).toBe(404);
    const [unchanged] = await getDb().select().from(materialRequests)
      .where(and(
        eq(materialRequests.id, otherProjectRequest.id),
        eq(materialRequests.organizationId, orgId),
        eq(materialRequests.projectId, otherProjectId),
      ));
    expect(unchanged?.status).toBe('DRAFT');
  });

  it('does not expose another tenant request and ignores client-supplied approval fields', async () => {
    const created = await createRequest(projectId, token, validPayload({
      status: 'APPROVED',
      approvedAt: '2026-01-01T00:00:00.000Z',
    }));
    expect(created.statusCode).toBe(201);
    const requestId = created.json().data.id as string;
    expect(created.json().data.status).toBe('DRAFT');
    const [persisted] = await getDb().select().from(materialRequests)
      .where(and(eq(materialRequests.id, requestId), eq(materialRequests.organizationId, orgId)));
    expect(persisted?.status).toBe('DRAFT');

    const foreign = await app.inject({
      method: 'POST',
      url: `${requestPath(orgId, projectId)}/${requestId}/submit`,
      headers: { authorization: `Bearer ${otherOrgToken}` },
    });
    expect([403, 404]).toContain(foreign.statusCode);
    const [unchanged] = await getDb().select().from(materialRequests)
      .where(and(eq(materialRequests.id, requestId), eq(materialRequests.organizationId, orgId)));
    expect(unchanged?.status).toBe('DRAFT');
  });
});
