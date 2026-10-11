import { and, eq } from 'drizzle-orm';
import type { DatabaseClient, DatabaseTransaction } from '@siteflow/database';
import {
  saasInvoices,
  saasPaymentAttempts,
  type NewSaasInvoice,
  type NewSaasPaymentAttempt,
} from '@siteflow/database/schema';

type Transaction = DatabaseTransaction | DatabaseClient;

export class InvoiceRepository {
  async upsertProviderInvoice(
    invoice: NewSaasInvoice,
    tx: Transaction,
  ) {
    const rows = await tx
      .insert(saasInvoices)
      .values(invoice)
      .onConflictDoUpdate({
        target: [saasInvoices.stripeMode, saasInvoices.stripeInvoiceId],
        set: {
          organizationId: invoice.organizationId,
          stripeCustomerId: invoice.stripeCustomerId,
          stripeSubscriptionId: invoice.stripeSubscriptionId,
          invoiceNumber: invoice.invoiceNumber,
          status: invoice.status,
          amountDueCents: invoice.amountDueCents,
          amountPaidCents: invoice.amountPaidCents,
          currency: invoice.currency,
          periodStart: invoice.periodStart,
          periodEnd: invoice.periodEnd,
          hostedInvoiceUrl: invoice.hostedInvoiceUrl,
          invoicePdfUrl: invoice.invoicePdfUrl,
          providerEventCreatedAt: invoice.providerEventCreatedAt,
          updatedAt: new Date(),
        },
        setWhere: eq(saasInvoices.organizationId, invoice.organizationId),
      })
      .returning();
    return rows[0];
  }

  async upsertProviderPaymentAttempt(
    attempt: NewSaasPaymentAttempt,
    tx: Transaction,
  ) {
    const rows = await tx
      .insert(saasPaymentAttempts)
      .values(attempt)
      .onConflictDoUpdate({
        target: [
          saasPaymentAttempts.stripeMode,
          saasPaymentAttempts.stripeInvoiceId,
          saasPaymentAttempts.attemptNumber,
        ],
        set: {
          organizationId: attempt.organizationId,
          saasInvoiceId: attempt.saasInvoiceId,
          stripePaymentIntentId: attempt.stripePaymentIntentId,
          status: attempt.status,
          amountCents: attempt.amountCents,
          currency: attempt.currency,
          providerEventCreatedAt: attempt.providerEventCreatedAt,
          updatedAt: new Date(),
        },
        setWhere: and(
          eq(saasPaymentAttempts.organizationId, attempt.organizationId),
          eq(saasPaymentAttempts.saasInvoiceId, attempt.saasInvoiceId),
          eq(saasPaymentAttempts.stripePaymentIntentId, attempt.stripePaymentIntentId),
        ),
      })
      .returning();
    return rows[0];
  }
}

export const invoiceRepository = new InvoiceRepository();
