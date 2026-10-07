import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  committedCosts,
  costTransactions,
  financialAuditEvents,
  invoices,
  paymentApplicationLines,
  paymentApplications,
  payments,
  projectBudgetLines,
  projectBudgetRevisions,
  projectBudgets,
  projectCostCodes,
  projects,
  purchaseOrders,
  retainageRecords,
  scheduleOfValueLines,
  scheduleOfValueRevisions,
  scheduleOfValues,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` });

describe('financial audit and summary (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let foreignProjectId: string;
  let actorUserId: string;
  let token: string;

  const projectBase = () => `/api/v1/organizations/${organizationId}/projects/${projectId}`;

  beforeAll(async () => {
    app = await createTestApp();
    const user = await createVerifiedUser({ email: `financial-summary-${runId}@example.com` });
    actorUserId = user.user.id;
    token = user.token;
    organizationId = (await createOrgWithAdmin(app, token, `Financial Summary ${runId}`)).orgId;
    projectId = crypto.randomUUID();
    foreignProjectId = crypto.randomUUID();
    await getDb()
      .insert(projects)
      .values([
        {
          id: projectId,
          organizationId,
          projectNumber: `FS-${runId}`,
          name: `Financial summary ${runId}`,
          currency: 'USD',
        },
        {
          id: foreignProjectId,
          organizationId,
          projectNumber: `FS-X-${runId}`,
          name: `Foreign financial summary ${runId}`,
          currency: 'USD',
        },
      ]);

    const baseTime = Date.now();
    await getDb()
      .insert(financialAuditEvents)
      .values([
        {
          id: `audit-${runId}-old`,
          organizationId,
          projectId,
          actorUserId,
          action: 'CREATED',
          entityType: 'Invoice',
          entityId: 'invoice-old',
          requestId: `request-${runId}-old`,
          createdAt: new Date(baseTime - 2000),
        },
        {
          id: `audit-${runId}-new`,
          organizationId,
          projectId,
          actorUserId,
          action: 'APPROVED',
          entityType: 'Invoice',
          entityId: 'invoice-new',
          requestId: `request-${runId}-new`,
          createdAt: new Date(baseTime - 1000),
        },
        {
          id: `audit-${runId}-foreign`,
          organizationId,
          projectId: foreignProjectId,
          actorUserId,
          action: 'APPROVED',
          entityType: 'Invoice',
          entityId: 'invoice-foreign',
          requestId: `request-${runId}-foreign`,
          createdAt: new Date(baseTime),
        },
      ]);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('returns documented currency formulas and paginates only scoped financial audit events', async () => {
    const supplierId = crypto.randomUUID();
    const approvedPOId = crypto.randomUUID();
    const draftPOId = crypto.randomUUID();
    const now = new Date();
    await getDb()
      .insert(suppliers)
      .values({
        id: supplierId,
        organizationId,
        supplierCode: `FS-S-${runId}`,
        legalName: `Financial summary supplier ${runId}`,
        displayName: `Financial summary supplier ${runId}`,
        status: 'ACTIVE',
      });
    await getDb()
      .insert(purchaseOrders)
      .values([
        {
          id: approvedPOId,
          organizationId,
          projectId,
          poNumber: `FS-PO-${runId}`,
          supplierId,
          status: 'APPROVED',
          orderDate: now.toISOString().slice(0, 10),
          currencyCode: 'USD',
          subtotal: '30.00',
          discountAmount: '0.00',
          taxAmount: '0.00',
          totalAmount: '30.00',
          approvedAt: now,
          approvedBy: actorUserId,
        },
        {
          id: draftPOId,
          organizationId,
          projectId,
          poNumber: `FS-DRAFT-${runId}`,
          supplierId,
          status: 'DRAFT',
          orderDate: now.toISOString().slice(0, 10),
          currencyCode: 'USD',
          subtotal: '70.00',
          discountAmount: '0.00',
          taxAmount: '0.00',
          totalAmount: '70.00',
        },
      ]);
    await getDb()
      .insert(committedCosts)
      .values([
        {
          id: crypto.randomUUID(),
          organizationId,
          projectId,
          sourceType: 'PURCHASE_ORDER',
          sourceId: approvedPOId,
          purchaseOrderId: approvedPOId,
          supplierId,
          currencyCode: 'USD',
          committedAmount: '30.00',
          status: 'ACTIVE',
          committedAt: now,
        },
        {
          id: crypto.randomUUID(),
          organizationId,
          projectId,
          sourceType: 'PURCHASE_ORDER',
          sourceId: draftPOId,
          purchaseOrderId: draftPOId,
          supplierId,
          currencyCode: 'USD',
          committedAmount: '70.00',
          status: 'ACTIVE',
          committedAt: now,
        },
      ]);

    const costCodeId = crypto.randomUUID();
    const budgetId = crypto.randomUUID();
    const originalBudgetRevisionId = crypto.randomUUID();
    const currentBudgetRevisionId = crypto.randomUUID();
    const scheduleId = crypto.randomUUID();
    const scheduleRevisionId = crypto.randomUUID();
    const scheduleLineId = crypto.randomUUID();
    const applicationId = crypto.randomUUID();
    const applicationLineId = crypto.randomUUID();
    const receivableInvoiceId = crypto.randomUUID();
    const payableInvoiceId = crypto.randomUUID();
    await getDb()
      .insert(projectCostCodes)
      .values({
        id: costCodeId,
        organizationId,
        projectId,
        code: `FS-COST-${runId}`,
        createdBy: actorUserId,
      });
    await getDb().insert(projectBudgets).values({
      id: budgetId,
      organizationId,
      projectId,
      currencyCode: 'USD',
      status: 'APPROVED',
      currentRevisionNumber: 2,
      createdBy: actorUserId,
      approvedBy: actorUserId,
      approvedAt: now,
    });
    await getDb()
      .insert(projectBudgetRevisions)
      .values([
        {
          id: originalBudgetRevisionId,
          budgetId,
          organizationId,
          projectId,
          revisionNumber: 1,
          status: 'DRAFT',
          createdBy: actorUserId,
        },
        {
          id: currentBudgetRevisionId,
          budgetId,
          organizationId,
          projectId,
          revisionNumber: 2,
          status: 'DRAFT',
          createdBy: actorUserId,
        },
      ]);
    await getDb()
      .insert(projectBudgetLines)
      .values([
        {
          id: crypto.randomUUID(),
          revisionId: originalBudgetRevisionId,
          organizationId,
          projectId,
          costCodeId,
          lineNumber: 1,
          amount: '250.00',
        },
        {
          id: crypto.randomUUID(),
          revisionId: currentBudgetRevisionId,
          organizationId,
          projectId,
          costCodeId,
          lineNumber: 1,
          amount: '300.00',
        },
      ]);
    await getDb()
      .update(projectBudgetRevisions)
      .set({ status: 'SUPERSEDED', approvedBy: actorUserId, approvedAt: now })
      .where(eq(projectBudgetRevisions.id, originalBudgetRevisionId));
    await getDb()
      .update(projectBudgetRevisions)
      .set({ status: 'APPROVED', approvedBy: actorUserId, approvedAt: now })
      .where(eq(projectBudgetRevisions.id, currentBudgetRevisionId));
    await getDb()
      .insert(costTransactions)
      .values({
        id: crypto.randomUUID(),
        organizationId,
        projectId,
        costCodeId,
        sourceType: 'MANUAL',
        transactionDate: now.toISOString().slice(0, 10),
        postingDate: now.toISOString().slice(0, 10),
        description: `Posted financial summary actual ${runId}`,
        subtotal: '17.50',
        taxAmount: '0.00',
        totalAmount: '17.50',
        currencyCode: 'USD',
        status: 'POSTED',
        createdBy: actorUserId,
        postedBy: actorUserId,
        postedAt: now,
      });
    await getDb().insert(scheduleOfValues).values({
      id: scheduleId,
      organizationId,
      projectId,
      currentRevisionNumber: 1,
      createdBy: actorUserId,
    });
    await getDb().insert(scheduleOfValueRevisions).values({
      id: scheduleRevisionId,
      scheduleOfValuesId: scheduleId,
      organizationId,
      projectId,
      revisionNumber: 1,
      contractValue: '300.00',
      currencyCode: 'USD',
      status: 'APPROVED',
      createdBy: actorUserId,
      submittedBy: actorUserId,
      submittedAt: now,
      approvedBy: actorUserId,
      approvedAt: now,
    });
    await getDb()
      .insert(scheduleOfValueLines)
      .values({
        id: scheduleLineId,
        revisionId: scheduleRevisionId,
        organizationId,
        projectId,
        lineNumber: 1,
        description: `Financial summary work ${runId}`,
        costCodeId,
        scheduledValue: '300.00',
        retainagePercent: '10.00',
      });
    await getDb()
      .insert(paymentApplications)
      .values({
        id: applicationId,
        organizationId,
        projectId,
        revisionId: scheduleRevisionId,
        applicationNumber: 1,
        billingPeriodStart: now.toISOString().slice(0, 10),
        billingPeriodEnd: now.toISOString().slice(0, 10),
        currencyCode: 'USD',
        status: 'APPROVED',
        createdBy: actorUserId,
        submittedBy: actorUserId,
        submittedAt: now,
        approvedBy: actorUserId,
        approvedAt: now,
        grossRequested: '100.00',
        retainageRequested: '10.00',
        requestedAmount: '90.00',
        approvedGross: '90.00',
        approvedRetainage: '10.00',
        approvedAmount: '80.00',
      });
    await getDb().insert(paymentApplicationLines).values({
      id: applicationLineId,
      paymentApplicationId: applicationId,
      scheduleOfValueLineId: scheduleLineId,
      organizationId,
      projectId,
      lineNumber: 1,
      currentWork: '100.00',
      storedMaterials: '0.00',
      grossCompleted: '100.00',
      retainagePercent: '10.00',
      retainageRequested: '10.00',
      requestedAmount: '90.00',
      approvedCurrentWork: '90.00',
      approvedStoredMaterials: '0.00',
      approvedGross: '90.00',
      approvedRetainage: '10.00',
      approvedAmount: '80.00',
    });
    await getDb().insert(retainageRecords).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      paymentApplicationLineId: applicationLineId,
      currencyCode: 'USD',
      retainagePercent: '10.00',
      accruedAmount: '10.00',
      releasedAmount: '3.00',
      remainingAmount: '7.00',
      status: 'PARTIALLY_RELEASED',
      createdBy: actorUserId,
    });
    await getDb()
      .insert(invoices)
      .values([
        {
          id: receivableInvoiceId,
          organizationId,
          projectId,
          direction: 'RECEIVABLE',
          invoiceNumber: `FS-AR-${runId}`,
          billToName: 'Financial summary client',
          invoiceDate: now.toISOString().slice(0, 10),
          currencyCode: 'USD',
          subtotal: '120.00',
          taxAmount: '0.00',
          retainageAmount: '0.00',
          totalAmount: '120.00',
          status: 'APPROVED',
          createdBy: actorUserId,
          submittedBy: actorUserId,
          submittedAt: now,
          approvedBy: actorUserId,
          approvedAt: now,
        },
        {
          id: payableInvoiceId,
          organizationId,
          projectId,
          direction: 'PAYABLE',
          invoiceNumber: `FS-AP-${runId}`,
          supplierId,
          purchaseOrderId: approvedPOId,
          invoiceDate: now.toISOString().slice(0, 10),
          currencyCode: 'USD',
          subtotal: '50.00',
          taxAmount: '0.00',
          retainageAmount: '0.00',
          totalAmount: '50.00',
          status: 'APPROVED',
          createdBy: actorUserId,
          submittedBy: actorUserId,
          submittedAt: now,
          approvedBy: actorUserId,
          approvedAt: now,
        },
      ]);
    await getDb()
      .insert(payments)
      .values([
        {
          id: crypto.randomUUID(),
          organizationId,
          projectId,
          invoiceId: receivableInvoiceId,
          direction: 'RECEIVABLE',
          amount: '20.00',
          currencyCode: 'USD',
          paymentDate: now.toISOString().slice(0, 10),
          method: 'ACH',
          status: 'EXECUTED',
          createdBy: actorUserId,
          submittedBy: actorUserId,
          submittedAt: now,
          approvedBy: actorUserId,
          approvedAt: now,
          executedBy: actorUserId,
          executedAt: now,
        },
        {
          id: crypto.randomUUID(),
          organizationId,
          projectId,
          invoiceId: payableInvoiceId,
          direction: 'PAYABLE',
          amount: '15.00',
          currencyCode: 'USD',
          paymentDate: now.toISOString().slice(0, 10),
          method: 'ACH',
          status: 'EXECUTED',
          createdBy: actorUserId,
          submittedBy: actorUserId,
          submittedAt: now,
          approvedBy: actorUserId,
          approvedAt: now,
          executedBy: actorUserId,
          executedAt: now,
        },
      ]);

    const summaryResponse = await app.inject({
      method: 'GET',
      url: `${projectBase()}/financial-summary`,
      headers: authHeaders(token),
    });
    expect(summaryResponse.statusCode).toBe(200);
    const summary = summaryResponse.json().data;
    expect(summary.commitments.coverage).toBe('APPROVED_PURCHASE_ORDERS_ONLY');
    expect(summary.commitments.subcontractCommitments).toBe(
      'DEFERRED_UNTIL_APPROVED_CONTRACT_SOURCE_EXISTS',
    );
    expect(summary.commitments.currencyBreakdown).toEqual([
      { currencyCode: 'USD', approvedPOCommitments: '30.00' },
    ]);
    expect(summary.billingAndCash.currencyBreakdown[0]).toMatchObject({
      currencyCode: 'USD',
      approvedContractValue: '300.00',
      approvedPaymentApplications: '80.00',
      billedReceivables: '120.00',
      billedPayables: '50.00',
      approvedReceivables: '120.00',
      approvedPayables: '50.00',
      paidReceivables: '20.00',
      paidPayables: '15.00',
      receivablesOutstanding: '100.00',
      payablesOutstanding: '35.00',
      cashReceived: '20.00',
      cashPaid: '15.00',
      netCash: '5.00',
      retainageHeld: '7.00',
      retainageReleased: '3.00',
    });
    expect(summary.cost.currencyBreakdown).toContainEqual(
      expect.objectContaining({
        currencyCode: 'USD',
        originalBudget: '250.00',
        approvedBudgetChanges: '50.00',
        revisedBudget: '300.00',
        committed: '30.00',
        postedActual: '17.50',
      }),
    );
    expect(summary.billingAndCash.formulas.outstanding).toContain('executed payments');

    for (const route of [
      'cost-summary',
      'commitment-summary',
      'billing-summary',
      'cash-summary',
      'commercial-summary',
    ]) {
      const response = await app.inject({
        method: 'GET',
        url: `${projectBase()}/${route}`,
        headers: authHeaders(token),
      });
      expect(response.statusCode).toBe(200);
    }
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `${projectBase()}/financial-audit?limit=1`,
        })
      ).statusCode,
    ).toBe(401);
    expect(
      (
        await app.inject({
          method: 'GET',
          url: `${projectBase()}/financial-audit?limit=101`,
          headers: authHeaders(token),
        })
      ).statusCode,
    ).toBe(422);

    const firstResponse = await app.inject({
      method: 'GET',
      url: `${projectBase()}/financial-audit?limit=1`,
      headers: authHeaders(token),
    });
    expect(firstResponse.statusCode).toBe(200);
    const firstPage = firstResponse.json();
    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.data[0].entityId).toBe('invoice-new');
    expect(firstPage.meta.nextCursor).toEqual(expect.any(String));

    const secondResponse = await app.inject({
      method: 'GET',
      url: `${projectBase()}/financial-audit?limit=1&cursor=${encodeURIComponent(firstPage.meta.nextCursor)}`,
      headers: authHeaders(token),
    });
    expect(secondResponse.statusCode).toBe(200);
    expect(secondResponse.json().data).toHaveLength(1);
    expect(secondResponse.json().data[0].entityId).toBe('invoice-old');
    expect(secondResponse.json().meta.nextCursor).toBeNull();
    expect(JSON.stringify([firstPage, secondResponse.json()])).not.toContain('invoice-foreign');

    const missingChangeOrderAudit = await app.inject({
      method: 'GET',
      url: `${projectBase()}/change-orders/nonexistent-${runId}/audit`,
      headers: authHeaders(token),
    });
    expect(missingChangeOrderAudit.statusCode).toBe(404);
  });

  it('rejects updates and deletes to append-only financial audit events', async () => {
    const row = await getDb()
      .select()
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityId, 'invoice-new'),
        ),
      );
    await expect(
      getDb()
        .update(financialAuditEvents)
        .set({ action: 'TAMPERED' })
        .where(eq(financialAuditEvents.id, row[0]!.id)),
    ).rejects.toThrow('append-only');
    await expect(
      getDb().delete(financialAuditEvents).where(eq(financialAuditEvents.id, row[0]!.id)),
    ).rejects.toThrow('append-only');
  });
});
