// apps/server/src/modules/project/field-log/field-log-amendment.errors.ts

export class AmendmentNotAllowedError extends Error {
  statusCode = 422;
  code = 'AMENDMENT_NOT_ALLOWED';
  constructor(status: string) {
    super(`Amendments can only be created for LOCKED field logs. Current status: ${status}`);
  }
}

export class AmendmentNotFoundError extends Error {
  statusCode = 404;
  code = 'AMENDMENT_NOT_FOUND';
  constructor(id: string) {
    super(`Field log amendment not found: ${id}`);
  }
}
