export class ProposalValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'PROPOSAL_VALIDATION_ERROR';

  constructor(message = 'The proposal input is invalid.') {
    super(message);
    this.name = 'ProposalValidationError';
  }
}

export class ProposalNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'PROPOSAL_NOT_FOUND';

  constructor() {
    super('Proposal not found.');
    this.name = 'ProposalNotFoundError';
  }
}

export class ProposalConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'PROPOSAL_CONFLICT';

  constructor(message = 'The proposal cannot be changed in its current state.') {
    super(message);
    this.name = 'ProposalConflictError';
  }
}

export class ProposalVersionConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'PROPOSAL_VERSION_CONFLICT';

  constructor() {
    super('The proposal has changed. Reload it and retry.');
    this.name = 'ProposalVersionConflictError';
  }
}

export class TenderNotFoundError extends Error {
  readonly statusCode = 404;
  readonly code = 'TENDER_NOT_FOUND';

  constructor() {
    super('Tender not found.');
    this.name = 'TenderNotFoundError';
  }
}

export class TenderConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'TENDER_CONFLICT';

  constructor(message = 'The tender cannot be changed in its current state.') {
    super(message);
    this.name = 'TenderConflictError';
  }
}

export class TenderVersionConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'TENDER_VERSION_CONFLICT';

  constructor() {
    super('The tender has changed. Reload it and retry.');
    this.name = 'TenderVersionConflictError';
  }
}

export class ProposalConversionConflictError extends Error {
  readonly statusCode = 409;
  readonly code = 'PROPOSAL_CONVERSION_CONFLICT';

  constructor(message = 'A conversion record for this proposal revision already exists with a different request.') {
    super(message);
    this.name = 'ProposalConversionConflictError';
  }
}

export class ProposalConversionIncompleteError extends Error {
  readonly statusCode = 409;
  readonly code = 'PROPOSAL_CONVERSION_INCOMPLETE';

  constructor() {
    super('A conversion is already in progress for this proposal revision. Wait for it to complete before retrying.');
    this.name = 'ProposalConversionIncompleteError';
  }
}
