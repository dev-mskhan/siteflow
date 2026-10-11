import { randomUUID } from 'node:crypto';
import type { DatabaseTransaction } from '@siteflow/database';
import type {
  SaasInvoice,
  SaasPaymentAttempt,
} from '@siteflow/database/schema';
import { invoiceRepository } from './invoice.repository.js';
import type { InvoiceRepository } from './invoice.repository.js';

export type SaaSInvoiceStatus =
  | 'DRAFT'
  | 'OPEN'
  | 'PAID'
  | 'UNCOLLECTIBLE'
  | 'VOID';
export type SaaSPaymentAttemptStatus = 'FAILED' | 'SUCCEEDED';

export interface VerifiedProviderInvoiceFacts {
  organizationId: string;
  stripeMode: 'test' | 'live';
  stripeInvoiceId: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  invoiceNumber: string | null;
  status: SaaSInvoiceStatus;
  amountDueCents: number;
  amountPaidCents: number;
  currency: string;
  periodStart: Date;
  periodEnd: Date;
  hostedInvoiceUrl: string | null;
  invoicePdfUrl: string | null;
  providerEventCreatedAt: Date;
  paymentAttempt?: {
    stripePaymentIntentId: string;
    attemptNumber: number;
    status: SaaSPaymentAttemptStatus;
    amountCents: number;
  };
}

export class SaaSInvoiceIdentityConflictError extends Error {
  readonly code = 'SAAS_INVOICE_PROVIDER_IDENTITY_CONFLICT';

  constructor() {
    super('Stripe invoice or payment attempt is already associated with another tenant');
    this.name = 'SaaSInvoiceIdentityConflictError';
  }
}

export class InvoiceService {
  constructor(private readonly repo: InvoiceRepository = invoiceRepository) {}

  async synchronizeVerifiedInvoice(
    facts: VerifiedProviderInvoiceFacts,
    tx: DatabaseTransaction,
  ): Promise<{ invoice: SaasInvoice; paymentAttempt?: SaasPaymentAttempt }> {
    if (
      !Number.isSafeInteger(facts.amountDueCents) ||
      facts.amountDueCents < 0 ||
      !Number.isSafeInteger(facts.amountPaidCents) ||
      facts.amountPaidCents < 0 ||
      !/^[a-z]{3}$/.test(facts.currency) ||
      !Number.isFinite(facts.periodStart.getTime()) ||
      !Number.isFinite(facts.periodEnd.getTime()) ||
      !Number.isFinite(facts.providerEventCreatedAt.getTime())
    ) {
      throw new Error('Verified Stripe invoice facts are invalid');
    }

    const invoice = await this.repo.upsertProviderInvoice(
      {
        id: randomUUID(),
        organizationId: facts.organizationId,
        stripeMode: facts.stripeMode,
        stripeInvoiceId: facts.stripeInvoiceId,
        stripeCustomerId: facts.stripeCustomerId,
        stripeSubscriptionId: facts.stripeSubscriptionId,
        invoiceNumber: facts.invoiceNumber,
        status: facts.status,
        amountDueCents: facts.amountDueCents,
        amountPaidCents: facts.amountPaidCents,
        currency: facts.currency,
        periodStart: facts.periodStart,
        periodEnd: facts.periodEnd,
        hostedInvoiceUrl: facts.hostedInvoiceUrl,
        invoicePdfUrl: facts.invoicePdfUrl,
        providerEventCreatedAt: facts.providerEventCreatedAt,
      },
      tx,
    );
    if (!invoice) throw new SaaSInvoiceIdentityConflictError();

    if (!facts.paymentAttempt) return { invoice };
    const paymentAttempt = await this.repo.upsertProviderPaymentAttempt(
      {
        id: randomUUID(),
        organizationId: facts.organizationId,
        saasInvoiceId: invoice.id,
        stripeMode: facts.stripeMode,
        stripeInvoiceId: facts.stripeInvoiceId,
        stripePaymentIntentId: facts.paymentAttempt.stripePaymentIntentId,
        attemptNumber: facts.paymentAttempt.attemptNumber,
        status: facts.paymentAttempt.status,
        amountCents: facts.paymentAttempt.amountCents,
        currency: facts.currency,
        providerEventCreatedAt: facts.providerEventCreatedAt,
      },
      tx,
    );
    if (!paymentAttempt) throw new SaaSInvoiceIdentityConflictError();
    return { invoice, paymentAttempt };
  }
}

export const invoiceService = new InvoiceService();
