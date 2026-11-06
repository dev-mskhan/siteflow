// apps/server/src/modules/ai/binding-tools/tool-approval.service.ts
import { getDb } from '../../../lib/db/index.js';
import { toolApprovals, type NewToolApproval, type ToolApproval } from '@siteflow/database/schema';
import { eq, and } from 'drizzle-orm';

export class ToolApprovalService {
  async requestApproval(data: {
    organizationId: string;
    toolName: string;
    requestedBy: string;
    requestContext: any;
    toolArgs: any;
  }): Promise<ToolApproval> {
    const db = getDb();

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24); // 24h expiry

    const newApproval: NewToolApproval = {
      ...data,
      status: 'PENDING',
      expiresAt,
    };

    const [approval] = await db.insert(toolApprovals).values(newApproval).returning();
    return approval!;
  }

  async approve(approvalId: string, approvedBy: string): Promise<ToolApproval> {
    const db = getDb();

    const [updated] = await db
      .update(toolApprovals)
      .set({
        status: 'APPROVED',
        approvedBy,
        approvedAt: new Date(),
      })
      .where(eq(toolApprovals.id, approvalId))
      .returning();

    if (!updated) {
      throw new Error('Tool approval not found');
    }

    return updated;
  }

  async reject(approvalId: string, approvedBy: string, reason: string): Promise<ToolApproval> {
    const db = getDb();

    const [updated] = await db
      .update(toolApprovals)
      .set({
        status: 'REJECTED',
        approvedBy,
        approvedAt: new Date(),
        rejectionReason: reason,
      })
      .where(eq(toolApprovals.id, approvalId))
      .returning();

    if (!updated) {
      throw new Error('Tool approval not found');
    }

    return updated;
  }

  async getPending(organizationId: string): Promise<ToolApproval[]> {
    const db = getDb();

    return db
      .select()
      .from(toolApprovals)
      .where(
        and(
          eq(toolApprovals.organizationId, organizationId),
          eq(toolApprovals.status, 'PENDING')
        )
      );
  }

  async checkStatus(approvalId: string): Promise<ToolApproval | null> {
    const db = getDb();

    const [approval] = await db
      .select()
      .from(toolApprovals)
      .where(eq(toolApprovals.id, approvalId));

    return approval || null;
  }
}
