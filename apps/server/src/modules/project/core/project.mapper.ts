// apps/server/src/modules/project/core/project.mapper.ts
import type { Project } from '@siteflow/database/schema';
import type { ProjectDTO } from './project.types.js';
import type { ProjectMemberWithUser, ProjectMemberDTO } from '../members/project-member.types.js';
import type { ProjectRole } from './project.types.js';

// ── Project mappings ──────────────────────────────────────────────────────────

/**
 * Maps a DB row to the API DTO. Strips `version` (internal concurrency field)
 * and formats Date objects to ISO strings.
 */
export function toProjectDTO(row: Project): ProjectDTO {
  return {
    id: row.id,
    organizationId: row.organizationId,
    projectNumber: row.projectNumber,
    name: row.name,
    description: row.description,
    status: row.status as ProjectDTO['status'],
    projectType: row.projectType as ProjectDTO['projectType'],
    contractValue: row.contractValue,
    currency: row.currency,
    plannedStartDate: row.plannedStartDate,
    plannedEndDate: row.plannedEndDate,
    actualStartDate: row.actualStartDate,
    actualEndDate: row.actualEndDate,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Project member mappings ───────────────────────────────────────────────────

export function toProjectMemberDTO(row: ProjectMemberWithUser): ProjectMemberDTO {
  return {
    id: row.id,
    userId: row.userId,
    role: row.role as ProjectRole,
    status: row.status,
    addedBy: row.addedBy,
    createdAt: row.createdAt.toISOString(),
    user: row.user,
  };
}

// ── Cursor helpers ────────────────────────────────────────────────────────────

export function encodeCursor(row: Pick<Project, 'createdAt' | 'id'>): string {
  return Buffer.from(
    JSON.stringify({ createdAt: row.createdAt.toISOString(), id: row.id }),
  ).toString('base64');
}

export function decodeCursor(cursor: string): { createdAt: string; id: string } {
  try {
    const raw = Buffer.from(cursor, 'base64').toString('utf8');
    const parsed = JSON.parse(raw) as unknown;
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'createdAt' in parsed &&
      'id' in parsed &&
      typeof (parsed as any).createdAt === 'string' &&
      typeof (parsed as any).id === 'string'
    ) {
      return parsed as { createdAt: string; id: string };
    }
  } catch {
    // fall through to error
  }
  throw new Error('Invalid cursor format');
}
