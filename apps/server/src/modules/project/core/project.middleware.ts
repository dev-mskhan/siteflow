// apps/server/src/modules/project/core/project.middleware.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError, ValidationError } from '../../auth/auth.errors.js';
import { ProjectNotFoundError } from './project.errors.js';
import { projectPolicy } from './project.policy.js';
import { ProjectRepository } from './project.repository.js';
import { ensureRedisConnected } from '../../../lib/redis/redis.js';
import { createLogger } from '@siteflow/observability/server';
import type { ProjectContext, ProjectMembershipRef, ProjectRole } from './project.types.js';

const logger = createLogger({ name: 'project-middleware' });
const projectRepo = new ProjectRepository();

const PROJECT_CTX_CACHE_TTL_SECONDS = 120;

function projectCtxCacheKey(orgId: string, projectId: string, userId: string): string {
  return `siteflow:v1:proj-ctx:${orgId}:${projectId}:${userId}`;
}

interface CachedProjectCtxEntry {
  projectOrgId: string;
  membership: { id: string; role: string; status: string } | null;
}

/**
 * Fastify preHandler — establishes ProjectContext on request.projectCtx.
 *
 * Prerequisites: authenticate → organizationContext must have run first.
 * Reads :projectId from route params, loads the project + membership in a
 * single LEFT JOIN query (merged from two sequential calls), caches the result
 * in Redis for 120s keyed siteflow:v1:proj-ctx:{orgId}:{projectId}:{userId}.
 *
 * IDOR safety: wrong-org projectId returns 404, not 403.
 */
export async function projectContext(
  request: FastifyRequest,
  _reply: FastifyReply,
): Promise<void> {
  if (!request.orgContext) {
    throw new ForbiddenError('Organization context required');
  }

  const params = request.params as Record<string, string | undefined>;
  const projectId = params['projectId'];

  if (!projectId) {
    throw new ValidationError('Project ID missing in request parameters');
  }

  const orgId = request.orgContext.organizationId;
  const userId = request.orgContext.userId;
  const cacheKey = projectCtxCacheKey(orgId, projectId, userId);

  // ── Try Redis cache first ────────────────────────────────────────────────
  let projectOrgId: string | undefined;
  let membership: ProjectMembershipRef | null = null;

  try {
    const redis = await ensureRedisConnected();
    const cached = await redis.get(cacheKey);
    if (cached) {
      const entry = JSON.parse(cached) as CachedProjectCtxEntry;
      // Belt-and-suspenders org boundary check on cached data
      if (entry.projectOrgId !== orgId) {
        throw new ProjectNotFoundError();
      }
      projectOrgId = entry.projectOrgId;
      membership = entry.membership
        ? { id: entry.membership.id, role: entry.membership.role as ProjectRole, status: entry.membership.status as 'ACTIVE' | 'REMOVED' }
        : null;
    }
  } catch (err) {
    if (err instanceof ProjectNotFoundError) throw err;
    logger.warn({ err, projectId, userId }, 'Redis project context cache read failed — falling back to DB');
  }

  // ── Cache miss: single DB query (LEFT JOIN project + membership) ─────────
  if (!projectOrgId) {
    const result = await projectRepo.findByIdWithMembership(orgId, projectId, userId);

    if (!result) {
      // Never 403 here — do not leak existence to wrong-org callers
      throw new ProjectNotFoundError();
    }

    // Belt-and-suspenders: explicit org boundary check
    if (result.project.organizationId !== orgId) {
      throw new ProjectNotFoundError();
    }

    projectOrgId = result.project.organizationId;
    membership = result.membership
      ? {
          id: result.membership.id,
          role: result.membership.role as ProjectRole,
          status: result.membership.status as 'ACTIVE' | 'REMOVED',
        }
      : null;

    // ── Populate cache (fail-open) ─────────────────────────────────────────
    try {
      const redis = await ensureRedisConnected();
      const entry: CachedProjectCtxEntry = {
        projectOrgId,
        membership: membership ? { id: membership.id, role: membership.role, status: membership.status } : null,
      };
      await redis.set(cacheKey, JSON.stringify(entry), 'EX', PROJECT_CTX_CACHE_TTL_SECONDS);
    } catch (err) {
      logger.warn({ err, projectId, userId }, 'Redis project context cache write failed');
    }
  }

  const ctx: ProjectContext = {
    organizationId: orgId,
    projectId,
    userId,
    organizationMembership: {
      id: request.orgContext.membershipId,
      roleId: request.orgContext.roleId,
      permissions: request.orgContext.permissions,
    },
    projectMembership: membership,
  };

  request.projectCtx = ctx;
}

/**
 * Invalidates the project context cache for a specific user+project combination.
 * Call after membership add/remove/role update so the next request re-fetches from DB.
 */
export async function invalidateProjectContextCache(
  orgId: string,
  projectId: string,
  userId: string,
): Promise<void> {
  try {
    const redis = await ensureRedisConnected();
    await redis.del(projectCtxCacheKey(orgId, projectId, userId));
  } catch (err) {
    logger.warn({ err, orgId, projectId, userId }, 'Failed to invalidate project context cache');
  }
}

/**
 * Factory for project-permission-checking preHandler hooks.
 * Requires projectContext to have run first.
 * Throws ProjectForbiddenError (403) via projectPolicy if denied.
 */
export function requireProjectPermission(action: string) {
  return async function projectPermissionGuard(
    request: FastifyRequest,
    _reply: FastifyReply,
  ): Promise<void> {
    if (!request.projectCtx) {
      throw new ForbiddenError('Project context not established');
    }
    projectPolicy.authorize({ actor: request.projectCtx, action });
  };
}
