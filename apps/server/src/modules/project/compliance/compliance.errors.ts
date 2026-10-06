export class ComplianceResourceNotFoundError extends Error {
  statusCode = 404;
  code = 'COMPLIANCE_RESOURCE_NOT_FOUND';
  constructor() {
    super('Compliance resource not found');
  }
}

export class ComplianceInvalidStateError extends Error {
  statusCode = 422;
  code = 'COMPLIANCE_INVALID_STATE';
  constructor(status: string, target: string) {
    super(`Cannot transition compliance resource from ${status} to ${target}`);
  }
}

export class ComplianceOwnershipError extends Error {
  statusCode = 422;
  code = 'COMPLIANCE_RESOURCE_OWNERSHIP';
  constructor() {
    super('Referenced resource must belong to this organization and project');
  }
}

export class ComplianceInvalidCursorError extends Error {
  statusCode = 422;
  code = 'COMPLIANCE_INVALID_CURSOR';
  constructor() {
    super('Invalid compliance cursor');
  }
}
