import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../../../src/lib/db/index.js';
import {
  countReminderDeliveriesByStatus,
  listBillingAdminEmails,
} from '../../../src/modules/billing/reminder-delivery.repository.js';
import { preferenceService } from '../../../src/modules/notification/preferences/preference.service.js';
import {
  dispatchDueGraceReminders,
  ensureGraceReminderSchedule,
  getReminderDeliveryStatus,
  MAX_REMINDER_ATTEMPTS,
} from '../../../src/modules/billing/lifecycle.service.js';
import { runLifecycleSweep } from '../../../src/modules/billing/lifecycle.worker.js';
import { ReminderTransportError } from '../../../src/modules/billing/reminder-delivery.transport.js';
import { createTestApp } from '../../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../../helpers/fixtures.js';

const transportMock = vi.hoisted(() => ({ sendGraceReminder: vi.fn() }));

vi.mock('../../../src/modules/billing/reminder-delivery.transport.js', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../../../src/modules/billing/reminder-delivery.transport.js')>();
  return {
    ...actual,
    sendGraceReminder: transportMock.sendGraceReminder,
  };
});

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
}, 30_000);

afterAll(async () => {
  await app.close();
}, 30_000);

beforeEach(() => {
  transportMock.sendGraceReminder.mockReset();
  transportMock.sendGraceReminder.mockResolvedValue({ messageId: 'msg-test' });
});

async function createPastDueOrg(graceAgo: string | null = '2 days') {
  const { token, user } = await createVerifiedUser();
  const { orgId } = await createOrgWithAdmin(app, token);
  const subscriptionId = crypto.randomUUID();
  await getDb().execute(sql`
    INSERT INTO app.saas_subscriptions (
      id, organization_id, plan_id, price_version_id, interval, status,
      is_current, current_period_start, current_period_end, cancel_at_period_end,
      stripe_customer_id, stripe_subscription_id, stripe_price_id, grace_starts_at
    ) VALUES (
      ${subscriptionId}, ${orgId}, 'professional', 'pro_month_v1', 'month',
      'PAST_DUE', true, now() - interval '30 days', now(), false,
      ${`cus_lc_${crypto.randomUUID()}`}, ${`sub_lc_${crypto.randomUUID()}`},
      'price_pro_month_v1',
      ${graceAgo ? sql.raw(`now() - interval '${graceAgo}'`) : null}
    )
  `);
  return { organizationId: orgId, subscriptionId, adminEmail: user.email, adminUserId: user.id };
}

async function setReminderDue(organizationId: string) {
  await getDb().execute(sql`
    UPDATE app.saas_reminder_deliveries
    SET next_attempt_at = now() - interval '1 second'
    WHERE organization_id = ${organizationId}
  `);
}

