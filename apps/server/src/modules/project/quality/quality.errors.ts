export class QualityResourceNotFoundError extends Error {
  statusCode = 404;
  code = 'QUALITY_RESOURCE_NOT_FOUND';
  constructor() {
    super('Quality resource not found');
  }
}

export class QualityInvalidStateError extends Error {
  statusCode = 422;
  code = 'QUALITY_INVALID_STATE';
  constructor(status: string, target: string) {
    super(`Cannot transition quality resource from ${status} to ${target}`);
  }
}

export class QualityOwnershipError extends Error {
  statusCode = 422;
  code = 'QUALITY_RESOURCE_OWNERSHIP';
  constructor() {
    super('Referenced resource must belong to this organization and project');
  }
}

export class QualityInvalidCursorError extends Error {
  statusCode = 422;
  code = 'QUALITY_INVALID_CURSOR';
  constructor() {
    super('Invalid quality cursor');
  }
}
