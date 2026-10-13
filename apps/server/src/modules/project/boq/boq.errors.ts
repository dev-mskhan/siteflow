export class BoqValidationError extends Error {
  readonly statusCode = 422;
  readonly code = 'BOQ_VALIDATION_ERROR';

  constructor(message = 'The BOQ input is invalid.') {
    super(message);
    this.name = 'BoqValidationError';
  }
}

export class BoqNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'BOQ_NOT_FOUND';

  constructor() {
    super('BOQ not found.');
    this.name = 'BoqNotFoundError';
  }
}

export class BoqConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'BOQ_CONFLICT';

  constructor(message = 'The BOQ cannot be changed in its current state.') {
    super(message);
    this.name = 'BoqConflictError';
  }
}

export class BoqVersionConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'BOQ_VERSION_CONFLICT';

  constructor() {
    super('The BOQ has changed. Reload it and retry.');
    this.name = 'BoqVersionConflictError';
  }
}

export class BoqImportRejectedError extends Error {
  readonly statusCode = 422;
  readonly code = 'BOQ_IMPORT_REJECTED';

  constructor(
    readonly errors: Array<{ row: number; column: string | null; message: string }>,
  ) {
    super('The BOQ import file has validation errors. Nothing was imported.');
    this.name = 'BoqImportRejectedError';
  }
}
