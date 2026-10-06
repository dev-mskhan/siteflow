import { ConflictError, NotFoundError, ValidationError } from '../../auth/auth.errors.js';

export class CostTransactionNotFoundError extends NotFoundError {
  override code = 'COST_TRANSACTION_NOT_FOUND';

  constructor() {
    super('Cost transaction not found.');
    this.name = 'CostTransactionNotFoundError';
  }
}

export class CostTransactionConflictError extends ConflictError {
  override code = 'COST_TRANSACTION_CONFLICT';

  constructor(message = 'The cost transaction cannot perform this operation in its current state.') {
    super(message);
    this.name = 'CostTransactionConflictError';
  }
}

export class InvalidCostTransactionReferenceError extends ValidationError {
  override code = 'INVALID_COST_TRANSACTION_REFERENCE';

  constructor() {
    super('One or more cost transaction references are invalid for this project.');
    this.name = 'InvalidCostTransactionReferenceError';
  }
}
