export class EstimateValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'ESTIMATE_VALIDATION_ERROR';

  constructor(message = 'The estimate input is invalid.') {
    super(message);
    this.name = 'EstimateValidationError';
  }
}

export class EstimateNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'ESTIMATE_NOT_FOUND';

  constructor() {
    super('Estimate not found.');
    this.name = 'EstimateNotFoundError';
  }
}

export class EstimateConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'ESTIMATE_CONFLICT';

  constructor(message = 'The estimate cannot be changed in its current state.') {
    super(message);
    this.name = 'EstimateConflictError';
  }
}

export class EstimateVersionConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'ESTIMATE_VERSION_CONFLICT';

  constructor() {
    super('The estimate has changed. Reload it and retry.');
    this.name = 'EstimateVersionConflictError';
  }
}
