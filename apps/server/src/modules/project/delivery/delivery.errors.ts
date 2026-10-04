export class DeliveryNotFoundError extends Error {
  statusCode = 404; code = 'DELIVERY_NOT_FOUND';
  constructor(id: string) { super(`Delivery not found: ${id}`); }
}
export class DeliveryInvalidStateError extends Error {
  statusCode = 422; code = 'DELIVERY_INVALID_STATE';
  constructor(status: string, action: string) { super(`Cannot ${action} delivery in status ${status}`); }
}
export class DeliveryResourceOwnershipError extends Error {
  statusCode = 422; code = 'DELIVERY_RESOURCE_OWNERSHIP';
  constructor() { super('Purchase order and item must belong to this project and organization'); }
}
export class ReceiptNotFoundError extends Error {
  statusCode = 404; code = 'RECEIPT_NOT_FOUND';
  constructor(id: string) { super(`Receipt not found: ${id}`); }
}
export class ReceiptInvalidStateError extends Error {
  statusCode = 422; code = 'RECEIPT_INVALID_STATE';
  constructor(status: string, action: string) { super(`Cannot ${action} receipt in status ${status}`); }
}
export class DeliveryQuantityExceedsPoError extends Error {
  statusCode = 422; code = 'DELIVERY_QUANTITY_EXCEEDS_PO';
  constructor() { super('Total delivered quantity would exceed PO item quantity'); }
}
export class ReceiptQuantityInvariantError extends Error {
  statusCode = 422; code = 'RECEIPT_QUANTITY_INVARIANT';
  constructor() { super('quantityAccepted + quantityRejected must not exceed quantityDelivered'); }
}
export class ReceiptQuantityExceedsPoError extends Error {
  statusCode = 422; code = 'RECEIPT_QUANTITY_EXCEEDS_PO';
  constructor() { super('Total posted receipt quantity would exceed PO item quantity'); }
}
