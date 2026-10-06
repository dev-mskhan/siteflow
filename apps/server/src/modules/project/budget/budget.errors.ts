import { ConflictError, NotFoundError, ValidationError } from '../../auth/auth.errors.js';

export class ProjectBudgetNotFoundError extends NotFoundError {
  override code = 'PROJECT_BUDGET_NOT_FOUND';

  constructor() {
    super('Project budget not found');
  }
}

export class ProjectBudgetConflictError extends ConflictError {
  override code = 'PROJECT_BUDGET_CONFLICT';

  constructor(message = 'Project budget cannot perform this operation in its current state.') {
    super(message);
  }
}

export class InvalidProjectBudgetReferenceError extends ValidationError {
  override code = 'PROJECT_BUDGET_INVALID_REFERENCE';

  constructor() {
    super('A budget line references a cost code or phase outside this project.');
  }
}
