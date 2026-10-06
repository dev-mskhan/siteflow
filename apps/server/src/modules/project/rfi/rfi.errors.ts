export class RfiNotFoundError extends Error {
  statusCode = 404;
  code = 'RFI_NOT_FOUND';
  constructor() {
    super('RFI not found');
  }
}

export class RfiInvalidStateError extends Error {
  statusCode = 422;
  code = 'RFI_INVALID_STATE';
  constructor(status: string, target: string) {
    super(`Cannot transition RFI from ${status} to ${target}`);
  }
}

export class RfiOwnershipError extends Error {
  statusCode = 422;
  code = 'RFI_RESOURCE_OWNERSHIP';
  constructor() {
    super('Linked task must belong to this organization and project');
  }
}

export class RfiInvalidCursorError extends Error {
  statusCode = 422;
  code = 'RFI_INVALID_CURSOR';
  constructor() {
    super('Invalid RFI cursor');
  }
}
