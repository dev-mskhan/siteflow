// apps/server/src/modules/invitation/invitation.repository.ts
import { eq, and, gt, lt } from 'drizzle-orm';
import { getDb } from '../../lib/db/index.js';
import { generateId } from '../../lib/id.js';
import {
  invitations,
  roles,
  type Invitation,
  type NewInvitation,
} from '@siteflow/database/schema';

export type InvitationWithRole = Invitation & { roleName: string };

export class InvitationRepository {
  private get db() {
    return getDb();
  }

  async findById(id: string): Promise<Invitation | undefined> {
    const result = await this.db.select().from(invitations).where(eq(invitations.id, id)).limit(1);
    return result[0];
  }

  async findPendingByOrgAndEmail(orgId: string, email: string): Promise<Invitation | undefined> {
    const result = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.organizationId, orgId),
          eq(invitations.email, email.trim().toLowerCase()),
          eq(invitations.status, 'PENDING'),
        ),
      )
      .limit(1);
    return result[0];
  }

  async findPendingByTokenHash(tokenHash: string): Promise<Invitation | undefined> {
    const result = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.tokenHash, tokenHash),
          eq(invitations.status, 'PENDING'),
        ),
      )
      .limit(1);
    return result[0];
  }

  async findValidPending(tokenHash: string): Promise<Invitation | undefined> {
    const now = new Date();
    const result = await this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.tokenHash, tokenHash),
          eq(invitations.status, 'PENDING'),
          gt(invitations.expiresAt, now),
        ),
      )
      .limit(1);
    return result[0];
  }

  async findByOrg(orgId: string): Promise<InvitationWithRole[]> {
    const rows = await this.db
      .select({
        invitation: invitations,
        roleName: roles.name,
      })
      .from(invitations)
      .innerJoin(roles, eq(invitations.roleId, roles.id))
      .where(eq(invitations.organizationId, orgId));

    return rows.map((r) => ({
      ...r.invitation,
      roleName: r.roleName,
    }));
  }

  async create(data: Omit<NewInvitation, 'id'>, tx?: any): Promise<Invitation> {
    const client = tx ?? this.db;
    const result = await client
      .insert(invitations)
      .values({
        id: generateId(),
        ...data,
        email: data.email.trim().toLowerCase(),
      })
      .returning();
    return result[0]!;
  }

  /**
   * Finds all overdue PENDING invitations (expiresAt < now).
   * Used by the expiry worker to batch-mark them as EXPIRED.
   */
  async findOverduePending(batchSize = 100): Promise<Invitation[]> {
    const now = new Date();
    return this.db
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.status, 'PENDING'),
          lt(invitations.expiresAt, now),
        ),
      )
      .limit(batchSize);
  }

  async updateStatus(id: string, status: 'ACCEPTED' | 'CANCELLED' | 'EXPIRED', tx?: any): Promise<void> {
    const client = tx ?? this.db;
    const updateData: Partial<NewInvitation> = {
      status,
      updatedAt: new Date(),
    };
    if (status === 'ACCEPTED') {
      updateData.acceptedAt = new Date();
    }

    await client
      .update(invitations)
      .set(updateData)
      .where(eq(invitations.id, id));
  }
}
