// apps/server/src/modules/project/dependency/dependency.errors.ts

export class DependencyNotFoundError extends Error {
  readonly statusCode = 404;
  constructor(id: string) {
    super(`Dependency '${id}' not found.`);
    this.name = 'DependencyNotFoundError';
  }
}

export class DependencyAlreadyExistsError extends Error {
  readonly statusCode = 409;
  constructor(taskId: string, predecessorId: string) {
    super(`Dependency from predecessor '${predecessorId}' to task '${taskId}' already exists.`);
    this.name = 'DependencyAlreadyExistsError';
  }
}

export class DependencyCycleError extends Error {
  readonly statusCode = 422;
  constructor(taskId: string, predecessorId: string) {
    super(
      `Adding dependency from predecessor '${predecessorId}' to task '${taskId}' would create a cycle in the schedule graph.`,
    );
    this.name = 'DependencyCycleError';
  }
}

export class DependencySelfReferenceError extends Error {
  readonly statusCode = 422;
  constructor(taskId: string) {
    super(`Task '${taskId}' cannot depend on itself.`);
    this.name = 'DependencySelfReferenceError';
  }
}

export class DependencyTaskNotInProjectError extends Error {
  readonly statusCode = 422;
  constructor(taskId: string, projectId: string) {
    super(`Task '${taskId}' does not belong to project '${projectId}'.`);
    this.name = 'DependencyTaskNotInProjectError';
  }
}
