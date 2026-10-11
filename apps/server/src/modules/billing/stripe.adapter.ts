import Stripe from 'stripe';
import { serverEnv } from '@siteflow/env/server';

export interface StripeEnvironment {
  STRIPE_MODE: 'test' | 'live';
  STRIPE_TEST_SECRET_KEY?: string;
  STRIPE_LIVE_SECRET_KEY?: string;
  STRIPE_PORTAL_CONFIGURATION_ID?: string;
  STRIPE_TEST_WEBHOOK_SECRET?: string;
  STRIPE_LIVE_WEBHOOK_SECRET?: string;
}

export type StripeCustomerRef = Pick<Stripe.Customer, 'id'>;
export type StripeDeletedCustomerRef = Pick<Stripe.DeletedCustomer, 'id' | 'deleted'>;
export type StripeCheckoutSessionRef = Pick<Stripe.Checkout.Session, 'id' | 'url'>;
export type StripePortalSessionRef = Pick<Stripe.BillingPortal.Session, 'id' | 'url'>;
export type StripePortalConfigurationSnapshot = Pick<
  Stripe.BillingPortal.Configuration,
  'id' | 'active' | 'features'
>;
export type StripeSubscriptionSnapshot = Pick<
  Stripe.Subscription,
  | 'id'
  | 'status'
  | 'current_period_start'
  | 'current_period_end'
  | 'cancel_at_period_end'
  | 'customer'
  | 'items'
>;
export type StripeInvoiceSnapshot = Pick<
  Stripe.Invoice,
  | 'id'
  | 'customer'
  | 'subscription'
  | 'status'
  | 'amount_due'
  | 'amount_paid'
  | 'currency'
  | 'paid'
  | 'period_start'
  | 'period_end'
  | 'hosted_invoice_url'
  | 'invoice_pdf'
>;
export type StripeTaxCalculationSnapshot = Pick<
  Stripe.Tax.Calculation,
  'id' | 'amount_total' | 'currency' | 'tax_breakdown' | 'expires_at'
>;

export interface StripeSdkClient {
  customers: {
    create(
      params: Stripe.CustomerCreateParams,
      options: Stripe.RequestOptions,
    ): Promise<StripeCustomerRef>;
    retrieve(
      id: string,
    ): Promise<StripeCustomerRef | StripeDeletedCustomerRef>;
  };
  checkout: {
    sessions: {
      create(
        params: Stripe.Checkout.SessionCreateParams,
        options: Stripe.RequestOptions,
      ): Promise<StripeCheckoutSessionRef>;
    };
  };
  billingPortal: {
    configurations: {
      retrieve(id: string): Promise<StripePortalConfigurationSnapshot>;
    };
    sessions: {
      create(
        params: Stripe.BillingPortal.SessionCreateParams,
        options?: Stripe.RequestOptions,
      ): Promise<StripePortalSessionRef>;
    };
  };
  subscriptions: {
    retrieve(id: string): Promise<StripeSubscriptionSnapshot>;
    update(
      id: string,
      params: Stripe.SubscriptionUpdateParams,
      options: Stripe.RequestOptions,
    ): Promise<StripeSubscriptionSnapshot>;
  };
  invoices: {
    retrieve(id: string): Promise<StripeInvoiceSnapshot>;
  };
  tax: {
    calculations: {
      create(
        params: Stripe.Tax.CalculationCreateParams,
        options: Stripe.RequestOptions,
      ): Promise<StripeTaxCalculationSnapshot>;
    };
  };
  webhooks: {
    constructEvent(payload: string | Buffer, signature: string, secret: string): Stripe.Event;
  };
}

export type StripeClientFactory = (secretKey: string) => StripeSdkClient;

export class StripeConfigurationError extends Error {
  readonly code = 'STRIPE_CONFIGURATION_ERROR';

