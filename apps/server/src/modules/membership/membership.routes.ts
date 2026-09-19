// apps/server/src/modules/membership/membership.routes.ts
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from '../auth/auth.middleware.js';
import { organizationContext, requirePermission } from '../rbac/permission.middleware.js';
import {
  handleListMembers,
  handleGetMember,
  handleUpdateMember,
  handleRemoveMember,
} from './membership.handler.js';
import {
  listMembersSchemaDoc,
  getMemberSchemaDoc,
  updateMemberSchemaDoc,
  removeMemberSchemaDoc,
} from './docs/membership.schemas.js';

export const membershipRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(async (scopedRoutes) => {
    scopedRoutes.addHook('preHandler', authenticate);
    scopedRoutes.addHook('preHandler', organizationContext);

    scopedRoutes.get(
      '/:organizationId/members',
      { schema: listMembersSchemaDoc, preHandler: [requirePermission('member:read')] },
      handleListMembers,
    );
    scopedRoutes.get(
      '/:organizationId/members/:memberId',
      { schema: getMemberSchemaDoc, preHandler: [requirePermission('member:read')] },
      handleGetMember,
    );
    scopedRoutes.patch(
      '/:organizationId/members/:memberId',
      { schema: updateMemberSchemaDoc, preHandler: [requirePermission('member:update')] },
      handleUpdateMember,
    );
    scopedRoutes.delete(
      '/:organizationId/members/:memberId',
      { schema: removeMemberSchemaDoc, preHandler: [requirePermission('member:remove')] },
      handleRemoveMember,
    );
  });
};
