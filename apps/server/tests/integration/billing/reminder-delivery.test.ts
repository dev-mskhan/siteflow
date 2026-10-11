import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { getDb } from '../../../src/lib/db/index.js';
import {
  claimDueReminderDeliveries,
  countReminderDeliveriesByStatus,
  markReminderFailed,
  markReminderRetry,
  markReminderSent,
  scheduleReminderDelivery,
} from '../../../src/modules/billing/reminder-delivery.repository.js';
import { createTestApp } from '../../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../../helpers/fixtures.js';

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
}, 30_000);

afterAll(async () => {
  await app.close();
}, 30_000);

async function createSubscriptionFixture() {
  const { token } = await createVerifiedUser();
  const { orgId } = await createOrgWithAdmin(app, token);
  const subscriptionId = crypto.randomUUID();
  await getDb().execute(sql`
    INSERT INTO app.saas_subscriptions (
      id, organization_id, plan_id, price_version_id, interval, status,
      is_current, current_period_start, current_period_end, cancel_at_period_end,
      stripe_customer_id, stripe_subscription_id, stripe_price_id
    ) VALUES (
      ${subscriptionId}, ${orgId}, 'professional', 'pro_month_v1', 'month',
      'PAST_DUE', true, now() - interval '30 days', now(), false,
      ${`cus_rem_${crypto.randomUUID()}`}, ${`sub_rem_${crypto.randomUUID()}`},
      'price_pro_month_v1'
    )
  `);
  return { organizationId: orgId, subscriptionId };
}

async function scheduleOne(
  organizationId: string,
  subscriptionId: string,
  reminderKey: string,
  dueAt = new Date(Date.now() - 1000),
) {
  return scheduleReminderDelivery({
    organizationId,
    subscriptionId,
    reminderKey,
    idempotencyKey: `${subscriptionId}:${reminderKey}`,
    dueAt,
  });
}

describe('SaaS reminder delivery persistence (10-09 Task 2)', () => {
  it('treats repeated scheduling of the same occurrence as a no-op', async () => {
    const { organizationId, subscriptionId } = await createSubscriptionFixture();

    expect(await scheduleOne(organizationId, subscriptionId, 'day1')).toBe('inserted');
    expect(await scheduleOne(organizationId, subscriptionId, 'day1')).toBe('duplicate');

    const counts = await countReminderDeliveriesByStatus(organizationId);
    expect(counts).toEqual({ PENDING: 1 });
  });

  it('lets exactly one of several concurrent claimers take a due reminder', async () => {
    const { organizationId, subscriptionId } = await createSubscriptionFixture();
    await scheduleOne(organizationId, subscriptionId, 'day3');

    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        claimDueReminderDeliveries({ organizationId }),
      ),
    );

    const totalClaimed = results.reduce((sum, rows) => sum + rows.length, 0);
    expect(totalClaimed).toBe(1);
  });

  it('does not claim reminders that are not yet due', async () => {
    const { organizationId, subscriptionId } = await createSubscriptionFixture();
    await scheduleOne(
      organizationId,
      subscriptionId,
      'day6',
      new Date(Date.now() + 60 * 60 * 1000),
    );

    expect(await claimDueReminderDeliveries({ organizationId })).toEqual([]);
  });

  it('reclaims an IN_PROGRESS row after its lease expires', async () => {
    const { organizationId, subscriptionId } = await createSubscriptionFixture();
    await scheduleOne(organizationId, subscriptionId, 'day1');

    const [first] = await claimDueReminderDeliveries({ organizationId });
    expect(first?.attemptCount).toBe(1);

    expect(await claimDueReminderDeliveries({ organizationId })).toEqual([]);

    await getDb().execute(sql`
      UPDATE app.saas_reminder_deliveries
      SET next_attempt_at = now() - interval '1 second'
      WHERE id = ${first!.id}
    `);

    const [reclaimed] = await claimDueReminderDeliveries({ organizationId });
    expect(reclaimed?.id).toBe(first!.id);
    expect(reclaimed?.attemptCount).toBe(2);
  });

  it('schedules a retry that is not claimable until the delay passes', async () => {
    const { organizationId, subscriptionId } = await createSubscriptionFixture();
    await scheduleOne(organizationId, subscriptionId, 'day1');
    const [claimed] = await claimDueReminderDeliveries({ organizationId });

    const retried = await markReminderRetry({
      organizationId,
      deliveryId: claimed!.id,
      errorCode: 'SMTP_TIMEOUT',
      delaySeconds: 3600,
    });
    expect(retried).toBe(true);
    expect(await claimDueReminderDeliveries({ organizationId })).toEqual([]);
    expect(await countReminderDeliveriesByStatus(organizationId)).toEqual({ PENDING: 1 });
  });

  it('marks a delivered reminder SENT and never re-sends or re-marks it', async () => {
    const { organizationId, subscriptionId } = await createSubscriptionFixture();
    await scheduleOne(organizationId, subscriptionId, 'day1');
    const [claimed] = await claimDueReminderDeliveries({ organizationId });

    expect(
      await markReminderSent({ organizationId, deliveryId: claimed!.id }),
    ).toBe(true);
    expect(
      await markReminderSent({ organizationId, deliveryId: claimed!.id }),
    ).toBe(false);
    expect(await claimDueReminderDeliveries({ organizationId })).toEqual([]);
    expect(await countReminderDeliveriesByStatus(organizationId)).toEqual({ SENT: 1 });
  });

  it('marks an exhausted reminder FAILED as a terminal state', async () => {
    const { organizationId, subscriptionId } = await createSubscriptionFixture();
    await scheduleOne(organizationId, subscriptionId, 'day6');
    const [claimed] = await claimDueReminderDeliveries({ organizationId });

    expect(
      await markReminderFailed({
        organizationId,
        deliveryId: claimed!.id,
        errorCode: 'PERMANENT_REJECT',
      }),
    ).toBe(true);
    expect(await claimDueReminderDeliveries({ organizationId })).toEqual([]);
    expect(await countReminderDeliveriesByStatus(organizationId)).toEqual({ FAILED: 1 });
  });

  it('isolates tenants: another org cannot claim or mark a delivery', async () => {
    const owner = await createSubscriptionFixture();
    const other = await createSubscriptionFixture();
    await scheduleOne(owner.organizationId, owner.subscriptionId, 'day1');

    expect(
      await claimDueReminderDeliveries({ organizationId: other.organizationId }),
    ).toEqual([]);

    const [claimed] = await claimDueReminderDeliveries({
      organizationId: owner.organizationId,
    });
    expect(
      await markReminderSent({
        organizationId: other.organizationId,
        deliveryId: claimed!.id,
      }),
    ).toBe(false);
    expect(
      await markReminderSent({
        organizationId: owner.organizationId,
        deliveryId: claimed!.id,
      }),
    ).toBe(true);
  });
});
