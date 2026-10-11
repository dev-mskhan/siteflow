import type { StripeTaxCalculationSnapshot } from './stripe.adapter.js';

export interface TaxAccountState {
  required: boolean;
  enabled: boolean;
  configured: boolean;
  jurisdictionSupported: boolean;
}

export type TaxPolicyFailureCode =
  | 'TAX_CONFIGURATION_UNAVAILABLE'
  | 'TAX_JURISDICTION_UNSUPPORTED';

export type TaxPolicyDecision =
  | { branch: 'CALCULATE' }
  | { branch: 'NOT_CALCULATED' }
  | { branch: 'FAIL'; code: TaxPolicyFailureCode };

export interface VerifiedTaxFacts {
  calculationId: string;
  currency: string;
  taxAmountCents: number;
  jurisdictionCountries: string[];
}

export class TaxPolicyError extends Error {
  constructor(
    readonly code: TaxPolicyFailureCode,
    message: string,
  ) {
    super(message);
    this.name = 'TaxPolicyError';
  }
}

export class TaxFactVerificationError extends Error {
  readonly code = 'TAX_FACTS_UNVERIFIED';

  constructor() {
    super('Stripe Tax calculation facts could not be verified');
    this.name = 'TaxFactVerificationError';
  }
}

export function decideTaxBranch(state: TaxAccountState): TaxPolicyDecision {
  if (!state.enabled || !state.configured) {
    return state.required
      ? { branch: 'FAIL', code: 'TAX_CONFIGURATION_UNAVAILABLE' }
      : { branch: 'NOT_CALCULATED' };
  }
  if (!state.jurisdictionSupported) {
    return state.required
      ? { branch: 'FAIL', code: 'TAX_JURISDICTION_UNSUPPORTED' }
      : { branch: 'NOT_CALCULATED' };
  }
  return { branch: 'CALCULATE' };
}

export function assertTaxBranchAllowsCalculation(decision: TaxPolicyDecision): void {
  if (decision.branch === 'FAIL') {
    throw new TaxPolicyError(
      decision.code,
      decision.code === 'TAX_CONFIGURATION_UNAVAILABLE'
        ? 'Required Stripe Tax is not enabled or configured'
        : 'Required Stripe Tax is unsupported for the customer jurisdiction',
    );
  }
}

export function verifyTaxCalculationFacts(
  calculation: StripeTaxCalculationSnapshot,
  expected: { currency: string; now: Date },
): VerifiedTaxFacts {
  const taxAmountCents =
    calculation.tax_amount_exclusive + calculation.tax_amount_inclusive;
  const countries = calculation.tax_breakdown.map(
    (entry) => entry.tax_rate_details.country as string,
  );

  const expiresAtSeconds = calculation.expires_at;
  const notExpired =
    expiresAtSeconds === null ||
    expiresAtSeconds * 1000 > expected.now.getTime();

  if (
    typeof calculation.id !== 'string' ||
    calculation.id.trim() === '' ||
    calculation.currency !== expected.currency ||
    !Number.isSafeInteger(calculation.tax_amount_exclusive) ||
    !Number.isSafeInteger(calculation.tax_amount_inclusive) ||
    calculation.tax_amount_exclusive < 0 ||
    calculation.tax_amount_inclusive < 0 ||
    !notExpired ||
    (taxAmountCents > 0 && countries.length === 0) ||
    countries.some((country) => typeof country !== 'string' || country.trim() === '')
  ) {
    throw new TaxFactVerificationError();
  }

  return {
    calculationId: calculation.id,
    currency: calculation.currency,
    taxAmountCents,
    jurisdictionCountries: countries,
  };
}