  constructor() {
    super('Stripe is not configured for the selected mode');
    this.name = 'StripeConfigurationError';
  }
}

export class StripeProviderError extends Error {
  readonly code = 'STRIPE_PROVIDER_ERROR';

  constructor() {
    super('Stripe provider request failed');
    this.name = 'StripeProviderError';
  }
}

export class StripeIdempotencyKeyError extends Error {
  readonly code = 'STRIPE_IDEMPOTENCY_KEY_REQUIRED';

  constructor() {
    super('A Stripe idempotency key is required');
    this.name = 'StripeIdempotencyKeyError';
  }
}

export class StripeWebhookSignatureError extends Error {
  readonly code = 'STRIPE_WEBHOOK_SIGNATURE_INVALID';

  constructor() {
    super('Stripe webhook signature is invalid');
    this.name = 'StripeWebhookSignatureError';
  }
}

export function validateStripeEnvironment(environment: StripeEnvironment): void {
  const configuredKeys = [
    [environment.STRIPE_TEST_SECRET_KEY, 'sk_test_'],
    [environment.STRIPE_LIVE_SECRET_KEY, 'sk_live_'],
  ] as const;

  if (
    configuredKeys.some(
      ([key, prefix]) => key !== undefined && !key.startsWith(prefix),
    )
  ) {
    throw new StripeConfigurationError();
  }

  const apiKey =
    environment.STRIPE_MODE === 'test'
      ? environment.STRIPE_TEST_SECRET_KEY
      : environment.STRIPE_LIVE_SECRET_KEY;

  if (!apiKey) {
    throw new StripeConfigurationError();
  }
}

interface ResolvedStripeEnvironment {
  mode: 'test' | 'live';
  secretKey: string;
  webhookSecret?: string;
}

function resolveStripeEnvironment(
  environment: StripeEnvironment,
): ResolvedStripeEnvironment {
  validateStripeEnvironment(environment);

  return environment.STRIPE_MODE === 'test'
    ? {
        mode: 'test',
        secretKey: environment.STRIPE_TEST_SECRET_KEY!,
        webhookSecret: environment.STRIPE_TEST_WEBHOOK_SECRET,
      }
    : {
        mode: 'live',
        secretKey: environment.STRIPE_LIVE_SECRET_KEY!,
        webhookSecret: environment.STRIPE_LIVE_WEBHOOK_SECRET,
      };
}

const createStripeClient: StripeClientFactory = (secretKey) =>
  new Stripe(secretKey, {
    maxNetworkRetries: 2,
    timeout: 20_000,
    appInfo: { name: 'SiteFlow' },
  });

export class StripeAdapter {
  private resolvedEnvironment: ResolvedStripeEnvironment | undefined;
  private client: StripeSdkClient | undefined;

  constructor(
    private readonly environment: StripeEnvironment = serverEnv,
    private readonly clientFactory: StripeClientFactory = createStripeClient,
  ) {}

  private getConfiguredClient(): {
    client: StripeSdkClient;
    environment: ResolvedStripeEnvironment;
  } {
    this.resolvedEnvironment ??= resolveStripeEnvironment(this.environment);
    this.client ??= this.clientFactory(this.resolvedEnvironment.secretKey);
    return { client: this.client, environment: this.resolvedEnvironment };
  }

  private async providerRequest<T>(request: () => Promise<T>): Promise<T> {
    try {
      return await request();
    } catch {
      throw new StripeProviderError();
    }
  }

  private requireIdempotencyKey(idempotencyKey: string): void {
    if (!idempotencyKey.trim()) {
      throw new StripeIdempotencyKeyError();
    }
  }

  async createCustomer(
    params: Stripe.CustomerCreateParams,
    idempotencyKey: string,
  ): Promise<StripeCustomerRef> {
    this.requireIdempotencyKey(idempotencyKey);
    const { client } = this.getConfiguredClient();
    return this.providerRequest(() =>
      client.customers.create(params, { idempotencyKey }),
    );
  }

