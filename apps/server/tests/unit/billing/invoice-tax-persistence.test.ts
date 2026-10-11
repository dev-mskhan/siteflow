import type { DatabaseTransaction } from '../../../src/lib/db/index.js';
import {
  InvoiceService,
  type VerifiedProviderInvoiceFacts,
} from '../../../src/modules/billing/invoice.service.js';
import type { InvoiceRepository } from '../../../src/modules/billing/invoice.repository.js';
import { describe, expect, it, vi } from 'vitest';

function baseFacts(overrides: Partial<VerifiedProviderInvoiceFacts> = {}): VerifiedProviderInvoiceFacts {
  return {
    organizationId: '00000000-0000-4000-8000-000000000001',
    stripeMode: 'test',
    stripeInvoiceId: 'in_fixture_tax_1',
    stripeCustomerId: 'cus_fixture_tax_1',
    stripeSubscriptionId: 'sub_fixture_tax_1',
    invoiceNumber: 'INV-TAX-1',
    status: 'PAID',
    amountDueCents: 10_800,
    amountPaidCents: 10_800,
    currency: 'usd',
    periodStart: new Date('2025-10-01T00:00:00Z'),
    periodEnd: new Date('2025-11-01T00:00:00Z'),
    hostedInvoiceUrl: null,
    invoicePdfUrl: null,
    providerEventCreatedAt: new Date('2025-10-02T00:00:00Z'),
    ...overrides,
  };
}

function fakeService() {
  const upsertProviderInvoice = vi.fn(async (row: Record<string, unknown>) => ({
    invoice: { id: 'inv-row', ...row },
    applied: true,
  }));
  const repo = { upsertProviderInvoice } as unknown as InvoiceRepository;
  return { service: new InvoiceService(repo), upsertProviderInvoice };
}

const tx = {} as DatabaseTransaction;

function persistedRow(upsert: ReturnType<typeof vi.fn>) {
  return upsert.mock.calls[0]![0] as Record<string, unknown>;
}

describe('SaaS invoice Stripe Tax persistence (10-16)', () => {
  it('persists verified Tax facts (amount, currency, calculation id, jurisdiction)', async () => {
    const { service, upsertProviderInvoice } = fakeService();

    await service.synchronizeVerifiedInvoice(
      baseFacts({
        taxFacts: {
          calculationId: 'taxcalc_fixture_1',
          currency: 'usd',
          taxAmountCents: 800,
          jurisdictionCountries: ['US'],
        },
      }),
      tx,
    );

    expect(upsertProviderInvoice).toHaveBeenCalledTimes(1);
    const row = persistedRow(upsertProviderInvoice);
    expect(row).toMatchObject({
      taxCalculationId: 'taxcalc_fixture_1',
      taxAmountCents: 800,
      taxCurrency: 'usd',
      taxJurisdictionCountries: ['US'],
    });
  });

  it('never records optional-disabled or not-calculated Tax as a verified zero', async () => {
    const { service, upsertProviderInvoice } = fakeService();

    await service.synchronizeVerifiedInvoice(baseFacts({ taxFacts: null }), tx);

    const row = persistedRow(upsertProviderInvoice);
    expect(row.taxCalculationId).toBeNull();
    expect(row.taxAmountCents).toBeNull();
    expect(row.taxCurrency).toBeNull();
    expect(row.taxJurisdictionCountries).toBeNull();
  });

  it('treats absent taxFacts the same as not calculated', async () => {
    const { service, upsertProviderInvoice } = fakeService();

    await service.synchronizeVerifiedInvoice(baseFacts(), tx);

    expect(persistedRow(upsertProviderInvoice)).toMatchObject({
      taxCalculationId: null,
      taxAmountCents: null,
      taxCurrency: null,
      taxJurisdictionCountries: null,
    });
  });

  it('rejects tax facts whose currency does not match the invoice currency without writing', async () => {
    const { service, upsertProviderInvoice } = fakeService();

    await expect(
      service.synchronizeVerifiedInvoice(
        baseFacts({
          taxFacts: {
            calculationId: 'taxcalc_fixture_2',
            currency: 'eur',
            taxAmountCents: 800,
            jurisdictionCountries: ['DE'],
          },
        }),
        tx,
      ),
    ).rejects.toThrow('Verified Stripe Tax facts are invalid');
    expect(upsertProviderInvoice).not.toHaveBeenCalled();
  });

  it.each([
    ['empty calculation id', { calculationId: ' ', taxAmountCents: 800, jurisdictionCountries: ['US'] }],
    ['negative tax amount', { calculationId: 'taxcalc_fixture_3', taxAmountCents: -1, jurisdictionCountries: ['US'] }],
    ['non-integer tax amount', { calculationId: 'taxcalc_fixture_3', taxAmountCents: 1.5, jurisdictionCountries: ['US'] }],
    ['empty jurisdiction country', { calculationId: 'taxcalc_fixture_3', taxAmountCents: 800, jurisdictionCountries: [' '] }],
  ])('rejects invalid tax facts (%s) without writing', async (_label, partial) => {
    const { service, upsertProviderInvoice } = fakeService();

    await expect(
      service.synchronizeVerifiedInvoice(
        baseFacts({ taxFacts: { currency: 'usd', ...partial } as never }),
        tx,
      ),
    ).rejects.toThrow('Verified Stripe Tax facts are invalid');
    expect(upsertProviderInvoice).not.toHaveBeenCalled();
  });
});
