// apps/server/src/modules/project/issue/issue.errors.ts

export class IssueNotFoundError extends Error {
  statusCode = 404;
  code = 'ISSUE_NOT_FOUND';
  constructor(id: string) {
    super(`Issue not found: ${id}`);
  }
}

export class IssueInvalidTransitionError extends Error {
  statusCode = 422;
  code = 'ISSUE_INVALID_TRANSITION';
  constructor(from: string, to: string) {
    super(`Cannot transition issue from ${from} to ${to}`);
  }
}
