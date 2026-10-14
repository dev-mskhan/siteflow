export class TakeoffValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'TAKEOFF_VALIDATION_ERROR';

  constructor(message = 'The takeoff input is invalid.') {
    super(message);
    this.name = 'TakeoffValidationError';
  }
}

export class TakeoffFormulaError extends Error {
  readonly statusCode = 422;
  readonly code = 'TAKEOFF_FORMULA_ERROR';

  constructor(message = 'The takeoff formula is invalid.') {
    super(message);
    this.name = 'TakeoffFormulaError';
  }
}

export class TakeoffNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'TAKEOFF_NOT_FOUND';

  constructor(message = 'Takeoff record not found.') {
    super(message);
    this.name = 'TakeoffNotFoundError';
  }
}

export class TakeoffConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'TAKEOFF_CONFLICT';

  constructor(message = 'The takeoff cannot be changed in its current state.') {
    super(message);
    this.name = 'TakeoffConflictError';
  }
}

export class TakeoffVersionConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'TAKEOFF_VERSION_CONFLICT';

  constructor() {
    super('The takeoff has changed. Reload it and retry.');
    this.name = 'TakeoffVersionConflictError';
  }
}
