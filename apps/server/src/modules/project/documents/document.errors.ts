export class DocumentNotFoundError extends Error {
  statusCode = 404;
  code = 'DOCUMENT_NOT_FOUND';
  constructor(id: string) {
    super(`Document not found: ${id}`);
  }
}

export class DocumentInvalidStateError extends Error {
  statusCode = 422;
  code = 'DOCUMENT_INVALID_STATE';
  constructor(status: string, action: string) {
    super(`Cannot ${action} a document in ${status} state`);
  }
}

export class DocumentUploadIncompleteError extends Error {
  statusCode = 422;
  code = 'DOCUMENT_UPLOAD_INCOMPLETE';
  constructor() {
    super('Uploaded object does not match the document metadata');
  }
}

export class DocumentAccessDeniedError extends Error {
  statusCode = 403;
  code = 'DOCUMENT_ACCESS_DENIED';
  constructor() {
    super('Forbidden');
  }
}

export class DocumentInvalidCursorError extends Error {
  statusCode = 422;
  code = 'DOCUMENT_INVALID_CURSOR';
  constructor() {
    super('Invalid document cursor');
  }
}

export class DocumentVersionConflictError extends Error {
  statusCode = 409;
  code = 'DOCUMENT_VERSION_CONFLICT';
  constructor() {
    super('A document version is already pending or the version is stale');
  }
}
