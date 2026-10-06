import { describe, expect, it } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  addMoney,
  formatMoney,
  multiplyQuantityByUnitPrice,
  normalizeCurrencyCode,
  parseMoney,
  parseNonNegativeMoney,
} from '../../../src/lib/commercial/money.js';
import {
  InvalidCurrencyCodeError,
  InvalidMoneyValueError,
} from '../../../src/lib/commercial/commercial.errors.js';

describe('commercial money utilities', () => {
  it('normalizes zero and valid positive decimal strings without floating-point arithmetic', () => {
    expect(formatMoney(parseMoney('0'))).toBe('0.00');
    expect(formatMoney(parseMoney('123.4'))).toBe('123.40');
    expect(addMoney('0.10', '0.20')).toBe('0.30');
  });

  it('rounds calculated amounts using decimal half-up rounding', () => {
    expect(formatMoney(new Decimal('1.005'))).toBe('1.01');
    expect(multiplyQuantityByUnitPrice('3', '0.34')).toBe('1.02');
  });

  it('rejects negative values where a non-negative amount is required', () => {
    expect(() => parseNonNegativeMoney('-0.01')).toThrow(InvalidMoneyValueError);
  });

  it('accepts signed decimal strings for deltas but rejects unsupported precision and overflow', () => {
    expect(formatMoney(parseMoney('-25.50'))).toBe('-25.50');
    expect(() => parseMoney('1.005')).toThrow(InvalidMoneyValueError);
    expect(() => parseMoney('10000000000000.00')).toThrow(InvalidMoneyValueError);
  });

  it('normalizes three-letter currency codes and rejects invalid codes', () => {
    expect(normalizeCurrencyCode(' usd ')).toBe('USD');
    expect(() => normalizeCurrencyCode('US')).toThrow(InvalidCurrencyCodeError);
  });
});
