export class MaterialRequestNotFoundError extends Error {
  statusCode = 404;
  code = 'MATERIAL_REQUEST_NOT_FOUND';
  constructor(id: string) {
    super(`Material request not found: ${id}`);
  }
}
export class MaterialRequestInvalidStateError extends Error {
  statusCode = 422;
  code = 'MATERIAL_REQUEST_INVALID_STATE';
  constructor(current: string, action: string) {
    super(`Cannot ${action} a material request in status ${current}`);
  }
}
export class MaterialRequestNoItemsError extends Error {
  statusCode = 422;
  code = 'MATERIAL_REQUEST_NO_ITEMS';
  constructor() {
    super('Material request must have at least one item before submitting');
  }
}
export class MaterialRequestUnitMismatchError extends Error {
  statusCode = 422;
  code = 'MATERIAL_REQUEST_UNIT_MISMATCH';
  constructor(materialId: string, expected: string, got: string) {
    super(`Material ${materialId} requires unit ${expected}, got ${got}`);
  }
}
