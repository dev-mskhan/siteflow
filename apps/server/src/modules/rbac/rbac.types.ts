import type { ProjectContext } from '../project/core/project.types.js';

export type OrganizationContext = {
  organizationId: string;
  membershipId: string;
  userId: string;
  roleId: string;
  permissions: string[];
};

// Extends FastifyRequest — import this type in any route file that needs orgContext
declare module 'fastify' {
  interface FastifyRequest {
    orgContext?: OrganizationContext;
    projectCtx?: ProjectContext;
  }
}
