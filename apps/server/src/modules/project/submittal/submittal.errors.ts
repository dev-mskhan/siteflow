export class SubmittalNotFoundError extends Error {
  statusCode = 404;
  code = 'SUBMITTAL_NOT_FOUND';
  constructor() {
    super('Submittal not found');
  }
}

export class SubmittalRevisionNotFoundError extends Error {
  statusCode = 404;
  code = 'SUBMITTAL_REVISION_NOT_FOUND';
  constructor() {
    super('Submittal revision not found');
  }
}

export class SubmittalInvalidStateError extends Error {
  statusCode = 422;
  code = 'SUBMITTAL_INVALID_STATE';
  constructor(status: string, target: string) {
    super(`Cannot transition submittal from ${status} to ${target}`);
  }
}

export class SubmittalOwnershipError extends Error {
  statusCode = 422;
  code = 'SUBMITTAL_RESOURCE_OWNERSHIP';
  constructor() {
    super('Responsible member and reviewer must be active members of this project');
  }
}

export class SubmittalReviewerForbiddenError extends Error {
  statusCode = 403;
  code = 'SUBMITTAL_REVIEW_FORBIDDEN';
  constructor() {
    super('Forbidden');
  }
}

export class SubmittalInvalidCursorError extends Error {
  statusCode = 422;
  code = 'SUBMITTAL_INVALID_CURSOR';
  constructor() {
    super('Invalid submittal cursor');
  }
}
