// apps/server/src/modules/project/field-log/field-log.errors.ts

export class FieldLogNotFoundError extends Error {
  statusCode = 404;
  code = 'FIELD_LOG_NOT_FOUND';
  constructor(id: string) {
    super(`Field log not found: ${id}`);
  }
}

export class FieldLogImmutableError extends Error {
  statusCode = 422;
  code = 'FIELD_LOG_IMMUTABLE';
  constructor(status: string) {
    super(`Field log cannot be modified in status: ${status}`);
  }
}

export class FieldLogDuplicateDateError extends Error {
  statusCode = 409;
  code = 'FIELD_LOG_DUPLICATE_DATE';
  constructor(date: string) {
    super(`A field log already exists for date: ${date}`);
  }
}

export class FieldLogInvalidTransitionError extends Error {
  statusCode = 422;
  code = 'FIELD_LOG_INVALID_TRANSITION';
  constructor(from: string, to: string) {
    super(`Cannot transition field log from ${from} to ${to}`);
  }
}
