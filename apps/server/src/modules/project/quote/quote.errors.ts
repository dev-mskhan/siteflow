export class QuoteNotFoundError extends Error {
  statusCode = 404;
  code = 'QUOTE_NOT_FOUND';
  constructor(id: string) {
    super(`Quote not found: ${id}`);
  }
}
export class QuoteInvalidStateError extends Error {
  statusCode = 422;
  code = 'QUOTE_INVALID_STATE';
  constructor(current: string, action: string) {
    super(`Cannot ${action} a quote in status ${current}`);
  }
}
export class QuoteExpiredError extends Error {
  statusCode = 422;
  code = 'QUOTE_EXPIRED';
  constructor() {
    super('Quote has expired and cannot be accepted');
  }
}
export class QuoteAlreadyAcceptedForRequestError extends Error {
  statusCode = 409;
  code = 'QUOTE_ALREADY_ACCEPTED_FOR_REQUEST';
  constructor() {
    super('Another quote for this material request is already accepted');
  }
}
