export class ScheduleOfValuesNotFoundError extends Error {
  statusCode = 404;
  code = 'SCHEDULE_OF_VALUES_NOT_FOUND';
  constructor() {
    super('Schedule of values not found.');
  }
}

export class ScheduleOfValuesConflictError extends Error {
  statusCode = 409;
  code = 'SCHEDULE_OF_VALUES_CONFLICT';
  constructor(message = 'The schedule of values cannot transition from its current state.') {
    super(message);
  }
}

export class InvalidScheduleOfValuesReferenceError extends Error {
  statusCode = 422;
  code = 'INVALID_SCHEDULE_OF_VALUES_REFERENCE';
  constructor() {
    super('A schedule-of-values reference is outside this project, inactive, or unsupported.');
  }
}

export class ScheduleOfValuesReconciliationError extends Error {
  statusCode = 422;
  code = 'SCHEDULE_OF_VALUES_RECONCILIATION_FAILED';
  constructor() {
    super('The schedule-of-values line total must equal the base contract value.');
  }
}
