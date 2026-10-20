// apps/server/src/modules/ai/approvals/approval.repository.ts
import { eq, and, desc, lt } from 'drizzle-orm';

import { getDb } from '../../../lib/db/index.js';
import { generateId } from '../../../lib/id.js';
import {
  agentApprovals,
  type AgentApproval,
  type NewAgentApproval,
  type AgentApprovalStatus,
} from '@siteflow/database/schema';

export interface ListApprovalsOptions {
  organizationId: string;
  status?: AgentApprovalStatus;
  limit?: number;
  cursor?: string;
}

export class ApprovalRepository {
  private get db() {
    return getDb();
  }

  async create(data: Omit<NewAgentApproval, 'id'>): Promise<AgentApproval> {
    const result = await this.db
      .insert(agentApprovals)
      .values({ id: generateId(), ...data })
      .returning();
    return result[0]!;
  }

  async findById(id: string, organizationId: string): Promise<AgentApproval | undefined> {
    const result = await this.db
      .select()
      .from(agentApprovals)
      .where(and(eq(agentApprovals.id, id), eq(agentApprovals.organizationId, organizationId)))
      .limit(1);
    return result[0];
  }

  async findPendingForRun(runId: string): Promise<AgentApproval | undefined> {
    const result = await this.db
      .select()
      .from(agentApprovals)
      .where(and(eq(agentApprovals.runId, runId), eq(agentApprovals.status, 'PENDING')))
      .limit(1);
    return result[0];
  }

  /**
   * Fetches the most-recently-created approval for a run regardless of status.
   * Use this on the resume path — by the time the worker resumes, the approval
   * row has already transitioned from PENDING → APPROVED (or REJECTED), so
   * findPendingForRun would return undefined and silently drop the resume.
   */
  async findLatestForRun(runId: string): Promise<AgentApproval | undefined> {
    const result = await this.db
      .select()
      .from(agentApprovals)
      .where(eq(agentApprovals.runId, runId))
      .orderBy(desc(agentApprovals.createdAt))
      .limit(1);
    return result[0];
  }

  async list(opts: ListApprovalsOptions): Promise<AgentApproval[]> {
    const { organizationId, status, limit = 20, cursor } = opts;
    const conditions = [eq(agentApprovals.organizationId, organizationId)];
    if (status) conditions.push(eq(agentApprovals.status, status));
    if (cursor) conditions.push(lt(agentApprovals.createdAt, new Date(cursor)));

    return this.db
      .select()
      .from(agentApprovals)
      .where(and(...conditions))
      .orderBy(desc(agentApprovals.createdAt))
      .limit(Math.min(limit, 100));
  }

  async approve(id: string, userId: string, note?: string, tx?: any): Promise<void> {
    const db = tx ?? this.db;
    await db
      .update(agentApprovals)
      .set({
        status: 'APPROVED',
        decidedBy: userId,
        decidedAt: new Date(),
        decisionNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(agentApprovals.id, id));
  }

  async reject(id: string, userId: string, note?: string): Promise<void> {
    await this.db
      .update(agentApprovals)
      .set({
        status: 'REJECTED',
        decidedBy: userId,
        decidedAt: new Date(),
        decisionNote: note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(agentApprovals.id, id));
  }

  async expire(id: string): Promise<void> {
    await this.db
      .update(agentApprovals)
      .set({ status: 'EXPIRED', updatedAt: new Date() })
      .where(eq(agentApprovals.id, id));
  }
}
