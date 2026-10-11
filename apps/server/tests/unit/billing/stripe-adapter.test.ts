import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import {
  StripeAdapter,
  StripeConfigurationError,
  StripeProviderError,
  StripeWebhookSignatureError,
  validateStripeEnvironment,
  type StripeEnvironment,
  type StripeSdkClient,
} from '../../../src/modules/billing/stripe.adapter.js';

const testEnvironment: StripeEnvironment = {
  STRIPE_MODE: 'test',
  STRIPE_TEST_SECRET_KEY: 'sk_test_fixture_only',
  STRIPE_TEST_WEBHOOK_SECRET: 'whsec_test_fixture_only',
};

function createClient() {
  const event: Stripe.Event = {
    id: 'evt_test_1',
    object: 'event',
    api_version: null,
    created: 1_760_000_000,
    data: { object: { id: 'cus_test_1' } },
    livemode: false,
    pending_webhooks: 1,
    request: null,
    type: 'customer.created',
  };

  const client: StripeSdkClient = {
    customers: {
      create: vi.fn<StripeSdkClient['customers']['create']>().mockResolvedValue({
        id: 'cus_test_1',
      }),
      retrieve: vi.fn<StripeSdkClient['customers']['retrieve']>().mockResolvedValue({
        id: 'cus_test_1',
      }),
    },
    checkout: {
      sessions: {
        create: vi.fn<StripeSdkClient['checkout']['sessions']['create']>().mockResolvedValue({
          id: 'cs_test_1',
          url: 'https://checkout.example.test/session',
        }),
      },
    },
    billingPortal: {
      sessions: {
        create: vi.fn<StripeSdkClient['billingPortal']['sessions']['create']>().mockResolvedValue({
          id: 'bps_test_1',
          url: 'https://billing.example.test/session',
        }),
      },
    },
    subscriptions: {
      retrieve: vi
        .fn<StripeSdkClient['subscriptions']['retrieve']>()
        .mockResolvedValue({
          id: 'sub_test_1',
          status: 'active',
          current_period_start: 1_760_000_000,
          current_period_end: 1_762_592_000,
          cancel_at_period_end: false,
          customer: 'cus_test_1',
        }),
      update: vi
        .fn<StripeSdkClient['subscriptions']['update']>()
        .mockResolvedValue({
          id: 'sub_test_1',
          status: 'active',
          current_period_start: 1_760_000_000,
          current_period_end: 1_762_592_000,
          cancel_at_period_end: true,
          customer: 'cus_test_1',
        }),
    },
    invoices: {
      retrieve: vi.fn<StripeSdkClient['invoices']['retrieve']>().mockResolvedValue({
        id: 'in_test_1',
        customer: 'cus_test_1',
        subscription: 'sub_test_1',
        status: 'paid',
        amount_due: 49900,
        amount_paid: 49900,
        currency: 'usd',
        paid: true,
        period_start: 1_760_000_000,
        period_end: 1_762_592_000,
        hosted_invoice_url: null,
        invoice_pdf: null,
      }),
    },
    tax: {
      calculations: {
        create: vi
          .fn<StripeSdkClient['tax']['calculations']['create']>()
          .mockResolvedValue({
            id: 'taxcalc_test_1',
            amount_total: 49900,
            currency: 'usd',
            tax_breakdown: [],
            expires_at: 1_760_000_300,
          }),
      },
    },
    webhooks: {
      constructEvent: vi
        .fn<StripeSdkClient['webhooks']['constructEvent']>()
        .mockReturnValue(event),
    },
  };

  return { client, event };
}

