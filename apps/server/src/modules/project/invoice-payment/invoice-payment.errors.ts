export class InvoicePaymentNotFoundError extends Error {
  statusCode = 404;
  code = 'INVOICE_PAYMENT_NOT_FOUND';
  constructor(message = 'The requested invoice or payment was not found.') {
    super(message);
  }
}

export class InvoicePaymentConflictError extends Error {
  statusCode = 409;
  code = 'INVOICE_PAYMENT_CONFLICT';
  constructor(message = 'The invoice or payment cannot transition from its current state.') {
    super(message);
  }
}

export class InvoicePaymentReferenceError extends Error {
  statusCode = 422;
  code = 'INVOICE_PAYMENT_REFERENCE_INVALID';
  constructor(message = 'The financial source is invalid for this project.') {
    super(message);
  }
}

export class InvoicePaymentBalanceError extends Error {
  statusCode = 422;
  code = 'INVOICE_PAYMENT_BALANCE_EXCEEDED';
  constructor(message = 'The operation exceeds the approved source or outstanding balance.') {
    super(message);
  }
}
