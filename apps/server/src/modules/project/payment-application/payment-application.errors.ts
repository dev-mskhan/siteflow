export class PaymentApplicationNotFoundError extends Error {
  statusCode = 404;
  code = 'PAYMENT_APPLICATION_NOT_FOUND';
  constructor() {
    super('Payment application not found.');
  }
}

export class PaymentApplicationConflictError extends Error {
  statusCode = 409;
  code = 'PAYMENT_APPLICATION_CONFLICT';
  constructor(message = 'The payment application cannot transition from its current state.') {
    super(message);
  }
}

export class InvalidPaymentApplicationReferenceError extends Error {
  statusCode = 422;
  code = 'INVALID_PAYMENT_APPLICATION_REFERENCE';
  constructor() {
    super(
      'A payment-application line must reference a line on the approved schedule of values for this project.',
    );
  }
}

export class PaymentApplicationReconciliationError extends Error {
  statusCode = 422;
  code = 'PAYMENT_APPLICATION_RECONCILIATION_ERROR';
  constructor(
    message = 'Payment-application amounts exceed the remaining schedule-of-values line balance.',
  ) {
    super(message);
  }
}