describe('StripeAdapter', () => {
  it('requires the selected mode key and rejects keys configured for the wrong mode', () => {
    expect(() =>
      validateStripeEnvironment({
        STRIPE_MODE: 'test',
        STRIPE_LIVE_SECRET_KEY: 'sk_live_fixture_only',
      }),
    ).toThrow(StripeConfigurationError);

    expect(() =>
      validateStripeEnvironment({
        STRIPE_MODE: 'live',
        STRIPE_TEST_SECRET_KEY: 'sk_test_fixture_only',
      }),
    ).toThrow(StripeConfigurationError);

    expect(() =>
      validateStripeEnvironment({
        STRIPE_MODE: 'test',
        STRIPE_TEST_SECRET_KEY: 'sk_live_fixture_only',
      }),
    ).toThrow(StripeConfigurationError);
  });

  it('delegates provider operations through the selected client with SDK idempotency options', async () => {
    const { client } = createClient();
    const clientFactory = vi.fn(() => client);
    const adapter = new StripeAdapter(testEnvironment, clientFactory);
    const customerParams: Stripe.CustomerCreateParams = {
      metadata: { organizationId: 'org_test_1' },
    };
    const checkoutParams: Stripe.Checkout.SessionCreateParams = {
      mode: 'subscription',
      line_items: [{ price: 'price_approved_1', quantity: 1 }],
      success_url: 'https://siteflow.example.test/billing/success',
      cancel_url: 'https://siteflow.example.test/billing/cancel',
      customer: 'cus_test_1',
    };
    const portalParams: Stripe.BillingPortal.SessionCreateParams = {
      customer: 'cus_test_1',
      return_url: 'https://siteflow.example.test/billing',
    };
    const taxParams: Stripe.Tax.CalculationCreateParams = {
      currency: 'usd',
      line_items: [],
    };

    await adapter.createCustomer(customerParams, 'customer-idempotency-key');
    await adapter.retrieveCustomer('cus_test_1');
    await adapter.createCheckoutSession(checkoutParams, 'checkout-idempotency-key');
    await adapter.createPortalSession(portalParams);
    await adapter.retrieveSubscription('sub_test_1');
    await adapter.updateSubscription(
      'sub_test_1',
      { cancel_at_period_end: true },
      'subscription-idempotency-key',
    );
    await adapter.retrieveInvoice('in_test_1');
    await adapter.createTaxCalculation(taxParams, 'tax-idempotency-key');

    expect(client.customers.create).toHaveBeenCalledWith(customerParams, {
      idempotencyKey: 'customer-idempotency-key',
    });
    expect(client.checkout.sessions.create).toHaveBeenCalledWith(checkoutParams, {
      idempotencyKey: 'checkout-idempotency-key',
    });
    expect(client.billingPortal.sessions.create).toHaveBeenCalledWith(portalParams);
    expect(client.subscriptions.update).toHaveBeenCalledWith(
      'sub_test_1',
      { cancel_at_period_end: true },
      { idempotencyKey: 'subscription-idempotency-key' },
    );
    expect(client.tax.calculations.create).toHaveBeenCalledWith(taxParams, {
      idempotencyKey: 'tax-idempotency-key',
    });
    expect(clientFactory).toHaveBeenCalledTimes(1);
  });

  it('verifies signed webhook payloads and maps signature failures to a safe error', () => {
    const { client, event } = createClient();
    const adapter = new StripeAdapter(testEnvironment, () => client);
    const payload = Buffer.from('{"id":"evt_test_1"}');

    expect(adapter.verifyWebhook(payload, 't=1,v1=signature')).toBe(event);
    expect(client.webhooks.constructEvent).toHaveBeenCalledWith(
      payload,
      't=1,v1=signature',
      expect.stringMatching(/^whsec_test_/),
    );

    vi.mocked(client.webhooks.constructEvent).mockImplementation(() => {
      throw new Error('provider signature detail');
    });
    expect(() => adapter.verifyWebhook(payload, 'invalid')).toThrow(
      StripeWebhookSignatureError,
    );
    expect(() => adapter.verifyWebhook(payload, 'invalid')).toThrow(
      'Stripe webhook signature is invalid',
    );
  });

  it('does not expose provider failure details to callers', async () => {
    const { client } = createClient();
    vi.mocked(client.customers.create).mockRejectedValue(
      new Error('internal provider response detail'),
    );
    const adapter = new StripeAdapter(testEnvironment, () => client);

    await expect(
      adapter.createCustomer({ metadata: { organizationId: 'org_test_1' } }, 'customer-key'),
    ).rejects.toMatchObject({
      name: StripeProviderError.name,
      code: 'STRIPE_PROVIDER_ERROR',
      message: 'Stripe provider request failed',
    });
  });

  it('requires a webhook secret for signature verification', () => {
    const { client } = createClient();
    const adapter = new StripeAdapter(
      { STRIPE_MODE: 'test', STRIPE_TEST_SECRET_KEY: 'sk_test_fixture_only' },
      () => client,
    );

    expect(() =>
      adapter.verifyWebhook(Buffer.from('{}'), 't=1,v1=signature'),
    ).toThrow(StripeWebhookSignatureError);
  });
});
