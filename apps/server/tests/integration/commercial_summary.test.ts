import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { eq } from 'drizzle-orm';
import {
  committedCosts,
  costTransactions,
  materials,
  projectBudgetLines,
  projectBudgetRevisions,
  projectBudgets,
  projectCostCodes,
  projects,
  purchaseOrderItems,
  purchaseOrders,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` });

describe('commercial summary (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let costCodeId: string;
  let ownerId: string;
  let token: string;
  let otherProjectId: string;
  let otherOrganizationId: string;
  let otherCostCodeId: string;

  const summaryUrl = () =>
    `/api/v1/organizations/${organizationId}/projects/${projectId}/commercial-summary`;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `summary-owner-${runId}@example.com` });
    ownerId = owner.user.id;
    token = owner.token;
    organizationId = (await createOrgWithAdmin(app, token, `Summary Org ${runId}`)).orgId;
    otherOrganizationId = (await createOrgWithAdmin(app, token, `Foreign Summary Org ${runId}`)).orgId;
    projectId = crypto.randomUUID();
    otherProjectId = crypto.randomUUID();
    costCodeId = crypto.randomUUID();
    otherCostCodeId = crypto.randomUUID();
    const supplierId = crypto.randomUUID();
    const materialId = crypto.randomUUID();
    const purchaseOrderId = crypto.randomUUID();
    const now = new Date();

    await getDb().insert(projects).values([
      {
        id: projectId,
        organizationId,
        projectNumber: `SUM-${runId}`,
        name: `Summary project ${runId}`,
        currency: 'USD',
      },
      {
        id: otherProjectId,
        organizationId,
        projectNumber: `SUM-X-${runId}`,
        name: `Other summary project ${runId}`,
        currency: 'USD',
      },
    ]);
    await getDb().insert(projectCostCodes).values([
      {
        id: costCodeId,
        organizationId,
        projectId,
        code: `SUM-${runId}`,
        createdBy: ownerId,
      },
      {
        id: otherCostCodeId,
        organizationId,
        projectId: otherProjectId,
        code: `SUM-X-${runId}`,
        createdBy: ownerId,
      },
    ]);

    await getDb().insert(projectBudgets).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      currencyCode: 'USD',
      status: 'APPROVED',
      currentRevisionNumber: 2,
      createdBy: ownerId,
      approvedBy: ownerId,
      approvedAt: now,
    }).returning({ id: projectBudgets.id }).then(async ([budget]) => {
      const originalRevisionId = crypto.randomUUID();
      const revisedRevisionId = crypto.randomUUID();
      await getDb().insert(projectBudgetRevisions).values([
        {
          id: originalRevisionId,
          budgetId: budget!.id,
          organizationId,
          projectId,
          revisionNumber: 1,
          status: 'DRAFT',
          createdBy: ownerId,
        },
        {
          id: revisedRevisionId,
          budgetId: budget!.id,
          organizationId,
          projectId,
          revisionNumber: 2,
          status: 'DRAFT',
          createdBy: ownerId,
        },
      ]);
      await getDb().insert(projectBudgetLines).values([
        {
          id: crypto.randomUUID(),
          revisionId: originalRevisionId,
          organizationId,
          projectId,
          costCodeId,
          lineNumber: 1,
          amount: '100.00',
        },
        {
          id: crypto.randomUUID(),
          revisionId: revisedRevisionId,
          organizationId,
          projectId,
          costCodeId,
          lineNumber: 1,
          amount: '150.00',
        },
      ]);
      await getDb()
        .update(projectBudgetRevisions)
        .set({ status: 'SUPERSEDED', approvedBy: ownerId, approvedAt: now })
        .where(eq(projectBudgetRevisions.id, originalRevisionId));
      await getDb()
        .update(projectBudgetRevisions)
        .set({ status: 'APPROVED', approvedBy: ownerId, approvedAt: now })
        .where(eq(projectBudgetRevisions.id, revisedRevisionId));
    });

    await getDb().insert(suppliers).values({
      id: supplierId,
      organizationId,
      supplierCode: `SUM-S-${runId}`,
      legalName: `Summary supplier ${runId}`,
      displayName: `Summary supplier ${runId}`,
      status: 'ACTIVE',
    });
    await getDb().insert(materials).values({
      id: materialId,
      organizationId,
      materialCode: `SUM-M-${runId}`,
      name: `Summary material ${runId}`,
      defaultUnitCode: 'EA',
    });
    await getDb().insert(purchaseOrders).values({
      id: purchaseOrderId,
      organizationId,
      projectId,
      poNumber: `SUM-PO-${runId}`,
      supplierId,
      status: 'APPROVED',
      orderDate: now.toISOString().slice(0, 10),
      currencyCode: 'USD',
      subtotal: '45.00',
      discountAmount: '0.00',
      taxAmount: '0.00',
      totalAmount: '45.00',
      approvedAt: now,
      approvedBy: ownerId,
    });
    await getDb().insert(purchaseOrderItems).values({
      id: crypto.randomUUID(),
      organizationId,
      purchaseOrderId,
      materialId,
      quantity: '3.000',
      unitCode: 'EA',
      unitPrice: '15.00',
      discountAmount: '0.00',
      taxAmount: '0.00',
      lineSubtotal: '45.00',
      lineTotal: '45.00',
      costCodeId,
    });
    await getDb().insert(committedCosts).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      sourceType: 'PURCHASE_ORDER',
      sourceId: purchaseOrderId,
      supplierId,
      purchaseOrderId,
      currencyCode: 'USD',
      committedAmount: '45.00',
      status: 'ACTIVE',
      committedAt: now,
    });
    await getDb().insert(costTransactions).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      costCodeId,
      sourceType: 'MANUAL',
      transactionDate: now.toISOString().slice(0, 10),
      description: `Posted actual ${runId}`,
      subtotal: '7.50',
      taxAmount: '0.00',
      totalAmount: '7.50',
      currencyCode: 'USD',
      status: 'POSTED',
      createdBy: ownerId,
      postedBy: ownerId,
      postedAt: now,
      postingDate: now.toISOString().slice(0, 10),
    });
    await getDb().insert(costTransactions).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      costCodeId,
      sourceType: 'MANUAL',
      transactionDate: now.toISOString().slice(0, 10),
      description: `Foreign currency actual ${runId}`,
      subtotal: '12.34',
      taxAmount: '0.00',
      totalAmount: '12.34',
      currencyCode: 'EUR',
      status: 'POSTED',
      createdBy: ownerId,
      postedBy: ownerId,
      postedAt: now,
      postingDate: now.toISOString().slice(0, 10),
    });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('aggregates approved budget revisions, active PO commitments, and posted actuals', async () => {
    const projectResponse = await app.inject({
      method: 'GET',
      url: summaryUrl(),
      headers: authHeaders(token),
    });
    expect(projectResponse.statusCode).toBe(200);
    const usd = projectResponse.json().data.currencyBreakdown.find(
      (entry: { currencyCode: string }) => entry.currencyCode === 'USD',
    );
    expect(usd).toMatchObject({
      originalBudget: '100.00',
      approvedBudgetChanges: '50.00',
      revisedBudget: '150.00',
      committed: '45.00',
      postedActual: '7.50',
      forecast: null,
      variance: null,
      approvedRevisionNumber: 2,
    });
    expect(projectResponse.json().data.currencyBreakdown).toContainEqual(
      expect.objectContaining({
        currencyCode: 'EUR',
        originalBudget: '0.00',
        revisedBudget: '0.00',
        committed: '0.00',
        postedActual: '12.34',
      }),
    );
    expect(projectResponse.json().data).toMatchObject({
      commitmentCoverage: 'APPROVED_PURCHASE_ORDERS_ONLY',
      subcontractCommitments: 'DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS',
      invoiceLifecycleCoverage: 'DEFERRED_UNTIL_INVOICE_SOURCE_EXISTS',
    });

    const costCodeResponse = await app.inject({
      method: 'GET',
      url: `${summaryUrl().replace('/commercial-summary', '')}/cost-codes/${costCodeId}/commercial-summary`,
      headers: authHeaders(token),
    });
    expect(costCodeResponse.statusCode).toBe(200);
    expect(costCodeResponse.json().data.currencyBreakdown).toContainEqual(
      expect.objectContaining({
        currencyCode: 'USD',
        revisedBudget: '150.00',
        committed: '45.00',
        postedActual: '7.50',
      }),
    );
  });

  it('returns zero-valued project-currency totals and hides foreign-project cost codes', async () => {
    const empty = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${organizationId}/projects/${otherProjectId}/commercial-summary`,
      headers: authHeaders(token),
    });
    expect(empty.statusCode).toBe(200);
    expect(empty.json().data.currencyBreakdown).toContainEqual(
      expect.objectContaining({
        currencyCode: 'USD',
        originalBudget: '0.00',
        revisedBudget: '0.00',
        committed: '0.00',
        postedActual: '0.00',
      }),
    );

    const hiddenCostCode = await app.inject({
      method: 'GET',
      url: `${summaryUrl().replace('/commercial-summary', '')}/cost-codes/${otherCostCodeId}/commercial-summary`,
      headers: authHeaders(token),
    });
    expect(hiddenCostCode.statusCode).toBe(404);

    const crossTenant = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${otherOrganizationId}/projects/${projectId}/commercial-summary`,
      headers: authHeaders(token),
    });
    expect([403, 404]).toContain(crossTenant.statusCode);
  });

  it('aggregates a high row count in PostgreSQL instead of returning per-transaction data', async () => {
    const now = new Date();
    const rows = Array.from({ length: 300 }, (_, index) => ({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      costCodeId,
      sourceType: 'MANUAL' as const,
      transactionDate: now.toISOString().slice(0, 10),
      description: `Large summary row ${index} ${runId}`,
      subtotal: '1.00',
      taxAmount: '0.00',
      totalAmount: '1.00',
      currencyCode: 'USD',
      status: 'POSTED' as const,
      createdBy: ownerId,
      postedBy: ownerId,
      postedAt: now,
      postingDate: now.toISOString().slice(0, 10),
    }));
    await getDb().insert(costTransactions).values(rows);

    const response = await app.inject({
      method: 'GET',
      url: summaryUrl(),
      headers: authHeaders(token),
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().data.currencyBreakdown).toContainEqual(
      expect.objectContaining({ currencyCode: 'USD', postedActual: '307.50' }),
    );
  });
});
