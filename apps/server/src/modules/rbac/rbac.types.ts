// apps/server/src/modules/rbac/rbac.types.ts

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
  }
}
