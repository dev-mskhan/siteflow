import { and, eq, lte } from 'drizzle-orm';
import type { DatabaseClient, DatabaseTransaction } from '@siteflow/database';
import {
  saasInvoices,
  saasRefundEvents,
  saasRefunds,
  type SaasRefund,
} from '@siteflow/database/schema';

type Transaction = DatabaseTransaction | DatabaseClient;

export const REFUND_STATUSES = ['pending', 'succeeded', 'failed', 'canceled'] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export interface VerifiedRefundFact {
  organizationId: string;
  saasInvoiceId: string;
  stripeMode: 'test' | 'live';
  stripeRefundId: string;
  stripeInvoiceId: string;
  stripeCustomerId: string;
  sourceEventId: string;
  amountCents: number;
  currency: string;
  status: RefundStatus;
  providerEventCreatedAt: Date;
}

export class RefundFactVerificationError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'RefundFactVerificationError';
  }
}

export function verifyRefundFact(fact: VerifiedRefundFact): VerifiedRefundFact {
  const idsValid = [
    fact.organizationId,
    fact.saasInvoiceId,
    fact.stripeRefundId,
    fact.stripeInvoiceId,
    fact.stripeCustomerId,
    fact.sourceEventId,
  ].every((value) => typeof value === 'string' && value.trim().length > 0);
  if (!idsValid) throw new RefundFactVerificationError('REFUND_IDENTITY_INVALID');
  if (fact.stripeMode !== 'test' && fact.stripeMode !== 'live') {
    throw new RefundFactVerificationError('REFUND_MODE_INVALID');
  }
  if (!Number.isSafeInteger(fact.amountCents) || fact.amountCents < 0) {
    throw new RefundFactVerificationError('REFUND_AMOUNT_INVALID');
  }
  if (!/^[a-z]{3}$/.test(fact.currency)) {
    throw new RefundFactVerificationError('REFUND_CURRENCY_INVALID');
  }
  if (!(REFUND_STATUSES as readonly string[]).includes(fact.status)) {
    throw new RefundFactVerificationError('REFUND_STATUS_INVALID');
  }
  if (Number.isNaN(fact.providerEventCreatedAt.getTime())) {
    throw new RefundFactVerificationError('REFUND_EVENT_TIME_INVALID');
  }
  return fact;
}

export class RefundHistoryRepository {
  // Tenant mapping is checked against the stored invoice; provider metadata is never trusted.
  async assertInvoiceBelongsToOrganization(
    fact: VerifiedRefundFact,
    tx: Transaction,
  ): Promise<void> {
    const rows = await tx
      .select({ id: saasInvoices.id })
      .from(saasInvoices)
      .where(
        and(
          eq(saasInvoices.id, fact.saasInvoiceId),
          eq(saasInvoices.organizationId, fact.organizationId),
          eq(saasInvoices.stripeMode, fact.stripeMode),
          eq(saasInvoices.stripeInvoiceId, fact.stripeInvoiceId),
          eq(saasInvoices.stripeCustomerId, fact.stripeCustomerId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new RefundFactVerificationError('REFUND_INVOICE_ASSOCIATION_MISMATCH');
  }

  // Returns the applied refund row, or undefined when a newer fact already exists.
  // The event log entry is written at most once per source event (replay-safe).
  async recordVerifiedRefund(
    input: VerifiedRefundFact,
    tx: Transaction,
  ): Promise<{ refund: SaasRefund; eventApplied: boolean } | undefined> {
    const fact = verifyRefundFact(input);
    await this.assertInvoiceBelongsToOrganization(fact, tx);

    const rows = await tx
      .insert(saasRefunds)
      .values({
        id: crypto.randomUUID(),
        organizationId: fact.organizationId,
        saasInvoiceId: fact.saasInvoiceId,
        stripeMode: fact.stripeMode,
        stripeRefundId: fact.stripeRefundId,
        stripeInvoiceId: fact.stripeInvoiceId,
        stripeCustomerId: fact.stripeCustomerId,
        amountCents: fact.amountCents,
        currency: fact.currency,
        status: fact.status,
        providerEventCreatedAt: fact.providerEventCreatedAt,
      })
      .onConflictDoUpdate({
        target: [saasRefunds.stripeMode, saasRefunds.stripeRefundId],
        set: {
          status: fact.status,
          amountCents: fact.amountCents,
          currency: fact.currency,
          providerEventCreatedAt: fact.providerEventCreatedAt,
          updatedAt: new Date(),
        },
        setWhere: and(
          eq(saasRefunds.organizationId, fact.organizationId),
          eq(saasRefunds.saasInvoiceId, fact.saasInvoiceId),
          eq(saasRefunds.stripeInvoiceId, fact.stripeInvoiceId),
          eq(saasRefunds.stripeCustomerId, fact.stripeCustomerId),
          lte(saasRefunds.providerEventCreatedAt, fact.providerEventCreatedAt),
        ),
      })
      .returning();

    let refund = rows[0];
    if (!refund) {
      const existing = await tx
        .select()
        .from(saasRefunds)
        .where(
          and(
            eq(saasRefunds.stripeMode, fact.stripeMode),
            eq(saasRefunds.stripeRefundId, fact.stripeRefundId),
          ),
        )
        .limit(1);
      const current = existing[0];
      if (!current) return undefined;
      if (
        current.organizationId !== fact.organizationId ||
        current.saasInvoiceId !== fact.saasInvoiceId
      ) {
        throw new RefundFactVerificationError('REFUND_IDENTITY_CONFLICT');
      }
      refund = current;
    }

    const inserted = await tx
      .insert(saasRefundEvents)
      .values({
        id: crypto.randomUUID(),
        organizationId: fact.organizationId,
        saasRefundId: refund.id,
        stripeMode: fact.stripeMode,
        sourceEventId: fact.sourceEventId,
        status: fact.status,
        amountCents: fact.amountCents,
        providerEventCreatedAt: fact.providerEventCreatedAt,
      })
      .onConflictDoNothing({
        target: [saasRefundEvents.stripeMode, saasRefundEvents.sourceEventId],
      })
      .returning({ id: saasRefundEvents.id });

    return { refund, eventApplied: inserted.length > 0 };
  }
}

export const refundHistoryRepository = new RefundHistoryRepository();