  async retrieveCustomer(
    customerId: string,
  ): Promise<StripeCustomerRef | StripeDeletedCustomerRef> {
    const { client } = this.getConfiguredClient();
    return this.providerRequest(() => client.customers.retrieve(customerId));
  }

  async createCheckoutSession(
    params: Stripe.Checkout.SessionCreateParams,
    idempotencyKey: string,
  ): Promise<StripeCheckoutSessionRef> {
    this.requireIdempotencyKey(idempotencyKey);
    const { client } = this.getConfiguredClient();
    return this.providerRequest(() =>
      client.checkout.sessions.create(params, { idempotencyKey }),
    );
  }

  async createPortalSession(
    params: Stripe.BillingPortal.SessionCreateParams,
  ): Promise<StripePortalSessionRef> {
    const configurationId = params.configuration;
    if (!configurationId) {
      throw new StripeConfigurationError();
    }

    const { client } = this.getConfiguredClient();
    const configuration = await this.providerRequest(() =>
      client.billingPortal.configurations.retrieve(configurationId),
    );
    const { features } = configuration;
    const supportedFeatures = [
      'customer_update',
      'invoice_history',
      'payment_method_update',
      'subscription_cancel',
      'subscription_update',
    ];
    if (
      Object.keys(features).length !== supportedFeatures.length ||
      supportedFeatures.some((feature) => !(feature in features)) ||
      !configuration.active ||
      features.payment_method_update.enabled !== true ||
      features.invoice_history.enabled !== true ||
      features.customer_update.enabled !== false ||
      features.subscription_update.enabled !== false ||
      features.subscription_cancel.enabled !== false
    ) {
      throw new StripeConfigurationError();
    }

    return this.providerRequest(() => client.billingPortal.sessions.create(params));
  }

  async retrieveSubscription(
    subscriptionId: string,
  ): Promise<StripeSubscriptionSnapshot> {
    const { client } = this.getConfiguredClient();
    return this.providerRequest(() => client.subscriptions.retrieve(subscriptionId));
  }

  async updateSubscription(
    subscriptionId: string,
    params: Stripe.SubscriptionUpdateParams,
    idempotencyKey: string,
  ): Promise<StripeSubscriptionSnapshot> {
    this.requireIdempotencyKey(idempotencyKey);
    const { client } = this.getConfiguredClient();
    return this.providerRequest(() =>
      client.subscriptions.update(subscriptionId, params, { idempotencyKey }),
    );
  }

  async retrieveInvoice(invoiceId: string): Promise<StripeInvoiceSnapshot> {
    const { client } = this.getConfiguredClient();
    return this.providerRequest(() => client.invoices.retrieve(invoiceId));
  }

  async createTaxCalculation(
    params: Stripe.Tax.CalculationCreateParams,
    idempotencyKey: string,
  ): Promise<StripeTaxCalculationSnapshot> {
    this.requireIdempotencyKey(idempotencyKey);
    const { client } = this.getConfiguredClient();
    return this.providerRequest(() =>
      client.tax.calculations.create(params, { idempotencyKey }),
    );
  }

  verifyWebhook(
    payload: string | Buffer,
    signature: string,
  ): Stripe.Event {
    const webhookSecret =
      this.environment.STRIPE_MODE === 'test'
        ? this.environment.STRIPE_TEST_WEBHOOK_SECRET
        : this.environment.STRIPE_LIVE_WEBHOOK_SECRET;
    if (
      !webhookSecret?.startsWith('whsec_') ||
      !signature.trim()
    ) {
      throw new StripeWebhookSignatureError();
    }

    try {
      return Stripe.webhooks.constructEvent(
        payload,
        signature,
        webhookSecret,
      );
    } catch {
      throw new StripeWebhookSignatureError();
    }
  }
}

export const stripeAdapter = new StripeAdapter();
