// apps/server/src/modules/project/task/task.errors.ts
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../../auth/auth.errors.js';

export class TaskNotFoundError extends NotFoundError {
  override code = 'TASK_NOT_FOUND';
  constructor(message = 'Task not found') {
    super(message);
    this.name = 'TaskNotFoundError';
  }
}

export class TaskForbiddenError extends ForbiddenError {
  override code = 'TASK_FORBIDDEN';
  constructor(message = 'Access denied to this task') {
    super(message);
    this.name = 'TaskForbiddenError';
  }
}

export class TaskConflictError extends ConflictError {
  override code = 'TASK_CONFLICT';
  constructor(message = 'Task resource conflict') {
    super(message);
    this.name = 'TaskConflictError';
  }
}

export class TaskModifiedError extends ConflictError {
  override code = 'TASK_MODIFIED';
  constructor(message = 'Task was modified by another request. Reload and retry.') {
    super(message);
    this.name = 'TaskModifiedError';
  }
}

export class InvalidTaskTransitionError extends ValidationError {
  override code = 'TASK_INVALID_TRANSITION';
  constructor(message = 'Invalid task status transition') {
    super(message);
    this.name = 'InvalidTaskTransitionError';
  }
}

export class InvalidTaskTypeOperationError extends ValidationError {
  override code = 'TASK_INVALID_TYPE_OPERATION';
  constructor(message = 'Operation not permitted on this task type') {
    super(message);
    this.name = 'InvalidTaskTypeOperationError';
  }
}

export class TaskDeletionForbiddenError extends ValidationError {
  override code = 'TASK_DELETION_FORBIDDEN';
  constructor(message = 'Task cannot be deleted because it has active relationships. Archive or cancel it instead.') {
    super(message);
    this.name = 'TaskDeletionForbiddenError';
  }
}
