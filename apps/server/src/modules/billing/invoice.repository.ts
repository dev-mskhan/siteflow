import { and, eq, lte } from 'drizzle-orm';
import type { DatabaseClient, DatabaseTransaction } from '@siteflow/database';
import {
  saasInvoices,
  saasPaymentAttempts,
  type SaasInvoice,
  type SaasPaymentAttempt,
  type NewSaasInvoice,
  type NewSaasPaymentAttempt,
} from '@siteflow/database/schema';

type Transaction = DatabaseTransaction | DatabaseClient;

export class InvoiceRepository {
  async upsertProviderInvoice(
    invoice: NewSaasInvoice,
    tx: Transaction,
  ): Promise<{ invoice: SaasInvoice; applied: boolean } | undefined> {
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
        setWhere: and(
          eq(saasInvoices.organizationId, invoice.organizationId),
          eq(saasInvoices.stripeCustomerId, invoice.stripeCustomerId),
          eq(saasInvoices.stripeSubscriptionId, invoice.stripeSubscriptionId),
          lte(saasInvoices.providerEventCreatedAt, invoice.providerEventCreatedAt),
        ),
      })
      .returning();
    const updated = rows[0];
    if (updated) return { invoice: updated, applied: true };

    const existing = await this.findProviderInvoice(
      invoice.organizationId,
      invoice.stripeMode,
      invoice.stripeInvoiceId,
      tx,
    );
    if (
      !existing ||
      existing.stripeCustomerId !== invoice.stripeCustomerId ||
      existing.stripeSubscriptionId !== invoice.stripeSubscriptionId
    ) {
      return undefined;
    }
    return { invoice: existing, applied: false };
  }

  private async findProviderInvoice(
    organizationId: string,
    stripeMode: NewSaasInvoice['stripeMode'],
    stripeInvoiceId: string,
    tx: Transaction,
  ) {
    const rows = await tx
      .select()
      .from(saasInvoices)
      .where(
        and(
          eq(saasInvoices.organizationId, organizationId),
          eq(saasInvoices.stripeMode, stripeMode),
          eq(saasInvoices.stripeInvoiceId, stripeInvoiceId),
        ),
      )
      .limit(1);
    return rows[0];
  }

  async upsertProviderPaymentAttempt(
    attempt: NewSaasPaymentAttempt,
    tx: Transaction,
  ): Promise<SaasPaymentAttempt | undefined> {
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
          lte(
            saasPaymentAttempts.providerEventCreatedAt,
            attempt.providerEventCreatedAt,
          ),
        ),
      })
      .returning();
    if (rows[0]) return rows[0];
    return this.findProviderPaymentAttempt(attempt, tx);
  }

  private async findProviderPaymentAttempt(
    attempt: NewSaasPaymentAttempt,
    tx: Transaction,
  ) {
    const rows = await tx
      .select()
      .from(saasPaymentAttempts)
      .where(
        and(
          eq(saasPaymentAttempts.organizationId, attempt.organizationId),
          eq(saasPaymentAttempts.saasInvoiceId, attempt.saasInvoiceId),
          eq(saasPaymentAttempts.stripeMode, attempt.stripeMode),
          eq(saasPaymentAttempts.stripeInvoiceId, attempt.stripeInvoiceId),
          eq(saasPaymentAttempts.stripePaymentIntentId, attempt.stripePaymentIntentId),
          eq(saasPaymentAttempts.attemptNumber, attempt.attemptNumber),
        ),
      )
      .limit(1);
    return rows[0];
  }
}

export const invoiceRepository = new InvoiceRepository();
