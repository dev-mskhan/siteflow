import {
  FinancialSegregationOfDutiesError,
  InvalidFinancialActorContextError,
} from './commercial.errors.js';

export type FinancialActorAction = 'approve' | 'execute';

export interface FinancialActorContext {
  organizationId: string;
  projectId: string;
  actorUserId: string;
  creatorUserId?: string | null;
  requesterUserId?: string | null;
  preparerUserId?: string | null;
  approverUserId?: string | null;
}

export function assertFinancialActorSeparation(
  action: FinancialActorAction,
  context: FinancialActorContext,
): void {
  if (
    !context.organizationId.trim() ||
    !context.projectId.trim() ||
    !context.actorUserId.trim()
  ) {
    throw new InvalidFinancialActorContextError();
  }

  const prohibitedActors =
    action === 'approve'
      ? [context.creatorUserId, context.requesterUserId, context.preparerUserId]
      : [context.creatorUserId, context.approverUserId];

  if (prohibitedActors.some((userId) => userId != null && userId === context.actorUserId)) {
    throw new FinancialSegregationOfDutiesError();
  }
}
