// apps/server/src/modules/project/subcontractor/subcontractor.errors.ts
export class SubcontractorNotFoundError extends Error {
  statusCode = 404;
  code = 'SUBCONTRACTOR_NOT_FOUND';
  constructor(id: string) {
    super(`Subcontractor not found: ${id}`);
  }
}

export class ProjectSubcontractorNotFoundError extends Error {
  statusCode = 404;
  code = 'PROJECT_SUBCONTRACTOR_NOT_FOUND';
  constructor(subcontractorId: string, projectId: string) {
    super(`Subcontractor ${subcontractorId} not assigned to project ${projectId}`);
  }
}

export class SubcontractorContactNotFoundError extends Error {
  statusCode = 404;
  code = 'SUBCONTRACTOR_CONTACT_NOT_FOUND';
  constructor(id: string) {
    super(`Subcontractor contact not found: ${id}`);
  }
}

export class SubcontractorInactiveError extends Error {
  statusCode = 422;
  code = 'SUBCONTRACTOR_INACTIVE';
  constructor(id: string) {
    super(`Subcontractor ${id} is INACTIVE or SUSPENDED and cannot be assigned`);
  }
}

export class SubcontractorTaskAssignmentNotFoundError extends Error {
  statusCode = 404;
  code = 'SUBCONTRACTOR_TASK_ASSIGNMENT_NOT_FOUND';
  constructor() {
    super('Subcontractor task assignment not found');
  }
}

export class SubcontractorAlreadyAssignedToProjectError extends Error {
  statusCode = 409;
  code = 'SUBCONTRACTOR_ALREADY_ASSIGNED_TO_PROJECT';
  constructor(subcontractorId: string, projectId: string) {
    super(`Subcontractor ${subcontractorId} is already assigned to project ${projectId}`);
  }
}

export class TaskAlreadyAssignedToSubcontractorError extends Error {
  statusCode = 409;
  code = 'TASK_ALREADY_ASSIGNED_TO_SUBCONTRACTOR';
  constructor(taskId: string, subcontractorId: string) {
    super(`Task ${taskId} is already assigned to subcontractor ${subcontractorId}`);
  }
}

export class PrimaryContactAlreadyExistsError extends Error {
  statusCode = 409;
  code = 'PRIMARY_CONTACT_ALREADY_EXISTS';
  constructor(subcontractorId: string) {
    super(`Subcontractor ${subcontractorId} already has a primary contact`);
  }
}
