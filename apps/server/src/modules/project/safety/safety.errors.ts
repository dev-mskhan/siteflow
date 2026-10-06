export class SafetyResourceNotFoundError extends Error {
  statusCode = 404;
  code = 'SAFETY_RESOURCE_NOT_FOUND';
  constructor() {
    super('Safety resource not found');
  }
}

export class SafetyInvalidStateError extends Error {
  statusCode = 422;
  code = 'SAFETY_INVALID_STATE';
  constructor(status: string, target: string) {
    super(`Cannot transition safety event from ${status} to ${target}`);
  }
}

export class SafetyOwnershipError extends Error {
  statusCode = 422;
  code = 'SAFETY_RESOURCE_OWNERSHIP';
  constructor() {
    super('Referenced resource must belong to this organization and project');
  }
}

export class SafetyInvalidCursorError extends Error {
  statusCode = 422;
  code = 'SAFETY_INVALID_CURSOR';
  constructor() {
    super('Invalid safety cursor');
  }
}
