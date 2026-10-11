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

let app: FastifyInstance;

beforeAll(async () => {
  app = await createTestApp();
}, 30_000);

afterAll(async () => {
  await app.close();
}, 30_000);

describe('SaaS Billing — Hosted Checkout (10-12)', () => {
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

describe('SaaS Billing — Restricted Customer Portal (10-13)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function createOrganization() {
    const { user: admin, token } = await createVerifiedUser();
    const { orgId, roleMap } = await createOrgWithAdmin(app, token);
    return { admin, token, orgId, roleMap };
  }

  function mockPortalSession() {
    return vi.spyOn(stripeAdapter, 'createPortalSession').mockResolvedValue({
      id: 'bps_portal_fixture',
      url: 'https://billing.example.test/portal-session',
    });
  }

  it('creates a Portal session using only the authenticated organization customer association', async () => {
    const { token, orgId } = await createOrganization();
    await customerRepository.createOrGet(orgId, 'test', `cus_portal_${orgId}`);
    const createPortalSession = mockPortalSession();
    const createCustomer = vi.spyOn(stripeAdapter, 'createCustomer');

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/portal`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().data.portalUrl).toBe(
      'https://billing.example.test/portal-session',
    );
    expect(createPortalSession).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: `cus_portal_${orgId}`,
        configuration: 'bpc_test_portal',
        return_url: expect.stringContaining(`/billing?organizationId=${orgId}`),
      }),
    );
    expect(createCustomer).not.toHaveBeenCalled();
    expect(response.json().data).not.toHaveProperty('customerId');
  });

  it('rejects unauthenticated Portal requests before any provider session is created', async () => {
    const { orgId } = await createOrganization();
    await customerRepository.createOrGet(orgId, 'test', `cus_portal_${orgId}`);
    const createPortalSession = mockPortalSession();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/portal`,
    });

    expect(response.statusCode).toBe(401);
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it('denies Finance with billing:read but not billing:manage before creating a Portal session', async () => {
    const { orgId, roleMap } = await createOrganization();
    const { user: financeUser, token: financeToken } = await createVerifiedUser();
    await addMemberDirectly(orgId, financeUser.id, roleMap.get('Finance')!);
    await customerRepository.createOrGet(orgId, 'test', `cus_portal_${orgId}`);
    const createPortalSession = mockPortalSession();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/portal`,
      headers: { authorization: `Bearer ${financeToken}` },
    });

    expect(response.statusCode).toBe(403);
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it('denies a caller using another organization identifier before provider access', async () => {
    const owner = await createOrganization();
    const foreign = await createOrganization();
    await customerRepository.createOrGet(
      foreign.orgId,
      'test',
      `cus_portal_${foreign.orgId}`,
    );
    const createPortalSession = mockPortalSession();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${foreign.orgId}/billing/portal`,
      headers: { authorization: `Bearer ${owner.token}` },
    });

    expect(response.statusCode).toBe(403);
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it('does not create a Stripe customer when the organization has no persisted association', async () => {
    const { token, orgId } = await createOrganization();
    const createPortalSession = mockPortalSession();
    const createCustomer = vi.spyOn(stripeAdapter, 'createCustomer');

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/portal`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
    expect(createPortalSession).not.toHaveBeenCalled();
    expect(createCustomer).not.toHaveBeenCalled();
  });

  it('does not use a customer association from the other Stripe mode', async () => {
    const { token, orgId } = await createOrganization();
    await customerRepository.createOrGet(orgId, 'live', `cus_live_portal_${orgId}`);
    const createPortalSession = mockPortalSession();

    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${orgId}/billing/portal`,
      headers: { authorization: `Bearer ${token}` },
    });

    expect(response.statusCode).toBe(404);
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it('rejects a malformed organization identifier before provider access', async () => {
    const createPortalSession = mockPortalSession();

    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/organizations/not-a-uuid/billing/portal',
      headers: { authorization: 'Bearer invalid-but-authentication-is-not-reached' },
    });

    expect(response.statusCode).toBe(422);
    expect(createPortalSession).not.toHaveBeenCalled();
  });

  it('publishes the restricted Portal endpoint and response contract in OpenAPI', async () => {
    const response = await app.inject({ method: 'GET', url: '/docs/json' });

    expect(response.statusCode).toBe(200);
    const specification = response.json();
    const portalPath = Object.keys(specification.paths).find((path) =>
      path.endsWith('/billing/portal'),
    );
    expect(portalPath).toBe('/api/v1/organizations/{organizationId}/billing/portal');
    expect(specification.paths[portalPath!].post.summary).toContain(
      'restricted SaaS Customer Portal',
    );
    expect(
      specification.paths[portalPath!].post.responses['201'].content[
        'application/json'
      ].schema.properties.data.properties.portalUrl,
    ).toMatchObject({ type: 'string', format: 'uri' });
  });
});
