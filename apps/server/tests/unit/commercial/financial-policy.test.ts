import { describe, expect, it } from 'vitest';
import {
  FinancialSegregationOfDutiesError,
  InvalidFinancialActorContextError,
} from '../../../src/lib/commercial/commercial.errors.js';
import { assertFinancialActorSeparation } from '../../../src/lib/commercial/financial-policy.js';

const baseContext = {
  organizationId: 'organization-1',
  projectId: 'project-1',
  actorUserId: 'actor-1',
};

describe('financial actor separation policy', () => {
  it('allows a different actor to approve', () => {
    expect(() =>
      assertFinancialActorSeparation('approve', {
        ...baseContext,
        creatorUserId: 'creator-1',
        requesterUserId: 'requester-1',
        preparerUserId: 'preparer-1',
      }),
    ).not.toThrow();
  });

  it.each(['creatorUserId', 'requesterUserId', 'preparerUserId'] as const)(
    'rejects an approver who is also the %s',
    (role) => {
      expect(() =>
        assertFinancialActorSeparation('approve', {
          ...baseContext,
          [role]: baseContext.actorUserId,
        }),
      ).toThrow(FinancialSegregationOfDutiesError);
    },
  );

  it('rejects a payment executor who created or approved the payment', () => {
    for (const role of ['creatorUserId', 'approverUserId'] as const) {
      expect(() =>
        assertFinancialActorSeparation('execute', {
          ...baseContext,
          [role]: baseContext.actorUserId,
        }),
      ).toThrow(FinancialSegregationOfDutiesError);
    }
  });

  it('requires a tenant, project, and acting user context', () => {
    expect(() =>
      assertFinancialActorSeparation('approve', {
        ...baseContext,
        projectId: '',
      }),
    ).toThrow(InvalidFinancialActorContextError);
  });
});
