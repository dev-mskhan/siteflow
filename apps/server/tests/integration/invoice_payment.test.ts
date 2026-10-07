import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq, inArray, sql } from 'drizzle-orm';
import {
  financialAuditEvents,
  invoices,
  outboxEvents,
  payments,
  projectMembers,
  projects,
  purchaseOrders,
  suppliers,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const authHeaders = (token: string, extras: Record<string, string> = {}) => ({
  authorization: `Bearer ${token}`,
  ...extras,
});

describe('invoices and payments (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let ownerId: string;
  let ownerToken: string;
  let reviewerToken: string;
  let executorToken: string;
  let approvedPoId: string;
  let pendingPoId: string;

  const invoiceBase = () =>
    `/api/v1/organizations/${organizationId}/projects/${projectId}/invoices`;
  const paymentBase = () =>
    `/api/v1/organizations/${organizationId}/projects/${projectId}/payments`;
  const invoicePayload = (invoiceNumber: string, purchaseOrderId = approvedPoId) => ({
    direction: 'PAYABLE',
    invoiceNumber,
    invoiceDate: '2026-04-01',
    dueDate: '2026-05-01',
    purchaseOrderId,
    subtotal: '100.00',
    taxAmount: '10.00',
    retainageAmount: '10.00',
  });

  async function createPayment(invoiceId: string, amount: string, key: string) {
    const created = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${invoiceId}/payments`,
      headers: authHeaders(ownerToken, { 'idempotency-key': key }),
      payload: { amount, paymentDate: '2026-04-15', method: 'ACH', reference: key },
    });
    expect(created.statusCode).toBe(201);
    const payment = created.json().data.payment;
    const submitted = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${payment.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: payment.version },
    });
    expect(submitted.statusCode).toBe(200);
    const approved = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${payment.id}/approve`,
      headers: authHeaders(await reviewerTokenValue()),
      payload: { expectedVersion: submitted.json().data.payment.version },
    });
    expect(approved.statusCode).toBe(200);
    return approved.json().data.payment;
  }

  let reviewerAccessToken = '';
  async function reviewerTokenValue() {
    return reviewerAccessToken;
  }

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `invoice-owner-${runId}@example.com` });
    ownerId = owner.user.id;
    ownerToken = owner.token;
    const org = await createOrgWithAdmin(app, ownerToken, `Invoice Org ${runId}`);
    organizationId = org.orgId;
    const reviewer = await createVerifiedUser({ email: `invoice-reviewer-${runId}@example.com` });
    reviewerAccessToken = reviewer.token;
    const executor = await createVerifiedUser({ email: `invoice-executor-${runId}@example.com` });
    executorToken = executor.token;
    await addMemberDirectly(organizationId, reviewer.user.id, org.roleMap.get('Project Manager')!);
    await addMemberDirectly(organizationId, executor.user.id, org.roleMap.get('Project Manager')!);

    projectId = crypto.randomUUID();
    approvedPoId = crypto.randomUUID();
    pendingPoId = crypto.randomUUID();
    const supplierId = crypto.randomUUID();
    const now = new Date();
    await getDb()
      .insert(projects)
      .values({
        id: projectId,
        organizationId,
        projectNumber: `INV-${runId}`,
        name: `Invoice payment project ${runId}`,
        currency: 'USD',
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
          userId: executor.user.id,
          role: 'FINANCE',
          status: 'ACTIVE',
          addedBy: ownerId,
        },
      ]);
    await getDb()
      .insert(suppliers)
      .values({
        id: supplierId,
        organizationId,
        supplierCode: `INV-S-${runId}`,
        legalName: `Invoice supplier ${runId}`,
        displayName: `Invoice supplier ${runId}`,
        status: 'ACTIVE',
      });
    await getDb()
      .insert(purchaseOrders)
      .values([
        {
          id: approvedPoId,
          organizationId,
          projectId,
          poNumber: `INV-PO-${runId}`,
          supplierId,
          status: 'APPROVED',
          orderDate: '2026-04-01',
          currencyCode: 'USD',
          subtotal: '1000.00',
          discountAmount: '0.00',
          taxAmount: '0.00',
          totalAmount: '1000.00',
          approvedAt: now,
          approvedBy: reviewer.user.id,
        },
        {
          id: pendingPoId,
          organizationId,
          projectId,
          poNumber: `INV-PENDING-PO-${runId}`,
          supplierId,
          status: 'PENDING_APPROVAL',
          orderDate: '2026-04-01',
          currencyCode: 'USD',
          subtotal: '1000.00',
          discountAmount: '0.00',
          taxAmount: '0.00',
          totalAmount: '1000.00',
        },
      ]);
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('requires approved PO authority, enforces invoice/payment SoD and prevents concurrent overpayment', async () => {
    const unauthenticated = await app.inject({ method: 'GET', url: invoiceBase() });
    expect(unauthenticated.statusCode).toBe(401);

    const unapprovedPo = await app.inject({
      method: 'POST',
      url: invoiceBase(),
      headers: authHeaders(ownerToken, { 'idempotency-key': `pending-${runId}` }),
      payload: invoicePayload(`PENDING-${runId}`, pendingPoId),
    });
    expect(unapprovedPo.statusCode).toBe(422);

    const missingKey = await app.inject({
      method: 'POST',
      url: invoiceBase(),
      headers: authHeaders(ownerToken),
      payload: invoicePayload(`MISSING-KEY-${runId}`),
    });
    expect(missingKey.statusCode).toBe(422);

    const created = await app.inject({
      method: 'POST',
      url: invoiceBase(),
      headers: authHeaders(ownerToken, { 'idempotency-key': `invoice-${runId}` }),
      payload: invoicePayload(`PAYABLE-${runId}`),
    });
    expect(created.statusCode).toBe(201);
    const invoice = created.json().data.invoice;
    expect(invoice).toMatchObject({
      direction: 'PAYABLE',
      status: 'DRAFT',
      currencyCode: 'USD',
      supplierId: expect.any(String),
      subtotal: '100.00',
      taxAmount: '10.00',
      retainageAmount: '10.00',
      totalAmount: '100.00',
      paidAmount: '0.00',
      outstandingAmount: '100.00',
    });
    const retry = await app.inject({
      method: 'POST',
      url: invoiceBase(),
      headers: authHeaders(ownerToken, { 'idempotency-key': `invoice-${runId}` }),
      payload: invoicePayload(`PAYABLE-${runId}`),
    });
    expect(retry.statusCode).toBe(201);
    expect(retry.json().data.invoice.id).toBe(invoice.id);

    const invalidDraftSource = await app.inject({
      method: 'PATCH',
      url: `${invoiceBase()}/${invoice.id}`,
      headers: authHeaders(ownerToken),
      payload: {
        ...invoicePayload(`PAYABLE-${runId}`, pendingPoId),
        expectedVersion: invoice.version,
      },
    });
    expect(invalidDraftSource.statusCode).toBe(422);

    const listed = await app.inject({
      method: 'GET',
      url: invoiceBase(),
      headers: authHeaders(ownerToken),
    });
    expect(listed.statusCode).toBe(200);
    expect(listed.json().data).toContainEqual(expect.objectContaining({ id: invoice.id }));
    const fetched = await app.inject({
      method: 'GET',
      url: `${invoiceBase()}/${invoice.id}`,
      headers: authHeaders(ownerToken),
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().data.invoice.id).toBe(invoice.id);

    const updated = await app.inject({
      method: 'PATCH',
      url: `${invoiceBase()}/${invoice.id}`,
      headers: authHeaders(ownerToken),
      payload: {
        ...invoicePayload(`PAYABLE-UPDATED-${runId}`),
        expectedVersion: invoice.version,
      },
    });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().data.invoice.version).toBe(invoice.version + 1);

    const submitted = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${invoice.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: updated.json().data.invoice.version },
    });
    expect(submitted.statusCode).toBe(200);
    const selfApproval = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${invoice.id}/approve`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: submitted.json().data.invoice.version },
    });
    expect(selfApproval.statusCode).toBe(403);
    const approvedResponse = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${invoice.id}/approve`,
      headers: authHeaders(reviewerAccessToken),
      payload: { expectedVersion: submitted.json().data.invoice.version },
    });
    expect(approvedResponse.statusCode).toBe(200);

    const rejectedDraft = await app.inject({
      method: 'POST',
      url: invoiceBase(),
      headers: authHeaders(ownerToken, { 'idempotency-key': `reject-invoice-${runId}` }),
      payload: invoicePayload(`REJECT-${runId}`),
    });
    expect(rejectedDraft.statusCode).toBe(201);
    const rejectedInvoice = rejectedDraft.json().data.invoice;
    const rejectedSubmit = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${rejectedInvoice.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: rejectedInvoice.version },
    });
    const rejected = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${rejectedInvoice.id}/reject`,
      headers: authHeaders(reviewerAccessToken),
      payload: {
        expectedVersion: rejectedSubmit.json().data.invoice.version,
        reason: 'Supporting documents are incomplete.',
      },
    });
    expect(rejected.statusCode).toBe(200);
    const voided = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${rejectedInvoice.id}/void`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: rejected.json().data.invoice.version },
    });
    expect(voided.statusCode).toBe(200);
    expect(voided.json().data.invoice.status).toBe('VOIDED');

    const approvedInvoice = await app.inject({
      method: 'POST',
      url: invoiceBase(),
      headers: authHeaders(ownerToken, { 'idempotency-key': `invoice-concurrent-${runId}` }),
      payload: invoicePayload(`CONCURRENT-${runId}`),
    });
    expect(approvedInvoice.statusCode).toBe(201);
    const concurrentInvoiceId = approvedInvoice.json().data.invoice.id as string;
    const concurrentSubmitted = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${concurrentInvoiceId}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: 1 },
    });
    const concurrentApproved = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${concurrentInvoiceId}/approve`,
      headers: authHeaders(reviewerAccessToken),
      payload: { expectedVersion: concurrentSubmitted.json().data.invoice.version },
    });
    expect(concurrentApproved.statusCode).toBe(200);

    const rejectedPaymentResponse = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${invoice.id}/payments`,
      headers: authHeaders(ownerToken, { 'idempotency-key': `reject-payment-${runId}` }),
      payload: {
        amount: '5.00',
        paymentDate: '2026-04-15',
        method: 'ACH',
        reference: `reject-payment-${runId}`,
      },
    });
    expect(rejectedPaymentResponse.statusCode).toBe(201);
    const rejectedPayment = rejectedPaymentResponse.json().data.payment;
    const rejectedPaymentSubmit = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${rejectedPayment.id}/submit`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: rejectedPayment.version },
    });
    const rejectedPaymentDecision = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${rejectedPayment.id}/reject`,
      headers: authHeaders(reviewerAccessToken),
      payload: {
        expectedVersion: rejectedPaymentSubmit.json().data.payment.version,
        reason: 'Payment details require correction.',
      },
    });
    expect(rejectedPaymentDecision.statusCode).toBe(200);
    const voidedPayment = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${rejectedPayment.id}/void`,
      headers: authHeaders(ownerToken),
      payload: { expectedVersion: rejectedPaymentDecision.json().data.payment.version },
    });
    expect(voidedPayment.statusCode).toBe(200);
    expect(voidedPayment.json().data.payment.status).toBe('VOIDED');

    const payment = await createPayment(invoice.id, '30.00', `payment-${runId}`);
    const paymentRetry = await app.inject({
      method: 'POST',
      url: `${invoiceBase()}/${invoice.id}/payments`,
      headers: authHeaders(ownerToken, { 'idempotency-key': `payment-${runId}` }),
      payload: {
        amount: '30.00',
        paymentDate: '2026-04-15',
        method: 'ACH',
        reference: `payment-${runId}`,
      },
    });
    expect(paymentRetry.statusCode).toBe(201);
    expect(paymentRetry.json().data.payment.id).toBe(payment.id);
    const approverCannotExecute = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${payment.id}/execute`,
      headers: authHeaders(reviewerAccessToken, { 'idempotency-key': `bad-execute-${runId}` }),
      payload: { expectedVersion: payment.version },
    });
    expect(approverCannotExecute.statusCode).toBe(403);
    const creatorCannotExecute = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${payment.id}/execute`,
      headers: authHeaders(ownerToken, { 'idempotency-key': `bad-execute-owner-${runId}` }),
      payload: { expectedVersion: payment.version },
    });
    expect(creatorCannotExecute.statusCode).toBe(403);
    const executed = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${payment.id}/execute`,
      headers: authHeaders(executorToken, { 'idempotency-key': `execute-${runId}` }),
      payload: { expectedVersion: payment.version },
    });
    expect(executed.statusCode).toBe(200);
    expect(executed.json().data.payment.status).toBe('EXECUTED');
    const executeRetry = await app.inject({
      method: 'POST',
      url: `${paymentBase()}/${payment.id}/execute`,
      headers: authHeaders(executorToken, { 'idempotency-key': `execute-${runId}` }),
      payload: { expectedVersion: payment.version },
    });
    expect(executeRetry.statusCode).toBe(200);

    const pendingExecutions = await Promise.all(
      ['concurrent-a', 'concurrent-b'].map(async (label) => {
        const approved = await createPayment(concurrentInvoiceId, '60.00', `${label}-${runId}`);
        return app.inject({
          method: 'POST',
          url: `${paymentBase()}/${approved.id}/execute`,
          headers: authHeaders(executorToken, { 'idempotency-key': `${label}-execute-${runId}` }),
          payload: { expectedVersion: approved.version },
        });
      }),
    );
    expect(pendingExecutions.map(({ statusCode }) => statusCode).sort()).toEqual([200, 422]);

    const [persistedInvoice] = await getDb()
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.organizationId, organizationId),
          eq(invoices.projectId, projectId),
          eq(invoices.id, invoice.id),
        ),
      );
    expect(persistedInvoice).toMatchObject({
      status: 'APPROVED',
      approvedBy: expect.any(String),
      supplierId: expect.any(String),
      purchaseOrderId: approvedPoId,
    });
    const persistedPayments = await getDb()
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.projectId, projectId),
          eq(payments.invoiceId, invoice.id),
        ),
      );
    const persistedPayment = persistedPayments.find(({ id }) => id === payment.id);
    expect(persistedPayment).toMatchObject({
      status: 'EXECUTED',
      amount: '30.00',
      createdBy: ownerId,
      approvedBy: expect.any(String),
      executedBy: expect.any(String),
    });
    expect(persistedPayment?.approvedBy).not.toBe(persistedPayment?.executedBy);
    expect(persistedPayment?.createdBy).not.toBe(persistedPayment?.executedBy);

    const concurrentPaid = await getDb()
      .select({ amount: sql<string>`COALESCE(SUM(${payments.amount}), 0)::text` })
      .from(payments)
      .where(
        and(
          eq(payments.organizationId, organizationId),
          eq(payments.projectId, projectId),
          eq(payments.invoiceId, concurrentInvoiceId),
          eq(payments.status, 'EXECUTED'),
        ),
      );
    expect(Number(concurrentPaid[0]?.amount)).toBeLessThanOrEqual(100);
    const paymentList = await app.inject({
      method: 'GET',
      url: `${paymentBase()}?invoiceId=${invoice.id}`,
      headers: authHeaders(ownerToken),
    });
    expect(paymentList.statusCode).toBe(200);
    expect(paymentList.json().data).toContainEqual(expect.objectContaining({ id: payment.id }));
    const paymentDetail = await app.inject({
      method: 'GET',
      url: `${paymentBase()}/${payment.id}`,
      headers: authHeaders(ownerToken),
    });
    expect(paymentDetail.statusCode).toBe(200);
    expect(paymentDetail.json().data.payment.id).toBe(payment.id);

    const audit = await getDb()
      .select({ action: financialAuditEvents.action })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          inArray(financialAuditEvents.entityId, [
            invoice.id,
            rejectedInvoice.id,
            payment.id,
            rejectedPayment.id,
          ]),
        ),
      );
    expect(audit.map(({ action }) => action)).toEqual(
      expect.arrayContaining([
        'INVOICE_CREATED',
        'INVOICE_SUBMITTED',
        'INVOICE_APPROVED',
        'INVOICE_REJECTED',
        'INVOICE_VOIDED',
        'PAYMENT_CREATED',
        'PAYMENT_SUBMITTED',
        'PAYMENT_APPROVED',
        'PAYMENT_EXECUTED',
      ]),
    );
    const invoiceOutbox = await getDb()
      .select({ eventType: outboxEvents.eventType })
      .from(outboxEvents)
      .where(
        and(
          eq(outboxEvents.organizationId, organizationId),
          sql`${outboxEvents.payload} ->> 'invoiceId' = ${invoice.id}`,
        ),
      );
    expect(invoiceOutbox.map(({ eventType }) => eventType)).toContain('commercial.invoice.created');
  });
});
