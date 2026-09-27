// apps/server/src/modules/project/core/project.jobs.ts

export const PROJECT_QUEUES = {
  PROJECT_CREATED: 'project:created',
  PROJECT_UPDATED: 'project:updated',
  PROJECT_STATUS_CHANGED: 'project:status_changed',
  PROJECT_MEMBER_ADDED: 'project:member_added',
  PROJECT_MEMBER_ROLE_CHANGED: 'project:member_role_changed',
  PROJECT_MEMBER_REMOVED: 'project:member_removed',
} as const;

// ── Mandatory job envelope ────────────────────────────────────────────────────

export interface ProjectJobContext {
  organizationId: string;
  projectId?: string;
  actorUserId?: string;
  correlationId: string;
  idempotencyKey?: string;
}

// ── Concrete job payloads ─────────────────────────────────────────────────────

export interface ProjectCreatedPayload extends ProjectJobContext {
  projectId: string;
  projectNumber: string;
  actorUserId: string;
  idempotencyKey: string;
}

export interface ProjectUpdatedPayload extends ProjectJobContext {
  projectId: string;
  actorUserId: string;
}

export interface ProjectStatusChangedPayload extends ProjectJobContext {
  projectId: string;
  fromStatus: string;
  toStatus: string;
  transition: string;
  actorUserId: string;
  idempotencyKey: string;
}

export interface ProjectMemberAddedPayload extends ProjectJobContext {
  projectId: string;
  targetUserId: string;
  role: string;
  actorUserId: string;
}

export interface ProjectMemberRoleChangedPayload extends ProjectJobContext {
  projectId: string;
  targetUserId: string;
  fromRole: string;
  toRole: string;
  actorUserId: string;
}

export interface ProjectMemberRemovedPayload extends ProjectJobContext {
  projectId: string;
  targetUserId: string;
  actorUserId: string;
}