describe('billing grace reminder dispatch (10-09 Task 3)', () => {
  it('creates Day 1/3/6 occurrences exactly once per subscription', async () => {
    const { organizationId } = await createPastDueOrg();

    expect(await ensureGraceReminderSchedule(organizationId)).toBe(3);
    expect(await ensureGraceReminderSchedule(organizationId)).toBe(0);

    expect(await countReminderDeliveriesByStatus(organizationId)).toEqual({ PENDING: 3 });
  });

  it('sends the due Day 1 reminder to billing admins and records SENT', async () => {
    const { organizationId, adminEmail } = await createPastDueOrg('2 days');
    await ensureGraceReminderSchedule(organizationId);

    const counts = await dispatchDueGraceReminders(organizationId);

    expect(counts).toEqual({ SENT: 1, RETRY: 0, FAILED: 0, SUPPRESSED: 0 });
    expect(transportMock.sendGraceReminder).toHaveBeenCalledTimes(1);
    const payload = transportMock.sendGraceReminder.mock.calls[0]![0];
    expect(payload.recipients).toContain(adminEmail);
    expect(payload.graceDay).toBe(1);
    expect(Object.keys(payload).sort()).toEqual(
      ['amountDueText', 'billingPortalUrl', 'graceDay', 'planName', 'recipients'].sort(),
    );
    expect(await countReminderDeliveriesByStatus(organizationId)).toEqual({ PENDING: 2, SENT: 1 });
  });

  it('suppresses a reminder when all billing admins opt out of billing email', async () => {
    const { organizationId, adminUserId } = await createPastDueOrg('2 days');
    await preferenceService.setPreference(
      organizationId,
      adminUserId,
      'billing.grace_reminder',
      'EMAIL',
      false,
    );
    await ensureGraceReminderSchedule(organizationId);

    const counts = await dispatchDueGraceReminders(organizationId);

    expect(counts).toEqual({ SENT: 0, RETRY: 0, FAILED: 0, SUPPRESSED: 1 });
    expect(transportMock.sendGraceReminder).not.toHaveBeenCalled();
    expect(await countReminderDeliveriesByStatus(organizationId)).toEqual({
      PENDING: 2,
      SUPPRESSED: 1,
    });
    expect((await getReminderDeliveryStatus(organizationId)).suppressed).toBe(1);
  });

  it('never resends after success, including across a simulated restart', async () => {
    const { organizationId } = await createPastDueOrg('2 days');
    await ensureGraceReminderSchedule(organizationId);
    await dispatchDueGraceReminders(organizationId);

    await ensureGraceReminderSchedule(organizationId);
    await setReminderDue(organizationId);
    await dispatchDueGraceReminders(organizationId);
    await dispatchDueGraceReminders(organizationId);

    const day1Calls = transportMock.sendGraceReminder.mock.calls.filter(
      ([payload]) => payload.graceDay === 1,
    );
    expect(day1Calls).toHaveLength(1);
    expect(transportMock.sendGraceReminder).toHaveBeenCalledTimes(3);
  });

  it('keeps a transport failure retryable without marking it SENT', async () => {
    const { organizationId } = await createPastDueOrg('2 days');
    await ensureGraceReminderSchedule(organizationId);
    transportMock.sendGraceReminder.mockRejectedValueOnce(
      new ReminderTransportError('TRANSPORT_SEND_FAILED'),
    );

    const first = await dispatchDueGraceReminders(organizationId);
    expect(first).toEqual({ SENT: 0, RETRY: 1, FAILED: 0, SUPPRESSED: 0 });

    const status = await getReminderDeliveryStatus(organizationId);
    expect(status.sent).toBe(0);
    expect(status.retrying).toBe(1);
    expect(status.pending).toBe(3);

    await setReminderDue(organizationId);
    const second = await dispatchDueGraceReminders(organizationId);
    expect(second).toEqual({ SENT: 3, RETRY: 0, FAILED: 0, SUPPRESSED: 0 });
    expect((await getReminderDeliveryStatus(organizationId)).sent).toBe(3);
  });

  it('marks a reminder terminally FAILED once attempts are exhausted', async () => {
    const { organizationId } = await createPastDueOrg('2 days');
    await ensureGraceReminderSchedule(organizationId);
    await getDb().execute(sql`
      UPDATE app.saas_reminder_deliveries
      SET attempt_count = ${MAX_REMINDER_ATTEMPTS - 1}
      WHERE organization_id = ${organizationId} AND reminder_key = 'grace_day_1'
    `);
    transportMock.sendGraceReminder.mockRejectedValueOnce(
      new ReminderTransportError('TRANSPORT_SEND_FAILED'),
    );

    expect(await dispatchDueGraceReminders(organizationId)).toEqual({
      SENT: 0,
      RETRY: 0,
      FAILED: 1,
      SUPPRESSED: 0,
    });
    const rows = (await getDb().execute(sql`
      SELECT status, last_error_code AS "lastErrorCode"
      FROM app.saas_reminder_deliveries
      WHERE organization_id = ${organizationId} AND reminder_key = 'grace_day_1'
    `)) as unknown as Array<{ status: string; lastErrorCode: string }>;
    expect(rows[0]).toEqual({ status: 'FAILED', lastErrorCode: 'TRANSPORT_SEND_FAILED' });
  });

  it('cancels remaining reminders as terminal FAILED after payment recovers the subscription', async () => {
    const { organizationId, subscriptionId } = await createPastDueOrg('2 days');
    await ensureGraceReminderSchedule(organizationId);
    await getDb().execute(sql`
      UPDATE app.saas_subscriptions SET status = 'ACTIVE', grace_starts_at = NULL
      WHERE id = ${subscriptionId}
    `);
    await setReminderDue(organizationId);

    const counts = await dispatchDueGraceReminders(organizationId);

    expect(counts).toEqual({ SENT: 0, RETRY: 0, FAILED: 3, SUPPRESSED: 0 });
    expect(transportMock.sendGraceReminder).not.toHaveBeenCalled();
    const rows = (await getDb().execute(sql`
      SELECT last_error_code AS "lastErrorCode"
      FROM app.saas_reminder_deliveries
      WHERE organization_id = ${organizationId} AND status = 'FAILED'
    `)) as unknown as Array<{ lastErrorCode: string }>;
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.lastErrorCode === 'GRACE_NO_LONGER_ACTIVE')).toBe(true);
  });

  it('scopes counts and dispatch to the owning organization only', async () => {
    const orgA = await createPastDueOrg('2 days');
    const orgB = await createPastDueOrg('2 days');
    await ensureGraceReminderSchedule(orgA.organizationId);
    await ensureGraceReminderSchedule(orgB.organizationId);

    await dispatchDueGraceReminders(orgA.organizationId);

    expect((await getReminderDeliveryStatus(orgA.organizationId)).sent).toBe(1);
    expect((await getReminderDeliveryStatus(orgB.organizationId)).sent).toBe(0);
    expect((await getReminderDeliveryStatus(orgB.organizationId)).pending).toBe(3);
  });

  it('lists billing admins only for the requested tenant', async () => {
    const orgA = await createPastDueOrg();
    const orgB = await createPastDueOrg();

    const emailsA = await listBillingAdminEmails(orgA.organizationId);
    expect(emailsA).toContain(orgA.adminEmail);
    expect(emailsA).not.toContain(orgB.adminEmail);
  });

  it('sweep discovers past-due orgs and isolates per-org outcomes', async () => {
    const pastDue = await createPastDueOrg('2 days');

    const result = await runLifecycleSweep();

    expect(result.organizations).toBeGreaterThanOrEqual(1);
    expect(result.failedOrganizations).toBe(0);
    expect((await getReminderDeliveryStatus(pastDue.organizationId)).sent).toBe(1);
  });
});
