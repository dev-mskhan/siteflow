// apps/server/src/modules/project/baseline/baseline.errors.ts

export class BaselineNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(baselineId?: string) {
    super(baselineId ? `Schedule baseline '${baselineId}' not found.` : 'Schedule baseline not found.');
    this.name = 'BaselineNotFoundError';
  }
}

export class BaselineImmutabilityError extends Error {
  readonly statusCode = 422;
  constructor(message = 'Active or superseded schedule baselines are immutable and cannot be updated or deleted.') {
    super(message);
    this.name = 'BaselineImmutabilityError';
  }
}

export class BaselineAlreadyActiveError extends Error {
  readonly statusCode = 422;
  constructor(baselineId: string) {
    super(`Schedule baseline '${baselineId}' is already active.`);
    this.name = 'BaselineAlreadyActiveError';
  }
}

export class BaselineNoTasksError extends Error {
  readonly statusCode = 422;
  constructor() {
    super('Cannot snapshot baseline because the project contains no tasks with scheduled dates.');
    this.name = 'BaselineNoTasksError';
  }
}
