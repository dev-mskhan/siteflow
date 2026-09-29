export class ProcurementApprovalNotFoundError extends Error {
  statusCode = 404;
  code = 'PROCUREMENT_APPROVAL_NOT_FOUND';
  constructor(id: string) {
    super(`Procurement approval not found: ${id}`);
  }
}

export class ProcurementApprovalInvalidStateError extends Error {
  statusCode = 422;
  code = 'PROCUREMENT_APPROVAL_INVALID_STATE';
  constructor(status: string, action: string) {
    super(`Cannot ${action} approval in status ${status}`);
  }
}

export class ProcurementApprovalDuplicatePendingError extends Error {
  statusCode = 409;
  code = 'PROCUREMENT_APPROVAL_DUPLICATE_PENDING';
  constructor() {
    super('A PENDING approval already exists for this resource');
  }
}

export class ProcurementApprovalResourceOwnershipError extends Error {
  statusCode = 422;
  code = 'PROCUREMENT_APPROVAL_RESOURCE_OWNERSHIP';
  constructor() {
    super('Resource does not belong to the same organization and project');
  }
}
