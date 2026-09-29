export class PurchaseOrderNotFoundError extends Error {
  statusCode = 404;
  code = 'PURCHASE_ORDER_NOT_FOUND';
  constructor(id: string) {
    super(`Purchase order not found: ${id}`);
  }
}

export class PurchaseOrderInvalidStateError extends Error {
  statusCode = 422;
  code = 'PURCHASE_ORDER_INVALID_STATE';
  constructor(current: string, action: string) {
    super(`Cannot ${action} a purchase order in status ${current}`);
  }
}

export class PurchaseOrderImmutableFieldError extends Error {
  statusCode = 422;
  code = 'PURCHASE_ORDER_IMMUTABLE_FIELD';
  constructor(field: string) {
    super(`Cannot modify immutable field '${field}' after PO is APPROVED`);
  }
}
