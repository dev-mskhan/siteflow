import {
  ConflictError,
  ForbiddenError,
  ValidationError,
} from '../../modules/auth/auth.errors.js';

export class InvalidMoneyValueError extends ValidationError {
  override code = 'COMMERCIAL_INVALID_MONEY';

  constructor() {
    super(
      'Money value must be a decimal string with at most two fractional digits and fit numeric(15,2).',
    );
    this.name = 'InvalidMoneyValueError';
  }
}

export class InvalidCurrencyCodeError extends ValidationError {
  override code = 'COMMERCIAL_INVALID_CURRENCY';

  constructor() {
    super('Currency code must be a three-letter code.');
    this.name = 'InvalidCurrencyCodeError';
  }
}

export class CommercialVersionConflictError extends ConflictError {
  override code = 'COMMERCIAL_VERSION_CONFLICT';

  constructor() {
    super('The commercial record has changed. Reload and retry.');
    this.name = 'CommercialVersionConflictError';
  }
}

export class FinancialSegregationOfDutiesError extends ForbiddenError {
  override code = 'FINANCIAL_SOD_VIOLATION';

  constructor() {
    super('A different authorized user must perform this financial action.');
    this.name = 'FinancialSegregationOfDutiesError';
  }
}

export class InvalidFinancialActorContextError extends ValidationError {
  override code = 'INVALID_FINANCIAL_ACTOR_CONTEXT';

  constructor() {
    super('Financial actor and scope identifiers are required.');
    this.name = 'InvalidFinancialActorContextError';
  }
}

export class IdempotencyKeyPayloadMismatchError extends ConflictError {
  override code = 'IDEMPOTENCY_KEY_REUSED';

  constructor() {
    super('This idempotency key was already used for a different request.');
    this.name = 'IdempotencyKeyPayloadMismatchError';
  }
}

export class InvalidIdempotencyRequestError extends ValidationError {
  override code = 'INVALID_IDEMPOTENCY_REQUEST';

  constructor() {
    super('A valid idempotency key, organization, and operation are required.');
    this.name = 'InvalidIdempotencyRequestError';
  }
}

export class InvalidFinancialAuditEventError extends ValidationError {
  override code = 'INVALID_FINANCIAL_AUDIT_EVENT';

  constructor() {
    super('Financial audit event identity and scope fields are required.');
    this.name = 'InvalidFinancialAuditEventError';
  }
}

export class IncompleteIdempotencyRecordError extends Error {
  readonly code = 'IDEMPOTENCY_RECORD_INCOMPLETE';

  constructor() {
    super('The idempotency record is incomplete.');
    this.name = 'IncompleteIdempotencyRecordError';
  }
}
