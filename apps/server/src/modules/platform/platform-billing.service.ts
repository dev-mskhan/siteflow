// apps/server/src/modules/platform/platform-billing.service.ts
import { sql } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import { writeOutboxEvent } from '../../lib/outbox/outbox.service.js';
import { AuthRepository } from '../auth/auth.repository.js';
import { NotFoundError, UnauthorizedError } from '../auth/auth.errors.js';
import { verifyPassword } from '../auth/password.service.js';
import { InvoiceRepository } from '../billing/invoice.repository.js';
import { getCurrentSubscriptionSnapshot } from '../billing/reminder-delivery.repository.js';
import { recoverStripeWebhookInbox } from '../billing/webhook.worker.js';
import type { LifecycleActionInput } from './platform-lifecycle.service.js';

const INVOICE_VIEW_LIMIT = 10;
const WEBHOOK_STATUSES = ['PENDING', 'RETRY', 'PROCESSING', 'FAILED', 'QUARANTINED'] as const;

export interface OrganizationBillingView {
  organizationId: string;
  subscription: {
    subscriptionId: string;
    status: string;
    planName: string | null;
    graceStartsAt: Date | null;
    amountCents: number | null;
    currency: string | null;
  } | null;
  invoices: Array<{
    id: string;
    status: string;
    amountDueCents: number;
    currency: string;
    createdAt: Date;
    paymentAttemptCount: number;
  }>;
}

export interface WebhookInboxSummary {
  /** Platform-wide counts. The inbox has no organization column, so these are not tenant-scoped. */
  counts: Record<(typeof WEBHOOK_STATUSES)[number], number>;
}

export class PlatformBillingService {
  private readonly authRepo = new AuthRepository();
  private readonly invoiceRepo = new InvoiceRepository();

  private async assertReauthenticated(actorUserId: string, password: string): Promise<void> {
    const actor = await this.authRepo.findUserById(actorUserId);
    if (!actor?.passwordHash || !(await verifyPassword(password, actor.passwordHash))) {
      throw new UnauthorizedError('Password confirmation failed');
    }
  }

  async getOrganizationBillingView(organizationId: string): Promise<OrganizationBillingView> {
    const exists = (await getDb().execute(
      sql`SELECT 1 FROM app.organizations WHERE id = ${organizationId} LIMIT 1`,
    )) as unknown as unknown[];
    if (exists.length === 0) {
      throw new NotFoundError('Organization not found');
    }

    const [snapshot, history] = await Promise.all([
      getCurrentSubscriptionSnapshot(organizationId),
      this.invoiceRepo.listHistoryByOrganization(organizationId, INVOICE_VIEW_LIMIT),
    ]);

    return {
      organizationId,
      subscription: snapshot
        ? {
            subscriptionId: snapshot.subscriptionId,
            status: snapshot.status,
            planName: snapshot.planName,
            graceStartsAt: snapshot.graceStartsAt,
            amountCents: snapshot.amountDueCents,
            currency: snapshot.currency,
          }
        : null,
      invoices: history.map(({ invoice, paymentAttempts }) => ({
        id: invoice.id,
        status: invoice.status,
        amountDueCents: invoice.amountDueCents,
        currency: invoice.currency,
        createdAt: invoice.createdAt,
        paymentAttemptCount: paymentAttempts.length,
      })),
    };
  }

  async getWebhookInboxSummary(): Promise<WebhookInboxSummary> {
    const rows = (await getDb().execute(sql`
      SELECT status::text AS "status", COUNT(*)::int AS "count"
      FROM app.saas_webhook_inbox
      WHERE status IN ('PENDING', 'RETRY', 'PROCESSING', 'FAILED', 'QUARANTINED')
      GROUP BY status
    `)) as unknown as Array<{ status: string; count: number }>;

    const counts = Object.fromEntries(WEBHOOK_STATUSES.map((s) => [s, 0])) as WebhookInboxSummary['counts'];
    for (const row of rows) {
      if (row.status in counts) counts[row.status as keyof WebhookInboxSummary['counts']] = row.count;
    }
    return { counts };
  }

  /**
   * Runs the existing bounded, idempotent inbox recovery. It is not wrapped in a DB
   * transaction because it calls Stripe; the recovery claims rows under a lease.
   */
  async triggerWebhookRecovery(input: LifecycleActionInput): Promise<{ processedCount: number }> {
    await this.assertReauthenticated(input.actorUserId, input.password);

    const processedCount = await recoverStripeWebhookInbox();

    await getDb().transaction(async (tx) => {
      await writeOutboxEvent(tx, 'platform.billing.webhook_recovery_requested', {
        actorUserId: input.actorUserId,
        reasonCode: input.reasonCode,
        processedCount,
      });
    });

    return { processedCount };
  }
}

export const platformBillingService = new PlatformBillingService();
