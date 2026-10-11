import { and, desc, eq, lte, sql } from 'drizzle-orm';
import type { DatabaseClient, DatabaseTransaction } from '@siteflow/database';
import {
  saasInvoices,
  saasPaymentAttempts,
  type SaasInvoice,
  type SaasPaymentAttempt,
  type NewSaasInvoice,
  type NewSaasPaymentAttempt,
} from '@siteflow/database/schema';
import {
  SAAS_INVOICE_HISTORY_MAX_ATTEMPTS_PER_INVOICE,
  SAAS_INVOICE_HISTORY_MAX_LIMIT,
} from '@siteflow/shared';
import { getDb } from '../../lib/db/index.js';

type Transaction = DatabaseTransaction | DatabaseClient;

type HistoryPaymentAttemptRow = Pick<
  SaasPaymentAttempt,
  | 'id'
  | 'organizationId'
  | 'saasInvoiceId'
  | 'attemptNumber'
  | 'status'
  | 'amountCents'
  | 'currency'
  | 'createdAt'
>;

export class InvoiceRepository {
  async listHistoryByOrganization(
    organizationId: string,
    limit: number,
    db: DatabaseClient = getDb(),
  ): Promise<Array<{ invoice: SaasInvoice; paymentAttempts: HistoryPaymentAttemptRow[] }>> {
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > SAAS_INVOICE_HISTORY_MAX_LIMIT) {
      throw new RangeError('SaaS invoice history limit is outside the allowed range');
    }

    const invoices = await db
      .select()
      .from(saasInvoices)
      .where(eq(saasInvoices.organizationId, organizationId))
      .orderBy(desc(saasInvoices.createdAt), desc(saasInvoices.id))
      .limit(limit);
    if (invoices.length === 0) return [];

    const invoiceIds = invoices.map((invoice) => invoice.id);
    const attempts = await db.execute(sql`
      SELECT
        id,
        organization_id AS "organizationId",
        saas_invoice_id AS "saasInvoiceId",
        attempt_number AS "attemptNumber",
        status,
        amount_cents AS "amountCents",
        currency,
        created_at AS "createdAt"
      FROM (
        SELECT
          id,
          organization_id,
          saas_invoice_id,
          attempt_number,
          status,
          amount_cents,
          currency,
          created_at,
          row_number() OVER (
            PARTITION BY saas_invoice_id
            ORDER BY attempt_number DESC, created_at DESC, id DESC
          ) AS attempt_rank
        FROM app.saas_payment_attempts
        WHERE organization_id = ${organizationId}
          AND saas_invoice_id IN (${sql.join(
            invoiceIds.map((invoiceId) => sql`${invoiceId}`),
            sql`, `,
          )})
      ) AS ranked_attempts
      WHERE attempt_rank <= ${SAAS_INVOICE_HISTORY_MAX_ATTEMPTS_PER_INVOICE}
      ORDER BY "saasInvoiceId", "attemptNumber" ASC
    `);
    const attemptsByInvoice = new Map<string, HistoryPaymentAttemptRow[]>();
    for (const attempt of attempts as unknown as HistoryPaymentAttemptRow[]) {
      const current = attemptsByInvoice.get(attempt.saasInvoiceId) ?? [];
      current.push(attempt);
      attemptsByInvoice.set(attempt.saasInvoiceId, current);
    }

    return invoices.map((invoice) => ({
      invoice,
      paymentAttempts: attemptsByInvoice.get(invoice.id) ?? [],
    }));
  }

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
          taxCalculationId: invoice.taxCalculationId,
          taxAmountCents: invoice.taxAmountCents,
          taxCurrency: invoice.taxCurrency,
          taxJurisdictionCountries: invoice.taxJurisdictionCountries,
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
