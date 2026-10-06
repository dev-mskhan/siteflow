import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  committedCosts,
  costTransactions,
  financialAuditEvents,
  projectCostCodes,
  projectMembers,
  projectPhases,
  projects,
} from '@siteflow/database/schema';
import { Decimal } from 'decimal.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import { getDb } from '../../src/lib/db/index.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);

type CostTransactionDTO = {
  id: string;
  organizationId: string;
  projectId: string;
  costCodeId: string;
  status: 'DRAFT' | 'POSTED' | 'VOIDED';
  version: number;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  currencyCode: string;
  sourceType: string;
  sourceId: string | null;
  reversalId: string | null;
};

type TransactionResponse = { transaction: CostTransactionDTO };

describe('project cost transactions (Fastify + PostgreSQL integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let costCodeId: string;
  let inactiveCostCodeId: string;
  let otherProjectCostCodeId: string;
  let otherProjectPhaseId: string;
  let otherOrganizationCostCodeId: string;
  let otherOrganizationPhaseId: string;
  let ownerToken: string;
  let ownerUserId: string;
  let lowPrivilegeToken: string;
  let otherOrganizationId: string;
  let otherOrganizationToken: string;
  let phaseId: string;

  const baseUrl = () =>
    `/api/v1/organizations/${organizationId}/projects/${projectId}/cost-transactions`;
  const auth = (token: string, key?: string) => ({
    authorization: `Bearer ${token}`,
    ...(key ? { 'idempotency-key': key } : {}),
  });
  const createPayload = (overrides: Record<string, unknown> = {}) => ({
    costCodeId,
    transactionDate: '2026-10-06',
    description: `Manual actual ${runId}`,
    quantity: '1.500',
    unit: 'hour',
    unitCost: '10.00',
    subtotal: '15.00',
    taxAmount: '0.99',
    currencyCode: 'usd',
    ...overrides,
  });

  async function createDraft(
    token = ownerToken,
    key = `cost-create-${crypto.randomUUID()}`,
    payload: Record<string, unknown> = createPayload(),
  ): Promise<CostTransactionDTO> {
    const response = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(token, key),
      payload,
    });
    expect(response.statusCode).toBe(201);
    return response.json<ApiSuccessResponse<TransactionResponse>>().data.transaction;
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `cost-owner-${runId}@example.com` });
    ownerToken = owner.token;
    ownerUserId = owner.user.id;
    const org = await createOrgWithAdmin(app, ownerToken, `Cost Org ${runId}`);
    organizationId = org.orgId;

    projectId = crypto.randomUUID();
    await getDb().insert(projects).values({
      id: projectId,
      organizationId,
      projectNumber: `CST-${runId}`,
      name: `Cost project ${runId}`,
      currency: 'USD',
    });
    costCodeId = crypto.randomUUID();
    inactiveCostCodeId = crypto.randomUUID();
    await getDb().insert(projectCostCodes).values([
      {
        id: costCodeId,
        organizationId,
        projectId,
        code: `CST-${runId}`,
        description: 'Active cost transaction fixture',
        createdBy: owner.user.id,
      },
      {
        id: inactiveCostCodeId,
        organizationId,
        projectId,
        code: `CST-I-${runId}`,
        description: 'Inactive cost transaction fixture',
        isActive: false,
        createdBy: owner.user.id,
      },
    ]);

    const otherProjectId = crypto.randomUUID();
    await getDb().insert(projects).values({
      id: otherProjectId,
      organizationId,
      projectNumber: `CST-X-${runId}`,
      name: `Other cost project ${runId}`,
      currency: 'USD',
    });
    otherProjectCostCodeId = crypto.randomUUID();
    await getDb().insert(projectCostCodes).values({
      id: otherProjectCostCodeId,
      organizationId,
      projectId: otherProjectId,
      code: `CST-X-${runId}`,
      createdBy: owner.user.id,
    });
    otherProjectPhaseId = crypto.randomUUID();
    await getDb().insert(projectPhases).values({
      id: otherProjectPhaseId,
      organizationId,
      projectId: otherProjectId,
      name: `Other cost phase ${runId}`,
      createdBy: owner.user.id,
    });

    phaseId = crypto.randomUUID();
    await getDb().insert(projectPhases).values({
      id: phaseId,
      organizationId,
      projectId,
      name: `Cost phase ${runId}`,
      createdBy: owner.user.id,
    });

    const lowPrivilege = await createVerifiedUser({
      email: `cost-member-${runId}@example.com`,
    });
    lowPrivilegeToken = lowPrivilege.token;
    await addMemberDirectly(
      organizationId,
      lowPrivilege.user.id,
      org.roleMap.get('Project Manager')!,
    );
    await getDb().insert(projectMembers).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      userId: lowPrivilege.user.id,
      role: 'PROJECT_MEMBER',
      status: 'ACTIVE',
      addedBy: owner.user.id,
    });

    const otherOwner = await createVerifiedUser({ email: `cost-other-${runId}@example.com` });
    otherOrganizationToken = otherOwner.token;
    otherOrganizationId = (
      await createOrgWithAdmin(app, otherOrganizationToken, `Other Cost Org ${runId}`)
    ).orgId;
    const otherOrganizationProjectId = crypto.randomUUID();
    await getDb().insert(projects).values({
      id: otherOrganizationProjectId,
      organizationId: otherOrganizationId,
      projectNumber: `CST-ORG-${runId}`,
      name: `Other organization cost project ${runId}`,
      currency: 'USD',
    });
    otherOrganizationCostCodeId = crypto.randomUUID();
    await getDb().insert(projectCostCodes).values({
      id: otherOrganizationCostCodeId,
      organizationId: otherOrganizationId,
      projectId: otherOrganizationProjectId,
      code: `CST-ORG-${runId}`,
      createdBy: otherOwner.user.id,
    });
    otherOrganizationPhaseId = crypto.randomUUID();
    await getDb().insert(projectPhases).values({
      id: otherOrganizationPhaseId,
      organizationId: otherOrganizationId,
      projectId: otherOrganizationProjectId,
      name: `Other organization cost phase ${runId}`,
      createdBy: otherOwner.user.id,
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('requires authentication and denies cross-tenant and insufficient project access', async () => {
    const unauthenticated = await app.inject({ method: 'GET', url: baseUrl() });
    expect(unauthenticated.statusCode).toBe(401);

    const deniedRole = await app.inject({
      method: 'GET',
      url: baseUrl(),
      headers: auth(lowPrivilegeToken),
    });
    expect(deniedRole.statusCode).toBe(403);

    const crossTenant = await app.inject({
      method: 'GET',
      url: baseUrl(),
      headers: auth(otherOrganizationToken),
    });
    expect([403, 404]).toContain(crossTenant.statusCode);
    expect(crossTenant.body).not.toContain(organizationId);
    expect(otherOrganizationId).not.toBe(organizationId);
  });

  it('rejects invalid amounts and foreign or inactive project cost codes without persistence', async () => {
    const foreignReference = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken, `cost-invalid-ref-${runId}`),
      payload: createPayload({ costCodeId: otherProjectCostCodeId }),
    });
    expect(foreignReference.statusCode).toBe(422);

    const inactiveReference = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken, `cost-inactive-${runId}`),
      payload: createPayload({ costCodeId: inactiveCostCodeId }),
    });
    expect(inactiveReference.statusCode).toBe(409);

    const foreignOrganizationReference = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken, `cost-foreign-org-${runId}`),
      payload: createPayload({ costCodeId: otherOrganizationCostCodeId }),
    });
    expect(foreignOrganizationReference.statusCode).toBe(422);

    const foreignProjectSource = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken, `cost-foreign-project-source-${runId}`),
      payload: createPayload({ sourceType: 'PHASE', sourceId: otherProjectPhaseId }),
    });
    expect(foreignProjectSource.statusCode).toBe(422);

    const foreignOrganizationSource = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken, `cost-foreign-org-source-${runId}`),
      payload: createPayload({ sourceType: 'PHASE', sourceId: otherOrganizationPhaseId }),
    });
    expect(foreignOrganizationSource.statusCode).toBe(422);

    const procurementSource = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken, `cost-procurement-source-${runId}`),
      payload: createPayload({ sourceType: 'PURCHASE_ORDER', sourceId: crypto.randomUUID() }),
    });
    expect(procurementSource.statusCode).toBe(422);

    const negative = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken, `cost-negative-${runId}`),
      payload: createPayload({ subtotal: '-1.00', quantity: undefined, unit: undefined, unitCost: undefined }),
    });
    expect(negative.statusCode).toBe(422);

    const excessivePrecision = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken, `cost-precision-${runId}`),
      payload: createPayload({ subtotal: '10.001', quantity: undefined, unit: undefined, unitCost: undefined }),
    });
    expect(excessivePrecision.statusCode).toBe(422);

    const oversizedAmount = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken, `cost-large-${runId}`),
      payload: createPayload({ subtotal: '10000000000000.00', quantity: undefined, unit: undefined, unitCost: undefined }),
    });
    expect(oversizedAmount.statusCode).toBe(422);

    const scopedRows = await getDb()
      .select({ id: costTransactions.id })
      .from(costTransactions)
      .where(and(eq(costTransactions.organizationId, organizationId), eq(costTransactions.projectId, projectId)));
    expect(scopedRows).toHaveLength(0);
  });

  it('enforces source uniqueness for same-project references', async () => {
    const first = await createDraft(ownerToken, `cost-source-a-${runId}`, createPayload({
      sourceType: 'PHASE',
      sourceId: phaseId,
      subtotal: undefined,
    }));
    expect(first.sourceType).toBe('PHASE');
    expect(first.sourceId).toBe(phaseId);

    const duplicate = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: auth(ownerToken, `cost-source-b-${runId}`),
      payload: createPayload({ sourceType: 'PHASE', sourceId: phaseId, subtotal: undefined }),
    });
    expect(duplicate.statusCode).toBe(409);

    const scopedSourceRows = await getDb()
      .select({ id: costTransactions.id })
      .from(costTransactions)
      .where(
        and(
          eq(costTransactions.organizationId, organizationId),
          eq(costTransactions.projectId, projectId),
          eq(costTransactions.sourceType, 'PHASE'),
          eq(costTransactions.sourceId, phaseId),
        ),
      );
    expect(scopedSourceRows.map(({ id }) => id)).toEqual([first.id]);
  });

  it('creates, lists, gets, posts idempotently, and voids with a posted reversal and scoped audit', async () => {
    const scopedCommitmentsBefore = await getDb()
      .select({ id: committedCosts.id, amount: committedCosts.committedAmount })
      .from(committedCosts)
      .where(and(eq(committedCosts.organizationId, organizationId), eq(committedCosts.projectId, projectId)));
    expect(scopedCommitmentsBefore).toHaveLength(0);

    const createKey = `cost-full-${runId}`;
    const createHeaders = auth(ownerToken, createKey);
    const createdResponse = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: createHeaders,
      payload: createPayload(),
    });
    expect(createdResponse.statusCode).toBe(201);
    const created = createdResponse.json<ApiSuccessResponse<TransactionResponse>>().data.transaction;
    expect(created).toMatchObject({
      status: 'DRAFT',
      version: 1,
      subtotal: '15.00',
      taxAmount: '0.99',
      totalAmount: '15.99',
      currencyCode: 'USD',
      sourceType: 'MANUAL',
      reversalId: null,
    });

    const replayedCreate = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: createHeaders,
      payload: createPayload(),
    });
    expect(replayedCreate.statusCode).toBe(201);
    expect(replayedCreate.json<ApiSuccessResponse<TransactionResponse>>().data.transaction.id).toBe(created.id);

    const persistedDraft = await getDb()
      .select()
      .from(costTransactions)
      .where(
        and(
          eq(costTransactions.id, created.id),
          eq(costTransactions.organizationId, organizationId),
          eq(costTransactions.projectId, projectId),
        ),
      );
    expect(persistedDraft).toHaveLength(1);
    expect(persistedDraft[0]).toMatchObject({
      status: 'DRAFT',
      version: 1,
      subtotal: '15.00',
      taxAmount: '0.99',
      totalAmount: '15.99',
      createdBy: ownerUserId,
    });

    const get = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/${created.id}`,
      headers: auth(ownerToken),
    });
    expect(get.statusCode).toBe(200);
    expect(get.json<ApiSuccessResponse<TransactionResponse>>().data.transaction.id).toBe(created.id);

    let cursor: string | null = null;
    const listedIds: string[] = [];
    let pageCount = 0;
    do {
      const page = await app.inject({
        method: 'GET',
        url: `${baseUrl()}?limit=1&status=DRAFT${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
        headers: auth(ownerToken),
      });
      expect(page.statusCode).toBe(200);
      const pageData = page.json<ApiSuccessResponse<{
        transactions: CostTransactionDTO[];
        nextCursor: string | null;
      }>>().data;
      listedIds.push(...pageData.transactions.map(({ id }) => id));
      cursor = pageData.nextCursor;
      pageCount += 1;
      expect(pageCount).toBeLessThanOrEqual(10);
    } while (cursor);
    expect(listedIds).toContain(created.id);

    const inactiveAfterDraft = await getDb()
      .update(projectCostCodes)
      .set({ isActive: false })
      .where(
        and(
          eq(projectCostCodes.organizationId, organizationId),
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.id, costCodeId),
        ),
      )
      .returning({ id: projectCostCodes.id });
    expect(inactiveAfterDraft).toHaveLength(1);
    const inactivePost = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${created.id}/post`,
      headers: auth(ownerToken, `cost-inactive-post-${runId}`),
      payload: { expectedVersion: 1 },
    });
    expect(inactivePost.statusCode).toBe(409);
    await getDb()
      .update(projectCostCodes)
      .set({ isActive: true })
      .where(
        and(
          eq(projectCostCodes.organizationId, organizationId),
          eq(projectCostCodes.projectId, projectId),
          eq(projectCostCodes.id, costCodeId),
        ),
      );

    const postKey = `cost-post-${runId}`;
    const postRequest = () =>
      app.inject({
        method: 'POST',
        url: `${baseUrl()}/${created.id}/post`,
        headers: auth(ownerToken, postKey),
        payload: { expectedVersion: 1 },
      });
    const [postA, postB] = await Promise.all([postRequest(), postRequest()]);
    expect(postA.statusCode).toBe(200);
    expect(postB.statusCode).toBe(200);
    const postedA = postA.json<ApiSuccessResponse<TransactionResponse>>().data.transaction;
    const postedB = postB.json<ApiSuccessResponse<TransactionResponse>>().data.transaction;
    expect(postedA.id).toBe(created.id);
    expect(postedA).toMatchObject({ status: 'POSTED', version: 2 });
    expect(postedB).toMatchObject({ status: 'POSTED', version: 2 });

    const staleVoid = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${created.id}/void`,
      headers: auth(ownerToken, `cost-stale-void-${runId}`),
      payload: { expectedVersion: 1, reason: 'Stale request' },
    });
    expect(staleVoid.statusCode).toBe(409);

    const postAudits = await getDb()
      .select({ id: financialAuditEvents.id })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityType, 'CostTransaction'),
          eq(financialAuditEvents.entityId, created.id),
          eq(financialAuditEvents.action, 'COST_POSTED'),
        ),
      );
    expect(postAudits).toHaveLength(1);

    const voidKey = `cost-void-${runId}`;
    const voidPayload = { expectedVersion: 2, reason: `Correction ${runId}` };
    const voidRequest = () =>
      app.inject({
        method: 'POST',
        url: `${baseUrl()}/${created.id}/void`,
        headers: auth(ownerToken, voidKey),
        payload: voidPayload,
      });
    const [voidA, voidB] = await Promise.all([voidRequest(), voidRequest()]);
    expect(voidA.statusCode).toBe(200);
    expect(voidB.statusCode).toBe(200);
    const voided = voidA.json<ApiSuccessResponse<TransactionResponse>>().data.transaction;
    expect(voided).toMatchObject({ id: created.id, status: 'VOIDED', version: 3 });
    expect(voided.reversalId).toBeTruthy();
    expect(voidB.json<ApiSuccessResponse<TransactionResponse>>().data.transaction.reversalId).toBe(
      voided.reversalId,
    );

    const transactionHistory = await getDb()
      .select({
        id: costTransactions.id,
        status: costTransactions.status,
        totalAmount: costTransactions.totalAmount,
        reversalOfId: costTransactions.reversalOfId,
      })
      .from(costTransactions)
      .where(
        and(
          eq(costTransactions.organizationId, organizationId),
          eq(costTransactions.projectId, projectId),
          inArray(costTransactions.id, [created.id, voided.reversalId!]),
        ),
      );
    expect(transactionHistory).toHaveLength(2);
    const original = transactionHistory.find(({ id }) => id === created.id)!;
    const reversal = transactionHistory.find(({ id }) => id === voided.reversalId)!;
    expect(original).toMatchObject({ status: 'VOIDED', totalAmount: '15.99', reversalOfId: null });
    expect(reversal).toMatchObject({
      status: 'POSTED',
      totalAmount: '-15.99',
      reversalOfId: created.id,
    });
    expect(
      transactionHistory.reduce((total, row) => total.plus(row.totalAmount), new Decimal(0)).toFixed(2),
    ).toBe('0.00');

    const voidAudits = await getDb()
      .select({ id: financialAuditEvents.id, amount: financialAuditEvents.amount, reason: financialAuditEvents.reason })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityType, 'CostTransaction'),
          eq(financialAuditEvents.entityId, created.id),
          eq(financialAuditEvents.action, 'COST_VOIDED'),
        ),
      );
    expect(voidAudits).toHaveLength(1);
    expect(voidAudits[0]).toMatchObject({ amount: '-15.99', reason: voidPayload.reason });

    const scopedCommitmentsAfter = await getDb()
      .select({ id: committedCosts.id, amount: committedCosts.committedAmount })
      .from(committedCosts)
      .where(and(eq(committedCosts.organizationId, organizationId), eq(committedCosts.projectId, projectId)));
    expect(scopedCommitmentsAfter).toEqual(scopedCommitmentsBefore);
  });
});
