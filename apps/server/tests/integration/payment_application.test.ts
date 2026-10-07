import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  financialAuditEvents,
  outboxEvents,
  paymentApplicationLines,
  paymentApplications,
  projectCostCodes,
  projectMembers,
  projects,
  scheduleOfValueProgress,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` });

describe('payment applications (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let ownerId: string;
  let ownerToken: string;
  let reviewerId: string;
  let reviewerToken: string;
  let projectId: string;
  let costCodeId: string;
  let sovId: string;
  let sovLineId: string;

  const sovBase = () =>
    `/api/v1/organizations/${organizationId}/projects/${projectId}/schedule-of-values`;
  const paymentBase = () =>
    `/api/v1/organizations/${organizationId}/projects/${projectId}/payment-applications`;

  async function setupProjectAndApprovedSov() {
    projectId = crypto.randomUUID();
    costCodeId = crypto.randomUUID();
    await getDb()
      .insert(projects)
      .values({
        id: projectId,
        organizationId,
        projectNumber: `PAYAPP-${crypto.randomUUID().slice(0, 8)}`,
        name: `Payment application integration project ${runId}`,
        currency: 'USD',
      });
    await getDb()
      .insert(projectCostCodes)
      .values({
        id: costCodeId,
        organizationId,
        projectId,
        code: `PAYAPP-${crypto.randomUUID().slice(0, 8)}`,
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
          userId: reviewerId,
          role: 'FINANCE',
          status: 'ACTIVE',
          addedBy: ownerId,
        },
      ]);
    const created = await app.inject({
      method: 'POST',
      url: sovBase(),
      headers: authHeaders(ownerToken),
      payload: {
        contractValue: '100.00',
        currencyCode: 'USD',
        lines: [
          {
            description: 'Payment application SOV line',
            costCodeId,
            scheduledValue: '100.00',
            retainagePercent: '10.00',
          },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const sov = created.json().data.scheduleOfValues;
    sovId = sov.id;
    sovLineId = sov.lines[0].id;
    const submitted = await app.inject({
      method: 'POST',
      url: `${sovBase()}/${sovId}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: sov.version },
    });
    expect(submitted.statusCode).toBe(200);
    const pending = submitted.json().data.scheduleOfValues;
    const approved = await app.inject({
      method: 'POST',
      url: `${sovBase()}/${sovId}/approve`,
      headers: authHeaders(reviewerToken),
      payload: { expectedVersion: pending.version },
    });
    expect(approved.statusCode).toBe(200);
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `payment-owner-${runId}@example.com` });
    ownerId = owner.user.id;
    ownerToken = owner.token;
    const org = await createOrgWithAdmin(app, ownerToken, `Payment Org ${runId}`);
    organizationId = org.orgId;
    const reviewer = await createVerifiedUser({ email: `payment-reviewer-${runId}@example.com` });
    reviewerId = reviewer.user.id;
    reviewerToken = reviewer.token;
    await addMemberDirectly(organizationId, reviewerId, org.roleMap.get('Project Manager')!);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('enforces review separation and updates SOV progress atomically on partial approval', async () => {
    await setupProjectAndApprovedSov();

    const created = await app.inject({
      method: 'POST',
      url: paymentBase(),
      headers: authHeaders(ownerToken),
      payload: {
        billingPeriodStart: '2026-01-01',
        billingPeriodEnd: '2026-01-31',
        lines: [
          { scheduleOfValueLineId: sovLineId, currentWork: '40.00', storedMaterials: '10.00' },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const application = created.json().data.paymentApplication;
    expect(application).toMatchObject({
      status: 'DRAFT',
      currencyCode: 'USD',
      grossRequested: '50.00',
      retainageRequested: '5.00',
      requestedAmount: '45.00',
      priorApprovedGross: '0.00',
      lines: [
        {
          currentWork: '40.00',
          storedMaterials: '10.00',
          grossCompleted: '50.00',
          retainageRequested: '5.00',
          requestedAmount: '45.00',
        },
      ],
    });

    const draftVoid = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${application.id}/void`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: application.version },
    });
    expect(draftVoid.statusCode).toBe(200);
    expect(draftVoid.json().data.paymentApplication.status).toBe('VOIDED');

    const submitted = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${application.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: application.version },
    });
    expect(submitted.statusCode).toBe(409);

    const second = await app.inject({
      method: 'POST',
      url: paymentBase(),
      headers: authHeaders(ownerToken),
      payload: {
        billingPeriodStart: '2026-02-01',
        billingPeriodEnd: '2026-02-28',
        lines: [
          { scheduleOfValueLineId: sovLineId, currentWork: '40.00', storedMaterials: '10.00' },
        ],
      },
    });
    const secondApplication = second.json().data.paymentApplication;
    const submittedSecond = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${secondApplication.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: secondApplication.version },
    });
    expect(submittedSecond.statusCode).toBe(200);
    const selfReview = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${secondApplication.id}/under-review`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: submittedSecond.json().data.paymentApplication.version },
    });
    expect(selfReview.statusCode).toBe(403);
    const review = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${secondApplication.id}/under-review`,
      headers: authHeaders(reviewerToken),
      payload: { expectedVersion: submittedSecond.json().data.paymentApplication.version },
    });
    expect(review.statusCode).toBe(200);
    const reviewed = review.json().data.paymentApplication;
    const approvals = await Promise.all(
      [1, 2].map(() =>
        app.inject({
          method: 'POST',
          url: `${paymentBase()}/${secondApplication.id}/approve`,
          headers: authHeaders(reviewerToken),
          payload: {
            expectedVersion: reviewed.version,
            lines: [
              {
                scheduleOfValueLineId: sovLineId,
                approvedCurrentWork: '25.00',
                approvedStoredMaterials: '10.00',
              },
            ],
          },
        }),
      ),
    );
    expect(approvals.map(({ statusCode }) => statusCode).sort()).toEqual([200, 409]);
    const approved = approvals.find(({ statusCode }) => statusCode === 200)!;
    expect(approved.statusCode).toBe(200);
    expect(approved.json().data.paymentApplication).toMatchObject({
      status: 'PARTIALLY_APPROVED',
      approvedGross: '35.00',
      approvedRetainage: '3.50',
      approvedAmount: '31.50',
      lines: [
        {
          approvedCurrentWork: '25.00',
          approvedStoredMaterials: '10.00',
          approvedGross: '35.00',
          approvedRetainage: '3.50',
          approvedAmount: '31.50',
        },
      ],
    });

    const progress = await app.inject({
      method: 'GET',
      url: `${sovBase()}/${sovId}/progress`,
      headers: authHeaders(ownerToken),
    });
    expect(progress.statusCode).toBe(200);
    expect(progress.json().data.progress.lines[0]).toMatchObject({
      completedToDate: '25.00',
      storedMaterials: '10.00',
      retainageAccrued: '3.50',
      remainingValue: '65.00',
      retainageAmount: '3.50',
    });
    const replaceBilledSchedule = await app.inject({
      method: 'PATCH',
      url: `${sovBase()}/${sovId}`,
      headers: authHeaders(ownerToken),
      payload: {
        expectedVersion: progress.json().data.progress.version,
        contractValue: '100.00',
        currencyCode: 'USD',
        lines: [
          {
            description: 'Attempted replacement after billing',
            costCodeId,
            scheduledValue: '100.00',
            retainagePercent: '10.00',
          },
        ],
      },
    });
    expect(replaceBilledSchedule.statusCode).toBe(409);
    const persistedProgress = await getDb()
      .select()
      .from(scheduleOfValueProgress)
      .where(
        and(
          eq(scheduleOfValueProgress.organizationId, organizationId),
          eq(scheduleOfValueProgress.projectId, projectId),
          eq(scheduleOfValueProgress.scheduleOfValueLineId, sovLineId),
        ),
      );
    expect(persistedProgress[0]).toMatchObject({
      completedToDate: '25.00',
      storedMaterials: '10.00',
      retainageAccrued: '3.50',
    });
    const [persistedApplication] = await getDb()
      .select()
      .from(paymentApplications)
      .where(eq(paymentApplications.id, secondApplication.id));
    const persistedLines = await getDb()
      .select()
      .from(paymentApplicationLines)
      .where(eq(paymentApplicationLines.paymentApplicationId, secondApplication.id));
    expect(persistedApplication?.approvedAmount).toBe('31.50');
    expect(persistedLines[0]?.approvedGross).toBe('35.00');
    const audit = await getDb()
      .select({ action: financialAuditEvents.action })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, secondApplication.id),
        ),
      );
    expect(audit.map((row) => row.action)).toEqual(
      expect.arrayContaining([
        'PAYMENT_APPLICATION_CREATED',
        'PAYMENT_APPLICATION_SUBMITTED',
        'PAYMENT_APPLICATION_UNDER_REVIEW',
        'PAYMENT_APPLICATION_PARTIALLY_APPROVED',
      ]),
    );
    const outbox = await getDb()
      .select()
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.organizationId, organizationId),
          sql`${outboxEvents.payload} ->> 'paymentApplicationId' = ${secondApplication.id}`,
          inArray(outboxEvents.eventType, [
            'commercial.payment_application.created',
            'commercial.payment_application.pending_review',
            'commercial.payment_application.under_review',
            'commercial.payment_application.partially_approved',
          ]),
        ),
      );
    expect(outbox.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'commercial.payment_application.created',
        'commercial.payment_application.pending_review',
        'commercial.payment_application.under_review',
        'commercial.payment_application.partially_approved',
      ]),
    );

    const overbill = await app.inject({
      method: 'POST',
      url: paymentBase(),
      headers: authHeaders(ownerToken),
      payload: {
        billingPeriodStart: '2026-03-01',
        billingPeriodEnd: '2026-03-31',
        lines: [
          { scheduleOfValueLineId: sovLineId, currentWork: '70.00', storedMaterials: '0.00' },
        ],
      },
    });
    expect(overbill.statusCode).toBe(201);
    const overbillApp = overbill.json().data.paymentApplication;
    const overbillSubmit = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${overbillApp.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: overbillApp.version },
    });
    const overbillReview = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${overbillApp.id}/under-review`,
      headers: authHeaders(reviewerToken),
      payload: { expectedVersion: overbillSubmit.json().data.paymentApplication.version },
    });
    const rejectedOverbill = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${overbillApp.id}/approve`,
      headers: authHeaders(reviewerToken),
      payload: {
        expectedVersion: overbillReview.json().data.paymentApplication.version,
        lines: [
          {
            scheduleOfValueLineId: sovLineId,
            approvedCurrentWork: '70.00',
            approvedStoredMaterials: '0.00',
          },
        ],
      },
    });
    expect(rejectedOverbill.statusCode).toBe(422);
    const afterOverbill = await getDb()
      .select()
      .from(scheduleOfValueProgress)
      .where(eq(scheduleOfValueProgress.scheduleOfValueLineId, sovLineId));
    expect(afterOverbill[0]?.completedToDate).toBe('25.00');
    const [persistedOverbill] = await getDb()
      .select({
        status: paymentApplications.status,
        approvedAmount: paymentApplications.approvedAmount,
      })
      .from(paymentApplications)
      .where(
        and(
          eq(paymentApplications.organizationId, organizationId),
          eq(paymentApplications.projectId, projectId),
          eq(paymentApplications.id, overbillApp.id),
        ),
      );
    expect(persistedOverbill).toMatchObject({ status: 'UNDER_REVIEW', approvedAmount: '0.00' });
  });

  it('edits only drafts, rejects and voids without advancing SOV progress, and paginates by cursor', async () => {
    await setupProjectAndApprovedSov();
    const currentProject = { projectId, costCodeId, sovId, sovLineId };
    await setupProjectAndApprovedSov();
    const foreignProjectLineId = sovLineId;
    const foreignProjectApplicationResponse = await app.inject({
      method: 'POST',
      url: paymentBase(),
      headers: authHeaders(ownerToken),
      payload: {
        billingPeriodStart: '2026-04-01',
        billingPeriodEnd: '2026-04-30',
        lines: [{ scheduleOfValueLineId: sovLineId, currentWork: '5.00', storedMaterials: '0.00' }],
      },
    });
    expect(foreignProjectApplicationResponse.statusCode).toBe(201);
    const foreignProjectApplicationId =
      foreignProjectApplicationResponse.json().data.paymentApplication.id;
    ({ projectId, costCodeId, sovId, sovLineId } = currentProject);

    const crossProjectReference = await app.inject({
      method: 'POST',
      url: paymentBase(),
      headers: authHeaders(ownerToken),
      payload: {
        billingPeriodStart: '2026-01-01',
        billingPeriodEnd: '2026-01-31',
        lines: [
          {
            scheduleOfValueLineId: foreignProjectLineId,
            currentWork: '10.00',
            storedMaterials: '0.00',
          },
        ],
      },
    });
    expect(crossProjectReference.statusCode).toBe(422);

    const unauthenticated = await app.inject({
      method: 'GET',
      url: paymentBase(),
    });
    expect(unauthenticated.statusCode).toBe(401);

    const duplicateLines = await app.inject({
      method: 'POST',
      url: paymentBase(),
      headers: authHeaders(ownerToken),
      payload: {
        billingPeriodStart: '2026-01-01',
        billingPeriodEnd: '2026-01-31',
        lines: [
          { scheduleOfValueLineId: sovLineId, currentWork: '10.00', storedMaterials: '0.00' },
          { scheduleOfValueLineId: sovLineId, currentWork: '5.00', storedMaterials: '0.00' },
        ],
      },
    });
    expect(duplicateLines.statusCode).toBe(422);

    const created = await app.inject({
      method: 'POST',
      url: paymentBase(),
      headers: authHeaders(ownerToken),
      payload: {
        billingPeriodStart: '2026-01-01',
        billingPeriodEnd: '2026-01-31',
        lines: [
          { scheduleOfValueLineId: sovLineId, currentWork: '10.00', storedMaterials: '0.00' },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const draft = created.json().data.paymentApplication;
    const updatePayload = {
      expectedVersion: draft.version,
      billingPeriodStart: '2026-01-01',
      billingPeriodEnd: '2026-01-31',
      lines: [{ scheduleOfValueLineId: sovLineId, currentWork: '20.00', storedMaterials: '0.00' }],
    };
    const updated = await app.inject({
      method: 'PATCH',
      url: `${paymentBase()}/${draft.id}`,
      headers: authHeaders(ownerToken),
      payload: updatePayload,
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.paymentApplication).toMatchObject({
      version: draft.version + 1,
      grossRequested: '20.00',
      requestedAmount: '18.00',
    });

    const staleUpdate = await app.inject({
      method: 'PATCH',
      url: `${paymentBase()}/${draft.id}`,
      headers: authHeaders(ownerToken),
      payload: updatePayload,
    });
    expect(staleUpdate.statusCode).toBe(409);

    const fetched = await app.inject({
      method: 'GET',
      url: `${paymentBase()}/${draft.id}`,
      headers: authHeaders(ownerToken),
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().data.paymentApplication.id).toBe(draft.id);

    const submitted = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${draft.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: updated.json().data.paymentApplication.version },
    });
    expect(submitted.statusCode).toBe(200);
    const repeatedSubmit = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${draft.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: submitted.json().data.paymentApplication.version },
    });
    expect(repeatedSubmit.statusCode).toBe(409);

    const reviewed = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${draft.id}/under-review`,
      headers: authHeaders(reviewerToken),
      payload: { expectedVersion: submitted.json().data.paymentApplication.version },
    });
    expect(reviewed.statusCode).toBe(200);
    const rejected = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${draft.id}/reject`,
      headers: authHeaders(reviewerToken),
      payload: {
        expectedVersion: reviewed.json().data.paymentApplication.version,
        reason: 'Submitted supporting detail needs correction.',
      },
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().data.paymentApplication.status).toBe('REJECTED');

    const progress = await app.inject({
      method: 'GET',
      url: `${sovBase()}/${sovId}/progress`,
      headers: authHeaders(ownerToken),
    });
    expect(progress.statusCode).toBe(200);
    expect(progress.json().data.progress.lines[0]).toMatchObject({
      completedToDate: '0.00',
      storedMaterials: '0.00',
      retainageAccrued: '0.00',
    });

    const voided = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${draft.id}/void`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: rejected.json().data.paymentApplication.version },
    });
    expect(voided.statusCode).toBe(200);
    expect(voided.json().data.paymentApplication.status).toBe('VOIDED');

    for (const [start, end] of [
      ['2026-02-01', '2026-02-28'],
      ['2026-03-01', '2026-03-31'],
    ]) {
      const next = await app.inject({
        method: 'POST',
        url: paymentBase(),
        headers: authHeaders(ownerToken),
        payload: {
          billingPeriodStart: start,
          billingPeriodEnd: end,
          lines: [
            { scheduleOfValueLineId: sovLineId, currentWork: '5.00', storedMaterials: '0.00' },
          ],
        },
      });
      expect(next.statusCode).toBe(201);
    }

    const firstPage = await app.inject({
      method: 'GET',
      url: `${paymentBase()}?limit=2`,
      headers: authHeaders(ownerToken),
    });
    expect(firstPage.statusCode).toBe(200);
    const firstPageData = firstPage.json().data;
    expect(firstPageData.paymentApplications).toHaveLength(2);
    expect(firstPageData.nextCursor).toEqual(expect.any(String));
    const secondPage = await app.inject({
      method: 'GET',
      url: `${paymentBase()}?limit=2&cursor=${encodeURIComponent(firstPageData.nextCursor)}`,
      headers: authHeaders(ownerToken),
    });
    expect(secondPage.statusCode).toBe(200);
    const secondPageData = secondPage.json().data;
    expect(secondPageData.paymentApplications).toHaveLength(1);
    expect(secondPageData.nextCursor).toBeNull();
    const listedIds = [
      ...firstPageData.paymentApplications,
      ...secondPageData.paymentApplications,
    ].map((application) => application.id);
    expect(new Set(listedIds).size).toBe(3);
    expect(listedIds).toContain(draft.id);
    expect(listedIds).not.toContain(foreignProjectApplicationId);

    const invalidCursor = await app.inject({
      method: 'GET',
      url: `${paymentBase()}?cursor=not-a-valid-cursor!`,
      headers: authHeaders(ownerToken),
    });
    expect(invalidCursor.statusCode).toBe(409);
  });
});
