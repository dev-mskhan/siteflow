// apps/server/src/modules/project/engine/schedule.errors.ts

export class ScheduleValidationError extends Error {
  readonly statusCode = 422;
  constructor(public errors: { code: string; message: string; taskId?: string }[]) {
    super(`Schedule graph validation failed with ${errors.length} error(s).`);
    this.name = 'ScheduleValidationError';
  }
}

export class ScheduleRevisionConflictError extends Error {
  readonly statusCode = 409;
  constructor(expected: number, actual: number) {
    super(`Schedule revision conflict: expected ${expected}, but actual project revision is ${actual}.`);
    this.name = 'ScheduleRevisionConflictError';
  }
}
