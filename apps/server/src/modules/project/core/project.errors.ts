// apps/server/src/modules/project/core/project.errors.ts
import {
  NotFoundError,
  ForbiddenError,
  ConflictError,
  ValidationError,
} from '../../auth/auth.errors.js';

export class ProjectNotFoundError extends NotFoundError {
  override code = 'PROJECT_NOT_FOUND';
  constructor(message = 'Project not found') {
    super(message);
    this.name = 'ProjectNotFoundError';
  }
}

export class ProjectForbiddenError extends ForbiddenError {
  override code = 'PROJECT_FORBIDDEN';
  constructor(message = 'Access denied to this project') {
    super(message);
    this.name = 'ProjectForbiddenError';
  }
}

export class ProjectConflictError extends ConflictError {
  override code = 'PROJECT_CONFLICT';
  constructor(message = 'Project resource conflict') {
    super(message);
    this.name = 'ProjectConflictError';
  }
}

/** Thrown when an optimistic concurrency check fails (stale version). */
export class ProjectModifiedError extends ConflictError {
  override code = 'PROJECT_MODIFIED';
  constructor(message = 'Project was modified by another request. Reload and retry.') {
    super(message);
    this.name = 'ProjectModifiedError';
  }
}

/** Thrown when a requested lifecycle transition is not valid. */
export class ProjectInvalidTransitionError extends ValidationError {
  override code = 'PROJECT_INVALID_TRANSITION';
  constructor(message = 'Invalid project status transition') {
    super(message);
    this.name = 'ProjectInvalidTransitionError';
  }
}

/** Thrown when an operation would leave a project with zero active Project Managers. */
export class ProjectLastManagerError extends ValidationError {
  override code = 'PROJECT_LAST_MANAGER';
  constructor(message = 'Cannot remove or change the role of the last Project Manager') {
    super(message);
    this.name = 'ProjectLastManagerError';
  }
}

export class ProjectMemberConflictError extends ConflictError {
  override code = 'PROJECT_MEMBER_EXISTS';
  constructor(message = 'User is already an active member of this project') {
    super(message);
    this.name = 'ProjectMemberConflictError';
  }
}

export class ProjectMemberNotFoundError extends NotFoundError {
  override code = 'PROJECT_MEMBER_NOT_FOUND';
  constructor(message = 'Project member not found') {
    super(message);
    this.name = 'ProjectMemberNotFoundError';
  }
}
