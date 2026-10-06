import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import {
  financialAuditEvents,
  projectBudgetLines,
  projectBudgetRevisions,
  projectBudgets,
  projectCostCodes,
  projectMembers,
  projects,
} from '@siteflow/database/schema';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import { getDb } from '../../src/lib/db/index.js';
import { createOrgWithAdmin, createVerifiedUser, addMemberDirectly } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);

type BudgetResponse = {
  budget: {
    id: string;
    status: string;
    version: number;
    currentRevisionNumber: number;
    revision: { id: string; status: string };
    lines: Array<{ amount: string; costCodeId: string }>;
    total: string;
  };
};

describe('project budgets (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let costCodeId: string;
  let ownerToken: string;
  let reviewerToken: string;
  let lowPrivilegeToken: string;
  let otherOrganizationId: string;
  let otherOrganizationToken: string;
  let otherProjectCostCodeId: string;
  let budgetId: string;
  let originalLineId: string;
  let version = 1;

  const baseUrl = () =>
    `/api/v1/organizations/${organizationId}/projects/${projectId}/budgets`;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `budget-owner-${runId}@example.com` });
    ownerToken = owner.token;
    const org = await createOrgWithAdmin(app, ownerToken, `Budget Org ${runId}`);
    organizationId = org.orgId;

    projectId = crypto.randomUUID();
    await getDb().insert(projects).values({
      id: projectId,
      organizationId,
      projectNumber: `BUD-${runId}`,
      name: `Budget project ${runId}`,
      currency: 'USD',
    });

    costCodeId = crypto.randomUUID();
    await getDb().insert(projectCostCodes).values({
      id: costCodeId,
      organizationId,
      projectId,
      code: `BUD-${runId}`,
      description: 'Budget integration fixture',
      createdBy: owner.user.id,
    });
    const otherProjectId = crypto.randomUUID();
    await getDb().insert(projects).values({
      id: otherProjectId,
      organizationId,
      projectNumber: `BUD-OTHER-${runId}`,
      name: `Other budget project ${runId}`,
      currency: 'USD',
    });
    otherProjectCostCodeId = crypto.randomUUID();
    await getDb().insert(projectCostCodes).values({
      id: otherProjectCostCodeId,
      organizationId,
      projectId: otherProjectId,
      code: `BUD-X-${runId}`,
      createdBy: owner.user.id,
    });

    const reviewer = await createVerifiedUser({ email: `budget-reviewer-${runId}@example.com` });
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

    const lowPrivilege = await createVerifiedUser({ email: `budget-member-${runId}@example.com` });
    lowPrivilegeToken = lowPrivilege.token;
    await addMemberDirectly(organizationId, lowPrivilege.user.id, org.roleMap.get('Project Manager')!);
    await getDb().insert(projectMembers).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      userId: lowPrivilege.user.id,
      role: 'PROJECT_MEMBER',
      status: 'ACTIVE',
      addedBy: owner.user.id,
    });

    const otherOwner = await createVerifiedUser({ email: `budget-other-${runId}@example.com` });
    otherOrganizationToken = otherOwner.token;
    otherOrganizationId = (
      await createOrgWithAdmin(app, otherOrganizationToken, `Other Budget Org ${runId}`)
    ).orgId;
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('rejects missing authentication and prevents another tenant from reading project budget', async () => {
    const noAuth = await app.inject({ method: 'GET', url: baseUrl() });
    expect(noAuth.statusCode).toBe(401);

    const crossTenant = await app.inject({
      method: 'GET',
      url: baseUrl(),
      headers: { authorization: `Bearer ${otherOrganizationToken}` },
    });
    expect([403, 404]).toContain(crossTenant.statusCode);

    const unauthorizedRole = await app.inject({
      method: 'GET',
      url: baseUrl(),
      headers: { authorization: `Bearer ${lowPrivilegeToken}` },
    });
    expect(unauthorizedRole.statusCode).toBe(403);
  });

  it('validates project references and decimal amounts before persisting a draft', async () => {
    const invalidReference = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        currencyCode: 'USD',
        lines: [{ costCodeId: crypto.randomUUID(), amount: '10.00' }],
      },
    });
    expect(invalidReference.statusCode).toBe(422);

    const foreignProjectReference = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        currencyCode: 'USD',
        lines: [{ costCodeId: otherProjectCostCodeId, amount: '10.00' }],
      },
    });
    expect(foreignProjectReference.statusCode).toBe(422);

    const invalidAmount = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { currencyCode: 'USD', lines: [{ costCodeId, amount: '10.001' }] },
    });
    expect(invalidAmount.statusCode).toBe(422);

    const scopedBudgets = await getDb()
      .select({ id: projectBudgets.id })
      .from(projectBudgets)
      .where(and(eq(projectBudgets.organizationId, organizationId), eq(projectBudgets.projectId, projectId)));
    expect(scopedBudgets).toHaveLength(0);
  });

  it('creates, lists, reads and updates a draft with persisted decimal values and audit history', async () => {
    const created = await app.inject({
      method: 'POST',
      url: baseUrl(),
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        currencyCode: 'usd',
        status: 'APPROVED',
        lines: [{ costCodeId, amount: '100.00' }],
      },
    });
    expect(created.statusCode).toBe(201);
    const createdBody = created.json<ApiSuccessResponse<BudgetResponse>>();
    expect(createdBody.data.budget).toMatchObject({
      status: 'DRAFT',
      version: 1,
      currentRevisionNumber: 1,
      total: '100.00',
    });
    budgetId = createdBody.data.budget.id;

    const persisted = await getDb()
      .select()
      .from(projectBudgetLines)
      .where(
        and(
          eq(projectBudgetLines.organizationId, organizationId),
          eq(projectBudgetLines.projectId, projectId),
          eq(projectBudgetLines.revisionId, createdBody.data.budget.revision.id),
        ),
      );
    expect(persisted).toHaveLength(1);
    expect(persisted[0]).toMatchObject({ costCodeId, amount: '100.00', lineNumber: 1 });
    originalLineId = persisted[0]!.id;

    const list = await app.inject({
      method: 'GET',
      url: baseUrl(),
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(list.statusCode).toBe(200);
    expect(list.json<ApiSuccessResponse<{ budgets: BudgetResponse['budget'][]; nextCursor: string | null }>>()
      .data.budgets.map(({ id }) => id)).toContain(budgetId);

    const get = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/${budgetId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(get.statusCode).toBe(200);
    expect(get.json<ApiSuccessResponse<BudgetResponse>>().data.budget.id).toBe(budgetId);

    const updated = await app.inject({
      method: 'PATCH',
      url: `${baseUrl()}/${budgetId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: {
        expectedVersion: version,
        lines: [{ costCodeId, amount: '100.00', description: 'Original baseline' }],
      },
    });
    expect(updated.statusCode).toBe(200);
    version += 1;
    const updatedBudget = updated.json<ApiSuccessResponse<BudgetResponse>>().data.budget;
    expect(updatedBudget.version).toBe(version);
    const currentDraftLine = await getDb()
      .select({ id: projectBudgetLines.id })
      .from(projectBudgetLines)
      .where(
        and(
          eq(projectBudgetLines.organizationId, organizationId),
          eq(projectBudgetLines.projectId, projectId),
          eq(projectBudgetLines.revisionId, updatedBudget.revision.id),
        ),
      );
    originalLineId = currentDraftLine[0]!.id;

    const stale = await app.inject({
      method: 'PATCH',
      url: `${baseUrl()}/${budgetId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { expectedVersion: 1, lines: [{ costCodeId, amount: '500.00' }] },
    });
    expect(stale.statusCode).toBe(409);

    const createdAudit = await getDb()
      .select({ action: financialAuditEvents.action, entityId: financialAuditEvents.entityId })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, budgetId),
        ),
      );
    expect(createdAudit.map(({ action }) => action)).toContain('BUDGET_CREATED');
    expect(createdAudit.map(({ action }) => action)).toContain('BUDGET_REVISED');
  });

  it('submits, denies requester self-approval, and serializes concurrent approval', async () => {
    const submitted = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${budgetId}/submit`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { expectedVersion: version },
    });
    expect(submitted.statusCode).toBe(200);
    version += 1;
    expect(submitted.json<ApiSuccessResponse<BudgetResponse>>().data.budget.status)
      .toBe('PENDING_APPROVAL');

    const duplicateSubmit = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${budgetId}/submit`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { expectedVersion: version - 1 },
    });
    expect(duplicateSubmit.statusCode).toBe(200);

    const selfApproval = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${budgetId}/approve`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { expectedVersion: version },
    });
    expect(selfApproval.statusCode).toBe(403);

    const approveRequest = () =>
      app.inject({
        method: 'POST',
        url: `${baseUrl()}/${budgetId}/approve`,
        headers: { authorization: `Bearer ${reviewerToken}` },
        payload: { expectedVersion: version },
      });
    const approvals = await Promise.all([approveRequest(), approveRequest()]);
    expect(approvals.map(({ statusCode }) => statusCode)).toEqual([200, 200]);
    version += 1;
    expect(approvals.every((response) =>
      response.json<ApiSuccessResponse<BudgetResponse>>().data.budget.status === 'APPROVED',
    )).toBe(true);

    const revisionRows = await getDb()
      .select({ id: projectBudgetRevisions.id, status: projectBudgetRevisions.status })
      .from(projectBudgetRevisions)
      .where(
        and(
          eq(projectBudgetRevisions.organizationId, organizationId),
          eq(projectBudgetRevisions.projectId, projectId),
          eq(projectBudgetRevisions.budgetId, budgetId),
        ),
      );
    expect(revisionRows).toHaveLength(1);
    expect(revisionRows[0]?.status).toBe('APPROVED');

    const approvalAudits = await getDb()
      .select({ id: financialAuditEvents.id })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, budgetId),
          eq(financialAuditEvents.action, 'BUDGET_APPROVED'),
        ),
      );
    expect(approvalAudits).toHaveLength(1);
  });

  it('keeps approved baselines immutable, applies explicit revisions and closes the budget', async () => {
    await expect(
      getDb()
        .update(projectBudgetLines)
        .set({ amount: '101.00' })
        .where(eq(projectBudgetLines.id, originalLineId)),
    ).rejects.toThrow();
    const immutableOriginal = await getDb()
      .select({ amount: projectBudgetLines.amount })
      .from(projectBudgetLines)
      .where(eq(projectBudgetLines.id, originalLineId));
    expect(immutableOriginal[0]?.amount).toBe('100.00');

    const revised = await app.inject({
      method: 'PATCH',
      url: `${baseUrl()}/${budgetId}`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { expectedVersion: version, lines: [{ costCodeId, amount: '150.00' }] },
    });
    expect(revised.statusCode).toBe(200);
    version += 1;
    const revisedBudget = revised.json<ApiSuccessResponse<BudgetResponse>>().data.budget;
    expect(revisedBudget.currentRevisionNumber).toBe(2);
    expect(revisedBudget.status).toBe('DRAFT');
    expect(revisedBudget.total).toBe('150.00');

    const draftSummary = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/${budgetId}/summary`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(draftSummary.json<ApiSuccessResponse<{ summary: { original: string; approvedChanges: string; revised: string } }>>()
      .data.summary).toMatchObject({ original: '100.00', approvedChanges: '0.00', revised: '100.00' });

    const submitRevision = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${budgetId}/submit`,
      headers: { authorization: `Bearer ${ownerToken}` },
      payload: { expectedVersion: version },
    });
    expect(submitRevision.statusCode).toBe(200);
    version += 1;

    const approveRevision = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${budgetId}/approve`,
      headers: { authorization: `Bearer ${reviewerToken}` },
      payload: { expectedVersion: version },
    });
    expect(approveRevision.statusCode).toBe(200);
    version += 1;

    const summary = await app.inject({
      method: 'GET',
      url: `${baseUrl()}/${budgetId}/summary`,
      headers: { authorization: `Bearer ${ownerToken}` },
    });
    expect(summary.statusCode).toBe(200);
    expect(summary.json<ApiSuccessResponse<{ summary: { original: string; approvedChanges: string; revised: string } }>>()
      .data.summary).toMatchObject({ original: '100.00', approvedChanges: '50.00', revised: '150.00' });

    const closed = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${budgetId}/close`,
      headers: { authorization: `Bearer ${reviewerToken}` },
      payload: { expectedVersion: version },
    });
    expect(closed.statusCode).toBe(200);
    expect(closed.json<ApiSuccessResponse<BudgetResponse>>().data.budget.status).toBe('CLOSED');
    const duplicateClose = await app.inject({
      method: 'POST',
      url: `${baseUrl()}/${budgetId}/close`,
      headers: { authorization: `Bearer ${reviewerToken}` },
      payload: { expectedVersion: version },
    });
    expect(duplicateClose.statusCode).toBe(200);

    const revisions = await getDb()
      .select({ revisionNumber: projectBudgetRevisions.revisionNumber, status: projectBudgetRevisions.status })
      .from(projectBudgetRevisions)
      .where(
        and(
          eq(projectBudgetRevisions.organizationId, organizationId),
          eq(projectBudgetRevisions.projectId, projectId),
          eq(projectBudgetRevisions.budgetId, budgetId),
        ),
      );
    expect(revisions).toHaveLength(2);
    expect(revisions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ revisionNumber: 1, status: 'SUPERSEDED' }),
        expect.objectContaining({ revisionNumber: 2, status: 'CLOSED' }),
      ]),
    );
  });
});
