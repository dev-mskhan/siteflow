import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  financialAuditEvents,
  paymentApplicationLines,
  paymentApplications,
  projectCostCodes,
  projectMembers,
  projects,
  retainageRecords,
  retainageReleases,
  scheduleOfValueProgress,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const authHeaders = (token: string, extras: Record<string, string> = {}) => ({
  authorization: `Bearer ${token}`,
  ...extras,
});

describe('retainage (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let ownerId: string;
  let ownerToken: string;
  let reviewerToken: string;
  let releaserToken: string;
  let lineId: string;
  let applicationId: string;
  let retainageId: string;

  const projectBase = () => `/api/v1/organizations/${organizationId}/projects/${projectId}`;
  const sovBase = () => `${projectBase()}/schedule-of-values`;
  const applicationBase = () => `${projectBase()}/payment-applications`;
  const retainageBase = () => `${projectBase()}/retainage`;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `retainage-owner-${runId}@example.com` });
    ownerId = owner.user.id;
    ownerToken = owner.token;
    const org = await createOrgWithAdmin(app, ownerToken, `Retainage Org ${runId}`);
    organizationId = org.orgId;
    const reviewer = await createVerifiedUser({
      email: `retainage-reviewer-${runId}@example.com`,
    });
    reviewerToken = reviewer.token;
    const releaser = await createVerifiedUser({
      email: `retainage-releaser-${runId}@example.com`,
    });
    releaserToken = releaser.token;
    await addMemberDirectly(organizationId, reviewer.user.id, org.roleMap.get('Project Manager')!);
    await addMemberDirectly(organizationId, releaser.user.id, org.roleMap.get('Project Manager')!);

    projectId = crypto.randomUUID();
    const costCodeId = crypto.randomUUID();
    await getDb()
      .insert(projects)
      .values({
        id: projectId,
        organizationId,
        projectNumber: `RET-${runId}`,
        name: `Retainage project ${runId}`,
        currency: 'USD',
      });
    await getDb()
      .insert(projectCostCodes)
      .values({
        id: costCodeId,
        organizationId,
        projectId,
        code: `RET-${runId}`,
        createdBy: ownerId,
      });
    await getDb()
      .insert(projectMembers)
      .values([
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
          userId: reviewer.user.id,
          role: 'FINANCE',
          status: 'ACTIVE',
          addedBy: ownerId,
        },
        {
          id: crypto.randomUUID(),
          organizationId,
          projectId,
          userId: releaser.user.id,
          role: 'FINANCE',
          status: 'ACTIVE',
          addedBy: ownerId,
        },
      ]);

    const createdSov = await app.inject({
      method: 'POST',
      url: sovBase(),
      headers: authHeaders(ownerToken),
      payload: {
        contractValue: '100.00',
        currencyCode: 'USD',
        lines: [
          {
            description: 'Retainage line',
            costCodeId,
            scheduledValue: '100.00',
            retainagePercent: '10.00',
          },
        ],
      },
    });
    expect(createdSov.statusCode).toBe(201);
    const sov = createdSov.json().data.scheduleOfValues;
    lineId = sov.lines[0].id;
    const submittedSov = await app.inject({
      method: 'POST',
      url: `${sovBase()}/${sov.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: sov.version },
    });
    const approvedSov = await app.inject({
      method: 'POST',
      url: `${sovBase()}/${sov.id}/approve`,
      headers: authHeaders(reviewerToken),
      payload: { expectedVersion: submittedSov.json().data.scheduleOfValues.version },
    });
    expect(approvedSov.statusCode).toBe(200);

    const createdApplication = await app.inject({
      method: 'POST',
      url: applicationBase(),
      headers: authHeaders(ownerToken),
      payload: {
        billingPeriodStart: '2026-04-01',
        billingPeriodEnd: '2026-04-30',
        lines: [{ scheduleOfValueLineId: lineId, currentWork: '10.05', storedMaterials: '0.00' }],
      },
    });
    expect(createdApplication.statusCode).toBe(201);
    applicationId = createdApplication.json().data.paymentApplication.id;
    const submittedApplication = await app.inject({
      method: 'POST',
      url: `${applicationBase()}/${applicationId}/submit`,
      headers: authHeaders(ownerToken),
      payload: {
        expectedVersion: createdApplication.json().data.paymentApplication.version,
      },
    });
    const reviewedApplication = await app.inject({
      method: 'POST',
      url: `${applicationBase()}/${applicationId}/under-review`,
      headers: authHeaders(reviewerToken),
      payload: {
        expectedVersion: submittedApplication.json().data.paymentApplication.version,
      },
    });
    const approvedApplication = await app.inject({
      method: 'POST',
      url: `${applicationBase()}/${applicationId}/approve`,
      headers: authHeaders(reviewerToken),
      payload: {
        expectedVersion: reviewedApplication.json().data.paymentApplication.version,
        lines: [
          {
            scheduleOfValueLineId: lineId,
            approvedCurrentWork: '10.05',
            approvedStoredMaterials: '0.00',
          },
        ],
      },
    });
    expect(approvedApplication.statusCode).toBe(200);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('accrues rounded approved retainage and preserves partial, concurrent, and final release history', async () => {
    const holdUrl = `${applicationBase()}/${applicationId}/retainage/hold`;
    const held = await app.inject({
      method: 'POST',
      url: holdUrl,
      headers: authHeaders(ownerToken, { 'idempotency-key': `hold-${runId}` }),
    });
    expect(held.statusCode).toBe(201);
    const record = held.json().data.retainageRecords[0];
    retainageId = record.id;
    expect(record).toMatchObject({
      paymentApplicationLineId: expect.any(String),
      currencyCode: 'USD',
      retainagePercent: '10.00',
      accruedAmount: '1.01',
      releasedAmount: '0.00',
      remainingAmount: '1.01',
      status: 'HELD',
    });
    const holdRetry = await app.inject({
      method: 'POST',
      url: holdUrl,
      headers: authHeaders(ownerToken, { 'idempotency-key': `hold-${runId}` }),
    });
    expect(holdRetry.statusCode).toBe(201);
    expect(holdRetry.json().data.retainageRecords[0].id).toBe(record.id);

    const approverRelease = await app.inject({
      method: 'POST',
      url: `${retainageBase()}/${retainageId}/release`,
      headers: authHeaders(reviewerToken, { 'idempotency-key': `sod-release-${runId}` }),
      payload: {
        expectedVersion: 1,
        amount: '0.50',
        reason: 'Milestone release.',
      },
    });
    expect(approverRelease.statusCode).toBe(403);

    const firstRelease = await app.inject({
      method: 'POST',
      url: `${retainageBase()}/${retainageId}/release`,
      headers: authHeaders(releaserToken, { 'idempotency-key': `partial-release-${runId}` }),
      payload: {
        expectedVersion: 1,
        amount: '0.50',
        reason: 'Milestone release.',
      },
    });
    expect(firstRelease.statusCode).toBe(200);
    expect(firstRelease.json().data.retainageRecord).toMatchObject({
      status: 'PARTIALLY_RELEASED',
      version: 2,
      releasedAmount: '0.50',
      remainingAmount: '0.51',
    });
    const releaseRetry = await app.inject({
      method: 'POST',
      url: `${retainageBase()}/${retainageId}/release`,
      headers: authHeaders(releaserToken, { 'idempotency-key': `partial-release-${runId}` }),
      payload: {
        expectedVersion: 1,
        amount: '0.50',
        reason: 'Milestone release.',
      },
    });
    expect(releaseRetry.statusCode).toBe(200);

    const concurrent = await Promise.all(
      ['a', 'b'].map((suffix) =>
        app.inject({
          method: 'POST',
          url: `${retainageBase()}/${retainageId}/release`,
          headers: authHeaders(releaserToken, {
            'idempotency-key': `concurrent-${suffix}-${runId}`,
          }),
          payload: {
            expectedVersion: 2,
            amount: '0.26',
            reason: 'Concurrent release.',
          },
        }),
      ),
    );
    expect(concurrent.map(({ statusCode }) => statusCode).sort()).toEqual([200, 409]);

    const list = await app.inject({
      method: 'GET',
      url: retainageBase(),
      headers: authHeaders(ownerToken),
    });
    expect(list.statusCode).toBe(200);
    expect(list.json().data).toContainEqual(expect.objectContaining({ id: retainageId }));
    const afterConcurrentVersion = concurrent.find(({ statusCode }) => statusCode === 200)!.json()
      .data.retainageRecord.version;
    const remainingResponse = await app.inject({
      method: 'GET',
      url: `${retainageBase()}/${retainageId}/releases`,
      headers: authHeaders(ownerToken),
    });
    expect(remainingResponse.statusCode).toBe(200);
    const releases = remainingResponse.json().data.releases;
    expect(releases).toHaveLength(2);
    const [currentRecord] = await getDb()
      .select()
      .from(retainageRecords)
      .where(
        and(
          eq(retainageRecords.organizationId, organizationId),
          eq(retainageRecords.projectId, projectId),
          eq(retainageRecords.id, retainageId),
        ),
      );
    const sourceLines = await getDb()
      .select()
      .from(paymentApplicationLines)
      .where(
        and(
          eq(paymentApplicationLines.organizationId, organizationId),
          eq(paymentApplicationLines.projectId, projectId),
          eq(paymentApplicationLines.paymentApplicationId, applicationId),
        ),
      );
    const [application] = await getDb()
      .select()
      .from(paymentApplications)
      .where(
        and(
          eq(paymentApplications.organizationId, organizationId),
          eq(paymentApplications.projectId, projectId),
          eq(paymentApplications.id, applicationId),
        ),
      );
    expect(currentRecord?.version).toBe(afterConcurrentVersion);
    expect(sourceLines[0]?.approvedRetainage).toBe('1.01');
    expect(application?.approvedRetainage).toBe('1.01');

    const beforeFinalAmount = currentRecord!.remainingAmount;
    const overRelease = await app.inject({
      method: 'POST',
      url: `${retainageBase()}/${retainageId}/release`,
      headers: authHeaders(releaserToken, { 'idempotency-key': `over-release-${runId}` }),
      payload: {
        expectedVersion: currentRecord!.version,
        amount: '0.26',
        reason: 'Must exceed current remainder.',
      },
    });
    expect(overRelease.statusCode).toBe(422);

    const finalRelease = await app.inject({
      method: 'POST',
      url: `${retainageBase()}/${retainageId}/release`,
      headers: authHeaders(releaserToken, { 'idempotency-key': `final-release-${runId}` }),
      payload: {
        expectedVersion: currentRecord!.version,
        amount: beforeFinalAmount,
        reason: 'Final retainage release.',
      },
    });
    expect(finalRelease.statusCode).toBe(200);
    expect(finalRelease.json().data.retainageRecord).toMatchObject({
      status: 'RELEASED',
      remainingAmount: '0.00',
    });
    const [progress] = await getDb()
      .select()
      .from(scheduleOfValueProgress)
      .where(
        and(
          eq(scheduleOfValueProgress.organizationId, organizationId),
          eq(scheduleOfValueProgress.projectId, projectId),
          eq(scheduleOfValueProgress.scheduleOfValueLineId, lineId),
        ),
      );
    expect(progress?.retainageAccrued).toBe('0.00');

    const ledger = await getDb()
      .select()
      .from(retainageReleases)
      .where(
        and(
          eq(retainageReleases.organizationId, organizationId),
          eq(retainageReleases.projectId, projectId),
          eq(retainageReleases.retainageRecordId, retainageId),
        ),
      );
    expect(ledger.reduce((total, row) => total + Number(row.amount), 0)).toBe(1.01);
    await expect(
      getDb()
        .update(retainageReleases)
        .set({ reason: 'mutated history' })
        .where(eq(retainageReleases.id, ledger[0]!.id)),
    ).rejects.toThrow(/append-only/);
    const audit = await getDb()
      .select({ action: financialAuditEvents.action })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, retainageId),
        ),
      );
    expect(audit.map(({ action }) => action)).toEqual(
      expect.arrayContaining(['RETAINAGE_HELD', 'RETAINAGE_RELEASED']),
    );
  });
});
