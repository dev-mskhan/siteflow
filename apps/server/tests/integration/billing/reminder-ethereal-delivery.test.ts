import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../../../src/lib/db/index.js';
import { emailService } from '../../../src/lib/email/email.service.js';
import {
  dispatchDueGraceReminders,
  ensureGraceReminderSchedule,
} from '../../../src/modules/billing/lifecycle.service.js';
import { createTestApp } from '../../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../../helpers/fixtures.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
}, 30_000);

afterAll(async () => {
  await app.close();
}, 30_000);

async function createPastDueOrg() {
  const { token, user } = await createVerifiedUser();
  const { orgId } = await createOrgWithAdmin(app, token);
  await getDb().execute(sql`
    INSERT INTO app.saas_subscriptions (
      id, organization_id, plan_id, price_version_id, interval, status,
      is_current, current_period_start, current_period_end, cancel_at_period_end,
      stripe_customer_id, stripe_subscription_id, stripe_price_id, grace_starts_at
    ) VALUES (
      ${crypto.randomUUID()}, ${orgId}, 'professional', 'pro_month_v1', 'month',
      'PAST_DUE', true, now() - interval '30 days', now(), false,
      ${`cus_eth_${crypto.randomUUID()}`}, ${`sub_eth_${crypto.randomUUID()}`},
      'price_pro_month_v1', now() - interval '2 days'
    )
  `);
  return { organizationId: orgId, adminEmail: user.email };
}

describe('grace reminder delivery over the real Ethereal dev transport (10-10 evidence)', () => {
  it('sends a real Day 1 reminder via Ethereal and records SENT only after positive confirmation', async () => {
    const { organizationId, adminEmail } = await createPastDueOrg();
    await ensureGraceReminderSchedule(organizationId);

    const captured: Array<{ messageId: string; previewUrl?: string | false; to: string }> = [];
    const original = emailService.sendMail.bind(emailService);
    const spy = vi.spyOn(emailService, 'sendMail').mockImplementation(async (options) => {
      const result = await original(options);
      captured.push({ messageId: result.messageId, previewUrl: result.previewUrl, to: options.to });
      return result;
    });

    try {
      const counts = await dispatchDueGraceReminders(organizationId);
      expect(counts).toEqual({ SENT: 1, RETRY: 0, FAILED: 0 });
    } finally {
      spy.mockRestore();
    }

    expect(captured).toHaveLength(1);
    const [sent] = captured;
    expect(sent!.messageId).toBeTruthy();
    expect(String(sent!.previewUrl)).toContain('ethereal.email');
    expect(sent!.to).toContain(adminEmail);

    const rows = (await getDb().execute(sql`
      SELECT organization_id AS "organizationId", status, sent_at AS "sentAt",
        last_error_code AS "lastErrorCode", reminder_key AS "reminderKey"
      FROM app.saas_reminder_deliveries
      WHERE organization_id = ${organizationId} AND reminder_key = 'grace_day_1'
    `)) as unknown as Array<{
      organizationId: string;
      status: string;
      sentAt: Date | string | null;
      lastErrorCode: string | null;
      reminderKey: string;
    }>;
    expect(rows).toHaveLength(1);
    expect(rows[0]!.organizationId).toBe(organizationId);
    expect(rows[0]!.status).toBe('SENT');
    expect(rows[0]!.sentAt).not.toBeNull();
    expect(rows[0]!.lastErrorCode).toBeNull();

    process.stdout.write(
      `ETHEREAL_EVIDENCE ${JSON.stringify({
        transport: 'ethereal-dev',
        messageId: sent!.messageId,
        previewUrl: sent!.previewUrl,
        reminderKey: rows[0]!.reminderKey,
        persistedStatus: rows[0]!.status,
      })}\n`,
    );
  }, 60_000);
});
