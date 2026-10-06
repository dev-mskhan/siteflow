import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  financialAuditEvents,
  projectCostCodes,
  projectMembers,
  projects,
  scheduleOfValueLines,
  scheduleOfValueRevisions,
  scheduleOfValues,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` });

describe('schedule of values (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let ownerId: string;
  let ownerToken: string;
  let reviewerId: string;
  let reviewerToken: string;
  let projectId: string;
  let costCodeId: string;

  const base = () =>
    `/api/v1/organizations/${organizationId}/projects/${projectId}/schedule-of-values`;

  async function setupProject() {
    projectId = crypto.randomUUID();
    costCodeId = crypto.randomUUID();
    await getDb().insert(projects).values({
      id: projectId,
      organizationId,
      projectNumber: `SOV-${crypto.randomUUID().slice(0, 8)}`,
      name: `SOV integration project ${runId}`,
      currency: 'USD',
    });
    await getDb().insert(projectCostCodes).values({
      id: costCodeId,
      organizationId,
      projectId,
      code: `SOV-${crypto.randomUUID().slice(0, 8)}`,
      createdBy: ownerId,
    });
    await getDb().insert(projectMembers).values([
      {
        id: crypto.randomUUID(),
        organizationId,
        projectId,
        userId: ownerId,
        role: 'PROJECT_MANAGER',
        status: 'ACTIVE',
        addedBy: ownerId,
      },
      {
        id: crypto.randomUUID(),
        organizationId,
        projectId,
        userId: reviewerId,
        role: 'FINANCE',
        status: 'ACTIVE',
        addedBy: ownerId,
      },
    ]);
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `sov-owner-${runId}@example.com` });
    ownerId = owner.user.id;
    ownerToken = owner.token;
    const org = await createOrgWithAdmin(app, ownerToken, `SOV Org ${runId}`);
    organizationId = org.orgId;

    const reviewer = await createVerifiedUser({ email: `sov-reviewer-${runId}@example.com` });
    reviewerId = reviewer.user.id;
    reviewerToken = reviewer.token;
    await addMemberDirectly(organizationId, reviewerId, org.roleMap.get('Project Manager')!);

  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  function input(scheduledValue = '100.00') {
    return {
      contractValue: scheduledValue,
      currencyCode: 'USD',
      lines: [{
        description: `Original scope ${runId}`,
        costCodeId,
        scheduledValue,
        retainagePercent: '10.00',
      }],
    };
  }

  async function createSchedule(scheduledValue?: string) {
    const response = await app.inject({
      method: 'POST',
      url: base(),
      headers: authHeaders(ownerToken),
      payload: input(scheduledValue),
    });
    expect(response.statusCode).toBe(201);
    return response.json().data.scheduleOfValues;
  }

  async function action(
    id: string,
    actionName: string,
    token: string,
    expectedVersion: number,
  ) {
    return app.inject({
      method: 'POST',
      url: `${base()}/${id}/${actionName}`,
      headers: authHeaders(token),
      payload: { expectedVersion },
    });
  }

  it('validates reconciliation, references, bounds, and currency before creating a schedule', async () => {
    await setupProject();
    const emptyLines = await app.inject({
      method: 'POST',
      url: base(),
      headers: authHeaders(ownerToken),
      payload: { ...input(), lines: [] },
    });
    expect(emptyLines.statusCode).toBe(422);

    const invalidTotal = await app.inject({
      method: 'POST',
      url: base(),
      headers: authHeaders(ownerToken),
      payload: { ...input('100.00'), lines: [{ ...input('100.00').lines[0], scheduledValue: '99.99' }] },
    });
    expect(invalidTotal.statusCode).toBe(422);

    const foreignCode = await app.inject({
      method: 'POST',
      url: base(),
      headers: authHeaders(ownerToken),
      payload: {
        ...input(),
        lines: [{ ...input().lines[0], costCodeId: crypto.randomUUID() }],
      },
    });
    expect(foreignCode.statusCode).toBe(422);

    const unsupportedBoq = await app.inject({
      method: 'POST',
      url: base(),
      headers: authHeaders(ownerToken),
      payload: {
        ...input(),
        lines: [{ ...input().lines[0], boqLineId: crypto.randomUUID() }],
      },
    });
    expect(unsupportedBoq.statusCode).toBe(422);

    const mismatchedCurrency = await app.inject({
      method: 'POST',
      url: base(),
      headers: authHeaders(ownerToken),
      payload: { ...input(), currencyCode: 'EUR' },
    });
    expect(mismatchedCurrency.statusCode).toBe(409);

    const tooManyLines = await app.inject({
      method: 'POST',
      url: base(),
      headers: authHeaders(ownerToken),
      payload: { ...input(), lines: Array.from({ length: 201 }, (_, index) => ({
        description: `line ${index}`,
        costCodeId,
        scheduledValue: '1.00',
      })), contractValue: '201.00' },
    });
    expect(tooManyLines.statusCode).toBe(422);
    const [headers] = await getDb().select().from(scheduleOfValues)
      .where(and(
        eq(scheduleOfValues.organizationId, organizationId),
        eq(scheduleOfValues.projectId, projectId),
      ));
    expect(headers).toBeUndefined();
  });

  it('persists and reads progress calculations and enforces versioned approval', async () => {
    await setupProject();
    const created = await createSchedule();
    expect(created).toMatchObject({
      currentRevisionNumber: 1,
      version: 1,
      baseContractValue: '100.00',
      effectiveChangeOrderRevenue: '0.00',
      currentContractValue: '100.00',
      revision: { status: 'DRAFT', contractValue: '100.00' },
      lines: [{
        lineNumber: 1,
        scheduledValue: '100.00',
        completedToDate: '0.00',
        storedMaterials: '0.00',
        remainingValue: '100.00',
        retainageAmount: '0.00',
      }],
    });

    const listed = await app.inject({ method: 'GET', url: base(), headers: authHeaders(ownerToken) });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data.scheduleOfValues).toHaveLength(1);
    const fetched = await app.inject({
      method: 'GET',
      url: `${base()}/${created.id}`,
      headers: authHeaders(ownerToken),
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().data.scheduleOfValues.id).toBe(created.id);

    const submitted = await action(created.id, 'submit', ownerToken, 1);
    expect(submitted.statusCode).toBe(200);
    expect(submitted.json().data.scheduleOfValues.revision.status).toBe('PENDING_APPROVAL');
    const pendingVersion = submitted.json().data.scheduleOfValues.version as number;
    expect((await action(created.id, 'approve', ownerToken, pendingVersion)).statusCode).toBe(403);

    const approvals = await Promise.all([
      action(created.id, 'approve', reviewerToken, pendingVersion),
      action(created.id, 'approve', reviewerToken, pendingVersion),
    ]);
    expect(approvals.map(({ statusCode }) => statusCode).sort()).toEqual([200, 409]);
    const approved = approvals.find(({ statusCode }) => statusCode === 200)!;
    expect(approved.json().data.scheduleOfValues.revision.status).toBe('APPROVED');

    const progress = await app.inject({
      method: 'GET',
      url: `${base()}/${created.id}/progress`,
      headers: authHeaders(ownerToken),
    });
    expect(progress.statusCode).toBe(200);
    expect(progress.json().data.progress.lines[0]).toMatchObject({
      scheduledValue: '100.00',
      completedToDate: '0.00',
      storedMaterials: '0.00',
      remainingValue: '100.00',
      retainageAmount: '0.00',
    });
    const audit = await getDb().select({ action: financialAuditEvents.action })
      .from(financialAuditEvents)
      .where(and(
        eq(financialAuditEvents.organizationId, organizationId),
        eq(financialAuditEvents.projectId, projectId),
        eq(financialAuditEvents.entityId, created.id),
      ));
    expect(audit.map(({ action: event }) => event)).toEqual(expect.arrayContaining([
      'SCHEDULE_OF_VALUES_CREATED',
      'SCHEDULE_OF_VALUES_SUBMITTED',
      'SCHEDULE_OF_VALUES_APPROVED',
    ]));
  });

  it('preserves an approved revision when editing by creating a new draft revision', async () => {
    await setupProject();
    const created = await createSchedule();
    const submitted = await action(created.id, 'submit', ownerToken, created.version);
    const pending = submitted.json().data.scheduleOfValues;
    const approved = await action(created.id, 'approve', reviewerToken, pending.version);
    expect(approved.statusCode).toBe(200);
    const currentVersion = approved.json().data.scheduleOfValues.version as number;
    const initialRevisionId = approved.json().data.scheduleOfValues.revision.id as string;

    const updated = await app.inject({
      method: 'PATCH',
      url: `${base()}/${created.id}`,
      headers: authHeaders(ownerToken),
      payload: {
        expectedVersion: currentVersion,
        ...input('120.00'),
        lines: [{
          description: `Revised scope ${runId}`,
          costCodeId,
          scheduledValue: '120.00',
          retainagePercent: '5.00',
        }],
      },
    });
    expect(updated.statusCode).toBe(200);
    const revised = updated.json().data.scheduleOfValues;
    expect(revised).toMatchObject({
      currentRevisionNumber: 2,
      version: currentVersion + 1,
      revision: { status: 'DRAFT', revisionNumber: 2, contractValue: '120.00' },
      lines: [{ scheduledValue: '120.00', retainagePercent: '5.00' }],
    });
    const stale = await app.inject({
      method: 'PATCH',
      url: `${base()}/${created.id}`,
      headers: authHeaders(ownerToken),
      payload: {
        expectedVersion: currentVersion,
        ...input(),
      },
    });
    expect(stale.statusCode).toBe(409);
    const [oldRevision] = await getDb().select().from(scheduleOfValueRevisions)
      .where(eq(scheduleOfValueRevisions.id, initialRevisionId));
    const oldLines = await getDb().select().from(scheduleOfValueLines)
      .where(eq(scheduleOfValueLines.revisionId, initialRevisionId));
    expect(oldRevision?.status).toBe('APPROVED');
    expect(oldLines).toHaveLength(1);
    expect(oldLines[0]?.scheduledValue).toBe('100.00');
  });

  it('rejects duplicate creation and returns tenant-safe not-found for unrelated project IDs', async () => {
    await setupProject();
    const created = await createSchedule();
    const duplicate = await app.inject({
      method: 'POST',
      url: base(),
      headers: authHeaders(ownerToken),
      payload: input(),
    });
    expect(duplicate.statusCode).toBe(409);

    const missing = await app.inject({
      method: 'GET',
      url: `${base()}/${crypto.randomUUID()}`,
      headers: authHeaders(ownerToken),
    });
    expect(missing.statusCode).toBe(404);

    const foreignProject = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${crypto.randomUUID()}/schedule-of-values/${created.id}`,
      headers: authHeaders(ownerToken),
    });
    expect(foreignProject.statusCode).toBe(404);
    const [persistedHeader] = await getDb().select().from(scheduleOfValues)
      .where(eq(scheduleOfValues.id, created.id));
    expect(persistedHeader?.organizationId).toBe(organizationId);
  });
});
