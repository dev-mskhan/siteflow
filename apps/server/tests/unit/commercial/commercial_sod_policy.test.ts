import { describe, expect, it } from 'vitest';
import { assertFinancialActorSeparation } from '../../../src/lib/commercial/financial-policy.js';
import { FinancialSegregationOfDutiesError } from '../../../src/lib/commercial/commercial.errors.js';
import { projectPolicy } from '../../../src/modules/project/core/project.policy.js';
import type { ProjectContext } from '../../../src/modules/project/core/project.types.js';

describe('commercial segregation of duties', () => {
  it('blocks a creator, requester, or preparer from approving and blocks creator/approver from execution', () => {
    const approvalActors = ['creator', 'requester', 'preparer'] as const;
    for (const actorField of approvalActors) {
      expect(() =>
        assertFinancialActorSeparation('approve', {
          organizationId: 'org',
          projectId: 'project',
          actorUserId: 'actor',
          [actorField === 'creator'
            ? 'creatorUserId'
            : actorField === 'requester'
              ? 'requesterUserId'
              : 'preparerUserId']: 'actor',
        }),
      ).toThrow(FinancialSegregationOfDutiesError);
    }
    for (const actorField of ['creatorUserId', 'approverUserId'] as const) {
      expect(() =>
        assertFinancialActorSeparation('execute', {
          organizationId: 'org',
          projectId: 'project',
          actorUserId: 'actor',
          [actorField]: 'actor',
        }),
      ).toThrow(FinancialSegregationOfDutiesError);
    }
    expect(() =>
      assertFinancialActorSeparation('approve', {
        organizationId: 'org',
        projectId: 'project',
        actorUserId: 'independent-approver',
        creatorUserId: 'creator',
        requesterUserId: 'requester',
        preparerUserId: 'preparer',
      }),
    ).not.toThrow();
  });

  it('gives client approval only to the CLIENT project role and maps authorized org administration', () => {
    const actor = (role: 'CLIENT' | 'FINANCE', permissions: string[] = []): ProjectContext => ({
      organizationId: 'org',
      projectId: 'project',
      userId: 'user',
      organizationMembership: { id: 'org-member', roleId: 'role', permissions },
      projectMembership: { id: 'project-member', role, status: 'ACTIVE' },
    });
    expect(
      projectPolicy.can({ actor: actor('CLIENT'), action: 'project.change_order.client_approve' }),
    ).toBe(true);
    expect(
      projectPolicy.can({ actor: actor('FINANCE'), action: 'project.change_order.client_approve' }),
    ).toBe(false);
    expect(
      projectPolicy.can({
        actor: actor('FINANCE', ['project:write:any']),
        action: 'project.change_order.client_approve',
      }),
    ).toBe(false);
    expect(
      projectPolicy.can({
        actor: actor('FINANCE', ['project:admin']),
        action: 'project.change_order.client_approve',
      }),
    ).toBe(true);
    expect(
      projectPolicy.can({
        actor: actor('FINANCE'),
        action: 'project.financial_audit.read',
      }),
    ).toBe(true);
  });
});
