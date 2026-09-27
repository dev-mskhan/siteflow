// apps/server/src/modules/project/core/project.policy.ts
import { ProjectForbiddenError } from './project.errors.js';
import type { ProjectContext, ProjectRole } from './project.types.js';

// ── Capability map — defines what each project role may do ───────────────────

const PROJECT_ROLE_CAPABILITIES: Record<ProjectRole, string[]> = {
  PROJECT_MANAGER: [
    'project:read',
    'project:update',
    'project:lifecycle',
    'project:member:manage',
    'project:settings:update',
    'project:phase:manage',
    'project:cost-code:manage',
    'project:audit:read',
  ],
  SITE_SUPERVISOR: ['project:read', 'project:update', 'project:phase:manage'],
  PROJECT_MEMBER: ['project:read'],
  FINANCE: ['project:read', 'project:cost-code:manage'],
  PROCUREMENT: ['project:read'],
  SUBCONTRACTOR: ['project:read'],
  CLIENT: ['project:read'],
};

// ── Org-level permission strings that bypass project membership ───────────────

// An actor with any of these on their orgContext.permissions can act cross-project.
const ORG_LEVEL_AUTHORITY_MAP: Record<string, string[]> = {
  'project:read':              ['project:read:any', 'project:write:any', 'project:admin'],
  'project:update':            ['project:write:any', 'project:admin'],
  'project:lifecycle':         ['project:admin'],
  'project:member:manage':     ['project:admin'],
  'project:settings:update':   ['project:admin'],
  'project:phase:manage':      ['project:write:any', 'project:admin'],
  'project:cost-code:manage':  ['project:write:any', 'project:admin'],
  'project:audit:read':        ['project:read:any', 'project:admin'],
};

// ── Internal helpers ──────────────────────────────────────────────────────────

function hasOrgLevelAuthority(actor: ProjectContext, action: string): boolean {
  const orgPermsRequired = ORG_LEVEL_AUTHORITY_MAP[action] ?? [];
  return orgPermsRequired.some((p) => actor.organizationMembership.permissions.includes(p));
}

function hasProjectLevelAuthority(actor: ProjectContext, action: string): boolean {
  const membership = actor.projectMembership;
  if (!membership || membership.status !== 'ACTIVE') return false;
  const caps = PROJECT_ROLE_CAPABILITIES[membership.role] ?? [];
  return caps.includes(action);
}

// ── Public policy object ──────────────────────────────────────────────────────

export const projectPolicy = {
  /**
   * Authorizes an actor for a given action using the three-case model:
   *   Case 1 — org-level authority (org admin / cross-project permissions)
   *   Case 2 — project-scoped authority (active membership + role capability)
   *   Case 3 — deny (throws ProjectForbiddenError)
   */
  authorize({ actor, action }: { actor: ProjectContext; action: string }): void {
    // Case 1: org-level authority grants cross-project access
    if (hasOrgLevelAuthority(actor, action)) return;

    // Case 2: project-scoped membership authority
    if (hasProjectLevelAuthority(actor, action)) return;

    // Case 3: deny
    throw new ProjectForbiddenError(`Missing authority for action: ${action}`);
  },

  /**
   * Returns true/false without throwing — useful for conditional logic.
   */
  can({ actor, action }: { actor: ProjectContext; action: string }): boolean {
    return hasOrgLevelAuthority(actor, action) || hasProjectLevelAuthority(actor, action);
  },
};
