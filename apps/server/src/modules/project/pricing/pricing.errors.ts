export class PricingValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'PRICING_VALIDATION_ERROR';

  constructor(message = 'The pricing input is invalid.') {
    super(message);
    this.name = 'PricingValidationError';
  }
}

export class PricingNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'PRICING_NOT_FOUND';

  constructor(message = 'Pricing record not found.') {
    super(message);
    this.name = 'PricingNotFoundError';
  }
}

export class PricingConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'PRICING_CONFLICT';

  constructor(message = 'The rate version cannot be changed in its current state.') {
    super(message);
    this.name = 'PricingConflictError';
  }
}
