import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import StripeSdk from 'stripe';
import {
  StripeAdapter,
  StripeConfigurationError,
  StripeProviderError,
  StripeWebhookSignatureError,
  validateStripeEnvironment,
  type StripeEnvironment,
  type StripePortalConfigurationSnapshot,
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
      configurations: {
        retrieve: vi
          .fn<StripeSdkClient['billingPortal']['configurations']['retrieve']>()
          .mockResolvedValue({
            id: 'bpc_test_1',
            active: true,
            features: {
              payment_method_update: { enabled: true },
              invoice_history: { enabled: true },
              customer_update: { enabled: false, allowed_updates: [] },
              subscription_update: {
                enabled: false,
                default_allowed_updates: [],
                products: [],
                proration_behavior: 'none',
                schedule_at_period_end: { conditions: [] },
              },
              subscription_cancel: {
                enabled: false,
                cancellation_reason: { enabled: false, options: [] },
                mode: 'at_period_end',
                proration_behavior: 'none',
              },
            },
          }),
      },
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
          items: {
            data: [
              {
                price: { id: 'price_pro_month_v1' },
              },
            ],
          },
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
          items: {
            data: [
              {
                price: { id: 'price_pro_month_v1' },
              },
            ],
          },
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

  it('rejects blank idempotency keys before sending provider mutations', async () => {
    const { client } = createClient();
    const adapter = new StripeAdapter(testEnvironment, () => client);

    await expect(
      adapter.createCustomer(
        { metadata: { organizationId: 'org_test_1' } },
        '  ',
      ),
    ).rejects.toMatchObject({
      code: 'STRIPE_IDEMPOTENCY_KEY_REQUIRED',
    });
    await expect(
      adapter.createCheckoutSession(
        {
          mode: 'subscription',
          line_items: [],
          success_url: 'https://siteflow.example.test/billing/success',
          cancel_url: 'https://siteflow.example.test/billing/cancel',
        },
        '',
      ),
    ).rejects.toMatchObject({
      code: 'STRIPE_IDEMPOTENCY_KEY_REQUIRED',
    });
    await expect(
      adapter.updateSubscription('sub_test_1', { cancel_at_period_end: true }, ' \t'),
    ).rejects.toMatchObject({
      code: 'STRIPE_IDEMPOTENCY_KEY_REQUIRED',
    });
    await expect(
      adapter.createTaxCalculation({ currency: 'usd', line_items: [] }, ' '),
    ).rejects.toMatchObject({
      code: 'STRIPE_IDEMPOTENCY_KEY_REQUIRED',
    });
    expect(client.customers.create).not.toHaveBeenCalled();
    expect(client.checkout.sessions.create).not.toHaveBeenCalled();
    expect(client.subscriptions.update).not.toHaveBeenCalled();
    expect(client.tax.calculations.create).not.toHaveBeenCalled();
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
      configuration: 'bpc_test_1',
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
    expect(client.billingPortal.configurations.retrieve).toHaveBeenCalledWith(
      'bpc_test_1',
    );
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

  it('fails closed before Portal session creation unless the active configuration allows only payment methods and invoices', async () => {
    const { client } = createClient();
    const adapter = new StripeAdapter(testEnvironment, () => client);
    const params: Stripe.BillingPortal.SessionCreateParams = {
      customer: 'cus_test_1',
      configuration: 'bpc_test_1',
      return_url: 'https://siteflow.example.test/billing',
    };

    await adapter.createPortalSession(params);
    expect(client.billingPortal.sessions.create).toHaveBeenCalledWith(params);
    const restrictedConfiguration =
      await client.billingPortal.configurations.retrieve('bpc_test_1');
    vi.mocked(client.billingPortal.configurations.retrieve).mockResolvedValue({
      ...restrictedConfiguration,
      features: {
        ...restrictedConfiguration.features,
        subscription_update: {
          ...restrictedConfiguration.features.subscription_update,
          enabled: true,
        },
      },
    });
    await expect(adapter.createPortalSession(params)).rejects.toMatchObject({
      code: 'STRIPE_CONFIGURATION_ERROR',
    });
    expect(client.billingPortal.sessions.create).toHaveBeenCalledTimes(1);
  });

  it('rejects cancellation, customer updates, disabled payment/invoice features, and unknown Portal features', async () => {
    const { client } = createClient();
    const adapter = new StripeAdapter(testEnvironment, () => client);
    const params: Stripe.BillingPortal.SessionCreateParams = {
      customer: 'cus_test_1',
      configuration: 'bpc_test_1',
      return_url: 'https://siteflow.example.test/billing',
    };
    const configuration =
      await client.billingPortal.configurations.retrieve('bpc_test_1');
    const safeFeatures = configuration.features;
    const unsafeFeatureSets: Array<{
      features: StripePortalConfigurationSnapshot['features'];
    }> = [
      {
        features: {
          ...safeFeatures,
          payment_method_update: { enabled: false },
        },
      },
      {
        features: {
          ...safeFeatures,
          invoice_history: { enabled: false },
        },
      },
      {
        features: {
          ...safeFeatures,
          customer_update: { ...safeFeatures.customer_update, enabled: true },
        },
      },
      {
        features: {
          ...safeFeatures,
          subscription_cancel: {
            ...safeFeatures.subscription_cancel,
            enabled: true,
          },
        },
      },
      {
        features: {
          ...safeFeatures,
          subscription_pause: { enabled: true },
        } as StripePortalConfigurationSnapshot['features'],
      },
    ];

    for (const unsafe of unsafeFeatureSets) {
      vi.mocked(client.billingPortal.configurations.retrieve).mockResolvedValue({
        ...configuration,
        ...unsafe,
      });
      await expect(adapter.createPortalSession(params)).rejects.toMatchObject({
        code: 'STRIPE_CONFIGURATION_ERROR',
      });
    }

    expect(client.billingPortal.sessions.create).not.toHaveBeenCalled();
  });

  it('verifies signed webhook payloads and maps signature failures to a safe error', () => {
    const event: Stripe.Event = {
      id: 'evt_test_1',
      object: 'event',
      api_version: null,
      created: 1_760_000_000,
      data: { object: { id: 'sub_test_1', object: 'subscription' } },
      livemode: false,
      pending_webhooks: 1,
      request: null,
      type: 'customer.subscription.updated',
    };
    const payload = Buffer.from(JSON.stringify(event));
    const secret = 'whsec_test_fixture_only';
    const signature = StripeSdk.webhooks.generateTestHeaderString({
      payload,
      secret,
    });
    const adapter = new StripeAdapter({
      STRIPE_MODE: 'test',
      STRIPE_TEST_WEBHOOK_SECRET: secret,
    });

    expect(adapter.verifyWebhook(payload, signature)).toEqual(event);

    expect(() => adapter.verifyWebhook(Buffer.concat([payload, Buffer.from(' ')]), signature)).toThrow(
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
    const adapter = new StripeAdapter({ STRIPE_MODE: 'test' });

    expect(() =>
      adapter.verifyWebhook(Buffer.from('{}'), 't=1,v1=signature'),
    ).toThrow(StripeWebhookSignatureError);
  });
});
