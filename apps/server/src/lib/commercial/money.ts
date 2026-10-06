import { Decimal } from 'decimal.js';
import { InvalidCurrencyCodeError, InvalidMoneyValueError } from './commercial.errors.js';

export const MONEY_SCALE = 2;
export const MONEY_ROUNDING = Decimal.ROUND_HALF_UP;
export const MAX_MONEY_VALUE = '9999999999999.99';

const MONEY_PATTERN = /^-?\d{1,13}(?:\.\d{1,2})?$/;
const QUANTITY_PATTERN = /^-?\d{1,12}(?:\.\d{1,3})?$/;

export function parseMoney(value: string): Decimal {
  if (!MONEY_PATTERN.test(value)) {
    throw new InvalidMoneyValueError();
  }

  const parsed = new Decimal(value);
  if (parsed.abs().gt(MAX_MONEY_VALUE)) {
    throw new InvalidMoneyValueError();
  }
  return parsed;
}

export function parseNonNegativeMoney(value: string): Decimal {
  const parsed = parseMoney(value);
  if (parsed.isNegative()) {
    throw new InvalidMoneyValueError();
  }
  return parsed;
}

export function formatMoney(value: Decimal): string {
  if (!value.isFinite()) {
    throw new InvalidMoneyValueError();
  }
  const rounded = value.toDecimalPlaces(MONEY_SCALE, MONEY_ROUNDING);
  if (rounded.abs().gt(MAX_MONEY_VALUE)) {
    throw new InvalidMoneyValueError();
  }
  return rounded.toFixed(MONEY_SCALE);
}

export function addMoney(...values: string[]): string {
  return formatMoney(
    values.reduce((total, value) => total.plus(parseMoney(value)), new Decimal(0)),
  );
}

export function multiplyQuantityByUnitPrice(quantity: string, unitPrice: string): string {
  if (!QUANTITY_PATTERN.test(quantity)) {
    throw new InvalidMoneyValueError();
  }
  return formatMoney(new Decimal(quantity).mul(parseMoney(unitPrice)));
}

export function normalizeCurrencyCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalized)) {
    throw new InvalidCurrencyCodeError();
  }
  return normalized;
}
