export class ChangeOrderNotFoundError extends Error {
  statusCode = 404;
  code = 'CHANGE_ORDER_NOT_FOUND';
  constructor() {
    super('Change order not found.');
  }
}

export class ChangeOrderConflictError extends Error {
  statusCode = 409;
  code = 'CHANGE_ORDER_CONFLICT';
  constructor(message = 'The change order cannot transition from its current state.') {
    super(message);
  }
}

export class InvalidChangeOrderReferenceError extends Error {
  statusCode = 422;
  code = 'INVALID_CHANGE_ORDER_REFERENCE';
  constructor() {
    super('A change-order reference is outside this project, inactive, or unsupported.');
  }
}
