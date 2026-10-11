import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../../helpers/test-app.js';
import {
  addMemberDirectly,
  createOrgWithAdmin,
  createVerifiedUser,
} from '../../helpers/fixtures.js';
import { catalogRepository } from '../../../src/modules/billing/catalog.repository.js';
import { customerRepository } from '../../../src/modules/billing/customer.repository.js';
import { stripeAdapter } from '../../../src/modules/billing/stripe.adapter.js';

describe('SaaS Billing — Hosted Checkout (10-12)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await createTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createOrganization() {
    const { user: admin, token } = await createVerifiedUser();
    const { orgId, roleMap } = await createOrgWithAdmin(app, token);
    return { admin, token, orgId, roleMap };
  }

  function mockStripe(customerId = 'cus_checkout_fixture') {
    const createCustomer = vi
      .spyOn(stripeAdapter, 'createCustomer')
      .mockResolvedValue({ id: customerId });
    const createCheckoutSession = vi
      .spyOn(stripeAdapter, 'createCheckoutSession')
      .mockResolvedValue({
        id: 'cs_checkout_fixture',
        url: 'https://checkout.example.test/session',
      });
    return { createCustomer, createCheckoutSession };
  }

  it('creates a hosted session from the approved catalog and reuses the customer association on retry', async () => {
    const { admin, token, orgId } = await createOrganization();
    const stripe = mockStripe(`cus_checkout_${orgId}`);
    const headers = {
      authorization: `Bearer ${token}`,
      'idempotency-key': 'checkout-request-1',
    };

    const first = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/checkout`,
      headers,
      payload: { planId: 'professional', interval: 'month' },
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().data.checkoutUrl).toBe('https://checkout.example.test/session');

    const second = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/checkout`,
      headers,
      payload: { planId: 'professional', interval: 'month' },
    });
    expect(second.statusCode).toBe(201);

    expect(stripe.createCustomer).toHaveBeenCalledTimes(1);
    expect(stripe.createCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        email: admin.email,
        metadata: { organizationId: orgId, stripeMode: 'test' },
      }),
      `saas-customer:test:${orgId}`,
    );
    expect(stripe.createCheckoutSession).toHaveBeenCalledTimes(2);
    const [sessionParams, providerKey] = stripe.createCheckoutSession.mock.calls[0]!;
    expect(sessionParams).toMatchObject({
      mode: 'subscription',
      customer:       `cus_checkout_${orgId}`,
      client_reference_id: orgId,
      line_items: [{ price: 'price_pro_month_v1', quantity: 1 }],
      metadata: {
        organizationId: orgId,
        planId: 'professional',
        priceVersionId: 'pro_month_v1',
      },
    });
    expect(sessionParams.success_url).toContain('/billing/checkout/success');
    expect(sessionParams.success_url).toContain(`organizationId=${orgId}`);
    expect(providerKey).toBe(
      `saas-checkout:${orgId}:pro_month_v1:checkout-request-1`,
    );
    expect(stripe.createCheckoutSession.mock.calls[1]![1]).toBe(providerKey);

    const association = await customerRepository.findByOrganization(orgId, 'test');
    expect(association?.stripeCustomerId).toBe(`cus_checkout_${orgId}`);
    const currentSubscription = await catalogRepository.findCurrentSubscription(orgId);
    expect(currentSubscription).toBeNull();
  });

  it('rejects unauthenticated requests before any Stripe mutation', async () => {
    const { orgId } = await createOrganization();
    const stripe = mockStripe();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/checkout`,
      headers: { 'idempotency-key': 'unauthenticated-request' },
      payload: { planId: 'starter', interval: 'month' },
    });

    expect(response.statusCode).toBe(401);
    expect(stripe.createCustomer).not.toHaveBeenCalled();
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('denies organization members without billing:manage before any Stripe mutation', async () => {
    const { orgId, roleMap } = await createOrganization();
    const { user: member, token: memberToken } = await createVerifiedUser();
    await addMemberDirectly(orgId, member.id, roleMap.get('Client')!);
    const stripe = mockStripe();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/checkout`,
      headers: {
        authorization: `Bearer ${memberToken}`,
        'idempotency-key': 'unauthorized-role',
      },
      payload: { planId: 'starter', interval: 'month' },
    });

    expect(response.statusCode).toBe(403);
    expect(stripe.createCustomer).not.toHaveBeenCalled();
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('denies foreign-organization identifiers before provider mutation', async () => {
    const owner = await createOrganization();
    const foreign = await createOrganization();
    const stripe = mockStripe();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${foreign.orgId}/billing/checkout`,
      headers: {
        authorization: `Bearer ${owner.token}`,
        'idempotency-key': 'foreign-organization',
      },
      payload: { planId: 'starter', interval: 'month' },
    });

    expect(response.statusCode).toBe(403);
    expect(stripe.createCustomer).not.toHaveBeenCalled();
    expect(stripe.createCheckoutSession).not.toHaveBeenCalled();
  });

  it('ignores caller-supplied provider price, currency, tenant, and redirect overrides', async () => {
    const { token, orgId } = await createOrganization();
    const stripe = mockStripe(`cus_checkout_${orgId}`);

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/checkout`,
      headers: {
        authorization: `Bearer ${token}`,
        'idempotency-key': 'tampered-checkout',
      },
      payload: {
        planId: 'starter',
        interval: 'month',
        stripePriceId: 'price_attacker',
        currency: 'eur',
        customerId: 'cus_other_tenant',
        organizationId: 'foreign-organization',
        successUrl: 'https://attacker.example.test/success',
      },
    });

    expect(response.statusCode).toBe(201);
    expect(stripe.createCheckoutSession).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: [{ price: 'price_starter_month_v1', quantity: 1 }],
        client_reference_id: orgId,
        success_url: expect.stringContaining('/billing/checkout/success'),
      }),
      expect.any(String),
    );
  });
});
