import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  changeOrderLines,
  changeOrders,
  financialAuditEvents,
  outboxEvents,
  projectBudgetRevisions,
  projectMembers,
  projectCostCodes,
  projects,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` });
type ChangeOrderResponse = {
  changeOrder: {
    id: string;
    changeOrderNumber: string;
    status: string;
    version: number;
    clientApprovalRequired: boolean;
    effectedBudgetRevisionId: string | null;
  };
};

describe('change orders (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let ownerId: string;
  let ownerToken: string;
  let reviewerToken: string;
  let reviewerId: string;
  let clientToken: string;
  let clientId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `co-owner-${runId}@example.com` });
    ownerId = owner.user.id;
    ownerToken = owner.token;
    const org = await createOrgWithAdmin(app, ownerToken, `CO Org ${runId}`);
    organizationId = org.orgId;

    const reviewer = await createVerifiedUser({ email: `co-reviewer-${runId}@example.com` });
    reviewerId = reviewer.user.id;
    reviewerToken = reviewer.token;
    await addMemberDirectly(organizationId, reviewerId, org.roleMap.get('Project Manager')!);

    const client = await createVerifiedUser({ email: `co-client-${runId}@example.com` });
    clientId = client.user.id;
    clientToken = client.token;
    await addMemberDirectly(organizationId, clientId, org.roleMap.get('Project Manager')!);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  async function setupProject(prefix: string) {
    const projectId = crypto.randomUUID();
    const costCodeId = crypto.randomUUID();
    await getDb()
      .insert(projects)
      .values({
        id: projectId,
        organizationId,
        projectNumber: `CO-${prefix}-${runId}`,
        name: `Change order project ${prefix} ${runId}`,
        currency: 'USD',
      });
    await getDb()
      .insert(projectCostCodes)
      .values({
        id: costCodeId,
        organizationId,
        projectId,
        code: `CO-${prefix}-${runId}`,
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
        {
          id: crypto.randomUUID(),
          organizationId,
          projectId,
          userId: clientId,
          role: 'CLIENT',
          status: 'ACTIVE',
          addedBy: ownerId,
        },
      ]);
    return { projectId, costCodeId };
  }

  async function createBudget(projectId: string, costCodeId: string) {
    const budgetBase = `/api/v1/organizations/${organizationId}/projects/${projectId}/budgets`;
    const created = await app.inject({
      method: 'POST',
      url: budgetBase,
      headers: authHeaders(ownerToken),
      payload: { currencyCode: 'USD', lines: [{ costCodeId, amount: '100.00' }] },
    });
    expect(created.statusCode).toBe(201);
    const budgetId = created.json().data.budget.id as string;
    const submitted = await app.inject({
      method: 'POST',
      url: `${budgetBase}/${budgetId}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: 1 },
    });
    expect(submitted.statusCode).toBe(200);
    const approved = await app.inject({
      method: 'POST',
      url: `${budgetBase}/${budgetId}/approve`,
      headers: authHeaders(reviewerToken),
      payload: { expectedVersion: 2 },
    });
    expect(approved.statusCode).toBe(200);
    return { budgetBase, budgetId };
  }

  async function summary(projectId: string, budgetBase: string, budgetId: string) {
    const response = await app.inject({
      method: 'GET',
      url: `${budgetBase}/${budgetId}/summary`,
      headers: authHeaders(ownerToken),
    });
    expect(response.statusCode).toBe(200);
    return response.json().data.summary as {
      original: string;
      approvedChanges: string;
      revised: string;
    };
  }

  async function createOrder(
    projectId: string,
    costCodeId: string,
    clientApprovalRequired = false,
  ) {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/change-orders`,
      headers: authHeaders(ownerToken),
      payload: {
        title: `CO title ${runId}`,
        reason: `CO reason ${runId}`,
        currencyCode: 'USD',
        clientApprovalRequired,
        scheduleDeltaDays: 4,
        lines: [
          {
            description: 'Additional scope',
            costCodeId,
            costDelta: '20.00',
            revenueDelta: '30.00',
          },
        ],
      },
    });
    expect(response.statusCode).toBe(201);
    return response.json().data.changeOrder as ChangeOrderResponse['changeOrder'];
  }

  async function action(
    projectId: string,
    changeOrderId: string,
    name: string,
    token: string,
    expectedVersion: number,
    body: Record<string, unknown> = {},
    headers: Record<string, string> = {},
  ) {
    return app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/change-orders/${changeOrderId}/${name}`,
      headers: { ...authHeaders(token), ...headers },
      payload: { expectedVersion, ...body },
    });
  }

  it('keeps draft and rejected change orders out of budget, and persists the full review audit', async () => {
    const { projectId, costCodeId } = await setupProject('REJ');
    const { budgetBase, budgetId } = await createBudget(projectId, costCodeId);
    const order = await createOrder(projectId, costCodeId);
    expect(order.changeOrderNumber).toMatch(/^CO-\d{6}-\d{3,}$/);
    expect(await summary(projectId, budgetBase, budgetId)).toMatchObject({
      original: '100.00',
      approvedChanges: '0.00',
      revised: '100.00',
    });

    const updated = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/change-orders/${order.id}`,
      headers: authHeaders(ownerToken),
      payload: {
        expectedVersion: order.version,
        title: `Updated title ${runId}`,
        reason: `Updated reason ${runId}`,
        currencyCode: 'USD',
        clientApprovalRequired: false,
        scheduleDeltaDays: 6,
        lines: [
          {
            description: 'Revised additional scope',
            costCodeId,
            costDelta: '25.00',
            revenueDelta: '35.00',
          },
        ],
      },
    });
    expect(updated.statusCode).toBe(200);
    const updateVersion = updated.json().data.changeOrder.version as number;

    const submitted = await action(projectId, order.id, 'submit', ownerToken, updateVersion);
    expect(submitted.statusCode).toBe(200);
    const submitVersion = submitted.json().data.changeOrder.version as number;
    expect(
      (await action(projectId, order.id, 'approve', ownerToken, submitVersion)).statusCode,
    ).toBe(403);
    const rejected = await action(projectId, order.id, 'reject', reviewerToken, submitVersion, {
      reason: 'Scope not accepted',
    });
    expect(rejected.statusCode).toBe(200);
    expect(rejected.json().data.changeOrder.status).toBe('REJECTED');
    expect(await summary(projectId, budgetBase, budgetId)).toMatchObject({
      original: '100.00',
      approvedChanges: '0.00',
      revised: '100.00',
    });

    const [persisted] = await getDb()
      .select()
      .from(changeOrders)
      .where(eq(changeOrders.id, order.id));
    const persistedLines = await getDb()
      .select()
      .from(changeOrderLines)
      .where(eq(changeOrderLines.changeOrderId, order.id));
    const audit = await getDb()
      .select({ action: financialAuditEvents.action })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, order.id),
        ),
      );
    expect(persisted?.status).toBe('REJECTED');
    expect(persisted?.rejectionReason).toBe('Scope not accepted');
    expect(persistedLines[0]?.costDelta).toBe('25.00');
    expect(audit.map(({ action: auditAction }) => auditAction)).toEqual(
      expect.arrayContaining([
        'CHANGE_ORDER_CREATED',
        'CHANGE_ORDER_UPDATED',
        'CHANGE_ORDER_SUBMITTED',
        'CHANGE_ORDER_REJECTED',
      ]),
    );
  });

  it('records client approval then effects the budget atomically and exactly once', async () => {
    const { projectId, costCodeId } = await setupProject('EFFECT');
    const { budgetBase, budgetId } = await createBudget(projectId, costCodeId);
    const sovBase = `/api/v1/organizations/${organizationId}/projects/${projectId}/schedule-of-values`;
    const sovCreated = await app.inject({
      method: 'POST',
      url: sovBase,
      headers: authHeaders(ownerToken),
      payload: {
        contractValue: '100.00',
        currencyCode: 'USD',
        lines: [
          {
            description: 'Base contract scope',
            costCodeId,
            scheduledValue: '100.00',
          },
        ],
      },
    });
    expect(sovCreated.statusCode).toBe(201);
    const sov = sovCreated.json().data.scheduleOfValues;
    const sovSubmitted = await app.inject({
      method: 'POST',
      url: `${sovBase}/${sov.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: sov.version },
    });
    const sovPending = sovSubmitted.json().data.scheduleOfValues;
    const sovApproved = await app.inject({
      method: 'POST',
      url: `${sovBase}/${sov.id}/approve`,
      headers: authHeaders(reviewerToken),
      payload: { expectedVersion: sovPending.version },
    });
    expect(sovApproved.statusCode).toBe(200);
    const order = await createOrder(projectId, costCodeId, true);
    const submitted = await action(projectId, order.id, 'submit', ownerToken, order.version);
    const submitVersion = submitted.json().data.changeOrder.version as number;

    const internallyApproved = await action(
      projectId,
      order.id,
      'approve',
      reviewerToken,
      submitVersion,
    );
    expect(internallyApproved.statusCode).toBe(200);
    expect(internallyApproved.json().data.changeOrder.status).toBe('PENDING_CLIENT_APPROVAL');
    const approvalVersion = internallyApproved.json().data.changeOrder.version as number;
    expect(
      (
        await action(
          projectId,
          order.id,
          'effect',
          reviewerToken,
          approvalVersion,
          {},
          {
            'idempotency-key': `early-${runId}`,
          },
        )
      ).statusCode,
    ).toBe(409);
    expect(await summary(projectId, budgetBase, budgetId)).toMatchObject({ revised: '100.00' });

    const clientApproved = await action(
      projectId,
      order.id,
      'client-approve',
      clientToken,
      approvalVersion,
    );
    expect(clientApproved.statusCode).toBe(200);
    expect(clientApproved.json().data.changeOrder.status).toBe('CLIENT_APPROVED');
    const clientVersion = clientApproved.json().data.changeOrder.version as number;

    const effected = await action(
      projectId,
      order.id,
      'effect',
      reviewerToken,
      clientVersion,
      {},
      {
        'idempotency-key': `effect-${runId}`,
      },
    );
    expect(effected.statusCode).toBe(200);
    const effectedOrder = effected.json().data.changeOrder as ChangeOrderResponse['changeOrder'];
    expect(effectedOrder.status).toBe('EFFECTED');
    expect(effectedOrder.effectedBudgetRevisionId).toBeTruthy();
    const scheduleAfterEffect = await app.inject({
      method: 'GET',
      url: `${sovBase}/${sov.id}`,
      headers: authHeaders(ownerToken),
    });
    expect(scheduleAfterEffect.statusCode).toBe(200);
    expect(scheduleAfterEffect.json().data.scheduleOfValues).toMatchObject({
      baseContractValue: '100.00',
      effectiveChangeOrderRevenue: '30.00',
      currentContractValue: '130.00',
    });
    const paymentBase = `/api/v1/organizations/${organizationId}/projects/${projectId}/payment-applications`;
    const paymentCreated = await app.inject({
      method: 'POST',
      url: paymentBase,
      headers: authHeaders(ownerToken),
      payload: {
        billingPeriodStart: '2026-01-01',
        billingPeriodEnd: '2026-01-31',
        lines: [
          {
            scheduleOfValueLineId: sov.lines[0].id,
            currentWork: '110.00',
            storedMaterials: '0.00',
          },
        ],
      },
    });
    expect(paymentCreated.statusCode).toBe(201);
    const paymentApplication = paymentCreated.json().data.paymentApplication;
    expect(paymentApplication.eligibleChangeOrders).toEqual([
      {
        changeOrderId: order.id,
        changeOrderNumber: order.changeOrderNumber,
        revenueDelta: '30.00',
      },
    ]);
    const paymentSubmitted = await app.inject({
      method: 'POST',
      url: `${paymentBase}/${paymentApplication.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: paymentApplication.version },
    });
    const paymentPending = paymentSubmitted.json().data.paymentApplication;
    const paymentReview = await app.inject({
      method: 'POST',
      url: `${paymentBase}/${paymentApplication.id}/under-review`,
      headers: authHeaders(reviewerToken),
      payload: { expectedVersion: paymentPending.version },
    });
    const paymentUnderReview = paymentReview.json().data.paymentApplication;
    const paymentApproved = await app.inject({
      method: 'POST',
      url: `${paymentBase}/${paymentApplication.id}/approve`,
      headers: authHeaders(reviewerToken),
      payload: {
        expectedVersion: paymentUnderReview.version,
        lines: [
          {
            scheduleOfValueLineId: sov.lines[0].id,
            approvedCurrentWork: '110.00',
            approvedStoredMaterials: '0.00',
          },
        ],
      },
    });
    expect(paymentApproved.statusCode).toBe(200);
    expect(paymentApproved.json().data.paymentApplication.approvedAmount).toBe('110.00');
    expect(await summary(projectId, budgetBase, budgetId)).toMatchObject({
      original: '100.00',
      approvedChanges: '20.00',
      revised: '120.00',
    });

    const replay = await action(
      projectId,
      order.id,
      'effect',
      reviewerToken,
      clientVersion,
      {},
      {
        'idempotency-key': `effect-${runId}`,
      },
    );
    expect(replay.statusCode).toBe(200);
    expect(replay.json().data.changeOrder.effectedBudgetRevisionId).toBe(
      effectedOrder.effectedBudgetRevisionId,
    );
    expect(await summary(projectId, budgetBase, budgetId)).toMatchObject({ revised: '120.00' });

    const [budgetRevision] = await getDb()
      .select({ status: projectBudgetRevisions.status })
      .from(projectBudgetRevisions)
      .where(eq(projectBudgetRevisions.id, effectedOrder.effectedBudgetRevisionId!));
    expect(budgetRevision?.status).toBe('APPROVED');
    const auditEvents = await getDb()
      .select({ action: financialAuditEvents.action })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, order.id),
        ),
      );
    expect(auditEvents.map(({ action: auditAction }) => auditAction)).toContain(
      'CHANGE_ORDER_EFFECTIVE',
    );
    const outbox = await getDb()
      .select({ eventType: outboxEvents.eventType })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.organizationId, organizationId),
          eq(outboxEvents.eventType, 'commercial.change_order.effected'),
        ),
      );
    expect(outbox.length).toBeGreaterThan(0);
  });

  it('allocates concurrent change-order numbers without collisions and rejects invalid references', async () => {
    const { projectId, costCodeId } = await setupProject('RACE');
    const { costCodeId: otherProjectCostCodeId } = await setupProject('OTHER');
    const results = await Promise.all([
      createOrder(projectId, costCodeId),
      createOrder(projectId, costCodeId),
    ]);
    expect(new Set(results.map((order) => order.changeOrderNumber)).size).toBe(2);

    const invalid = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/change-orders`,
      headers: authHeaders(ownerToken),
      payload: {
        title: 'Bad reference',
        reason: 'Reject foreign cost code',
        currencyCode: 'USD',
        lines: [
          {
            description: 'Invalid code',
            costCodeId: otherProjectCostCodeId,
            costDelta: '1.00',
            revenueDelta: '0.00',
          },
        ],
      },
    });
    expect(invalid.statusCode).toBe(422);

    const unsupportedBoqReference = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/change-orders`,
      headers: authHeaders(ownerToken),
      payload: {
        title: 'Unsupported BOQ link',
        reason: 'There is no authoritative BOQ source to validate.',
        currencyCode: 'USD',
        lines: [
          {
            description: 'Unverified BOQ line',
            costCodeId,
            boqLineId: crypto.randomUUID(),
            costDelta: '1.00',
            revenueDelta: '0.00',
          },
        ],
      },
    });
    expect(unsupportedBoqReference.statusCode).toBe(422);
  });

  it('supports scoped reads, stale-version rejection, and voiding without changing budget truth', async () => {
    const { projectId, costCodeId } = await setupProject('VOID');
    const { budgetBase, budgetId } = await createBudget(projectId, costCodeId);
    const order = await createOrder(projectId, costCodeId);
    const base = `/api/v1/organizations/${organizationId}/projects/${projectId}/change-orders`;

    const listed = await app.inject({
      method: 'GET',
      url: base,
      headers: authHeaders(ownerToken),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: order.id, status: 'DRAFT' })]),
    );

    const fetched = await app.inject({
      method: 'GET',
      url: `${base}/${order.id}`,
      headers: authHeaders(ownerToken),
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().data.changeOrder.id).toBe(order.id);
    const missing = await app.inject({
      method: 'GET',
      url: `${base}/${crypto.randomUUID()}`,
      headers: authHeaders(ownerToken),
    });
    expect(missing.statusCode).toBe(404);

    const updated = await app.inject({
      method: 'PATCH',
      url: `${base}/${order.id}`,
      headers: authHeaders(ownerToken),
      payload: {
        expectedVersion: order.version,
        title: `Edited ${runId}`,
        reason: `Edited reason ${runId}`,
        currencyCode: 'USD',
        clientApprovalRequired: false,
        scheduleDeltaDays: 2,
        lines: [
          {
            description: 'Adjusted scope',
            costCodeId,
            costDelta: '10.00',
            revenueDelta: '15.00',
          },
        ],
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(
      (await action(projectId, order.id, 'submit', ownerToken, order.version)).statusCode,
    ).toBe(409);

    const voided = await action(
      projectId,
      order.id,
      'void',
      ownerToken,
      updated.json().data.changeOrder.version as number,
    );
    expect(voided.statusCode).toBe(200);
    expect(voided.json().data.changeOrder.status).toBe('VOIDED');
    expect((await action(projectId, order.id, 'submit', ownerToken, 3)).statusCode).toBe(409);
    expect(await summary(projectId, budgetBase, budgetId)).toMatchObject({
      original: '100.00',
      approvedChanges: '0.00',
      revised: '100.00',
    });
  });

  it('serializes competing effects and rolls back rejected negative-budget effects', async () => {
    const { projectId, costCodeId } = await setupProject('RACEFX');
    const { budgetBase, budgetId } = await createBudget(projectId, costCodeId);

    const order = await createOrder(projectId, costCodeId);
    const submitted = await action(projectId, order.id, 'submit', ownerToken, order.version);
    const submittedVersion = submitted.json().data.changeOrder.version as number;
    const approved = await action(projectId, order.id, 'approve', reviewerToken, submittedVersion);
    expect(approved.statusCode).toBe(200);
    const approvedVersion = approved.json().data.changeOrder.version as number;

    const effects = await Promise.all([
      action(
        projectId,
        order.id,
        'effect',
        reviewerToken,
        approvedVersion,
        {},
        {
          'idempotency-key': `parallel-effect-a-${runId}`,
        },
      ),
      action(
        projectId,
        order.id,
        'effect',
        reviewerToken,
        approvedVersion,
        {},
        {
          'idempotency-key': `parallel-effect-b-${runId}`,
        },
      ),
    ]);
    expect(effects.map(({ statusCode }) => statusCode).sort()).toEqual([200, 409]);
    expect(await summary(projectId, budgetBase, budgetId)).toMatchObject({
      original: '100.00',
      approvedChanges: '20.00',
      revised: '120.00',
    });

    const negativeOrder = await createOrder(projectId, costCodeId);
    const changed = await app.inject({
      method: 'PATCH',
      url: `/api/v1/organizations/${organizationId}/projects/${projectId}/change-orders/${negativeOrder.id}`,
      headers: authHeaders(ownerToken),
      payload: {
        expectedVersion: negativeOrder.version,
        title: `Negative budget ${runId}`,
        reason: `Reject a negative revised budget ${runId}`,
        currencyCode: 'USD',
        clientApprovalRequired: false,
        scheduleDeltaDays: 0,
        lines: [
          {
            description: 'Budget reduction beyond remaining allocation',
            costCodeId,
            costDelta: '-200.00',
            revenueDelta: '0.00',
          },
        ],
      },
    });
    expect(changed.statusCode).toBe(200);
    const negativeSubmitted = await action(
      projectId,
      negativeOrder.id,
      'submit',
      ownerToken,
      changed.json().data.changeOrder.version as number,
    );
    const negativeApproved = await action(
      projectId,
      negativeOrder.id,
      'approve',
      reviewerToken,
      negativeSubmitted.json().data.changeOrder.version as number,
    );
    expect(negativeApproved.statusCode).toBe(200);
    const negativeVersion = negativeApproved.json().data.changeOrder.version as number;
    const failedEffect = await action(
      projectId,
      negativeOrder.id,
      'effect',
      reviewerToken,
      negativeVersion,
      {},
      {
        'idempotency-key': `negative-effect-${runId}`,
      },
    );
    expect(failedEffect.statusCode).toBe(409);
    expect(failedEffect.json().error.code).toBe('CONFLICT');
    expect(await summary(projectId, budgetBase, budgetId)).toMatchObject({
      original: '100.00',
      approvedChanges: '20.00',
      revised: '120.00',
    });
    const [stillApproved] = await getDb()
      .select()
      .from(changeOrders)
      .where(eq(changeOrders.id, negativeOrder.id));
    expect(stillApproved?.status).toBe('APPROVED');
    expect(stillApproved?.effectedBudgetRevisionId).toBeNull();
    const negativeOrderAudits = await getDb()
      .select({ action: financialAuditEvents.action })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, negativeOrder.id),
        ),
      );
    expect(negativeOrderAudits.map(({ action: auditAction }) => auditAction)).not.toContain(
      'CHANGE_ORDER_EFFECTIVE',
    );
    const negativeOrderEvents = await getDb()
      .select({ payload: outboxEvents.payload })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.organizationId, organizationId),
          eq(outboxEvents.eventType, 'commercial.change_order.effected'),
        ),
      );
    expect(
      negativeOrderEvents.some(
        ({ payload }) =>
          typeof payload === 'object' &&
          payload !== null &&
          !Array.isArray(payload) &&
          payload.changeOrderId === negativeOrder.id,
      ),
    ).toBe(false);
  });
});
