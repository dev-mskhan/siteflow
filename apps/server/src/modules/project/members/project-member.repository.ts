// apps/server/src/modules/project/members/project-member.repository.ts
import { eq, and, count } from 'drizzle-orm';
import { getDb } from '../../../lib/db/index.js';
import {
  projectMembers,
  users,
  type ProjectMember,
  type NewProjectMember,
} from '@siteflow/database/schema';
import type { ProjectMembership, ProjectMemberWithUser } from './project-member.types.js';
import type { ProjectRole } from '../core/project.types.js';

function toProjectMembership(row: ProjectMember): ProjectMembership {
  return {
    id: row.id,
    projectId: row.projectId,
    organizationId: row.organizationId,
    userId: row.userId,
    role: row.role as ProjectRole,
    status: row.status as 'ACTIVE' | 'REMOVED',
    addedBy: row.addedBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export class ProjectMemberRepository {
  private get db() {
    return getDb();
  }

  async add(tx: any, data: NewProjectMember): Promise<ProjectMembership> {
    const result = await tx.insert(projectMembers).values(data).returning();
    return toProjectMembership(result[0]!);
  }

  async findByProjectAndUser(
    orgId: string,
    projectId: string,
    userId: string,
  ): Promise<ProjectMembership | null> {
    const result = await this.db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.organizationId, orgId),
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      )
      .limit(1);
    return result[0] ? toProjectMembership(result[0]) : null;
  }

  async findActiveByProjectAndUser(
    orgId: string,
    projectId: string,
    userId: string,
  ): Promise<ProjectMembership | null> {
    const result = await this.db
      .select()
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.organizationId, orgId),
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
          eq(projectMembers.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    return result[0] ? toProjectMembership(result[0]) : null;
  }

  async findActiveMembers(orgId: string, projectId: string): Promise<ProjectMemberWithUser[]> {
    const rows = await this.db
      .select({
        member: projectMembers,
        user: {
          id: users.id,
          firstName: users.firstName,
          lastName: users.lastName,
          email: users.email,
        },
      })
      .from(projectMembers)
      .innerJoin(users, eq(projectMembers.userId, users.id))
      .where(
        and(
          eq(projectMembers.organizationId, orgId),
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.status, 'ACTIVE'),
        ),
      );

    return rows.map((r) => ({
      ...toProjectMembership(r.member),
      user: r.user,
    }));
  }

  async updateRole(
    tx: any,
    orgId: string,
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Promise<ProjectMembership> {
    const result = await tx
      .update(projectMembers)
      .set({ role, updatedAt: new Date() })
      .where(
        and(
          eq(projectMembers.organizationId, orgId),
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      )
      .returning();
    return toProjectMembership(result[0]!);
  }

  async reactivate(
    tx: any,
    orgId: string,
    projectId: string,
    userId: string,
    role: ProjectRole,
  ): Promise<ProjectMembership> {
    const result = await tx
      .update(projectMembers)
      .set({ status: 'ACTIVE', role, updatedAt: new Date() })
      .where(
        and(
          eq(projectMembers.organizationId, orgId),
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      )
      .returning();
    return toProjectMembership(result[0]!);
  }

  /** Soft-delete: sets status = 'REMOVED', never hard deletes. */
  async deactivate(
    tx: any,
    orgId: string,
    projectId: string,
    userId: string,
  ): Promise<void> {
    await tx
      .update(projectMembers)
      .set({ status: 'REMOVED', updatedAt: new Date() })
      .where(
        and(
          eq(projectMembers.organizationId, orgId),
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.userId, userId),
        ),
      );
  }

  async countActiveByRole(
    orgId: string,
    projectId: string,
    role: ProjectRole,
  ): Promise<number> {
    const result = await this.db
      .select({ count: count() })
      .from(projectMembers)
      .where(
        and(
          eq(projectMembers.organizationId, orgId),
          eq(projectMembers.projectId, projectId),
          eq(projectMembers.role, role),
          eq(projectMembers.status, 'ACTIVE'),
        ),
      );
    return result[0]?.count ?? 0;
  }
}

export const projectMemberRepository = new ProjectMemberRepository();
