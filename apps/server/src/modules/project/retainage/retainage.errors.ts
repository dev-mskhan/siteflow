export class RetainageNotFoundError extends Error {
  statusCode = 404;
  code = 'RETAINAGE_NOT_FOUND';

  constructor() {
    super('The retainage record or source was not found.');
  }
}

export class RetainageConflictError extends Error {
  statusCode = 409;
  code = 'RETAINAGE_CONFLICT';

  constructor(message = 'The retainage operation conflicts with its current state.') {
    super(message);
  }
}

export class RetainageBalanceError extends Error {
  statusCode = 422;
  code = 'RETAINAGE_BALANCE_EXCEEDED';

  constructor(message = 'The release exceeds the remaining held retainage.') {
    super(message);
  }
}

export class RetainageSourceError extends Error {
  statusCode = 422;
  code = 'RETAINAGE_SOURCE_INVALID';

  constructor(message = 'Retainage can only be accrued from an approved payment application.') {
    super(message);
  }
}
