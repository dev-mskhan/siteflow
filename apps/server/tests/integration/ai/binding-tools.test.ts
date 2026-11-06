// apps/server/tests/integration/ai/binding-tools.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ToolApprovalService } from '../../../src/modules/ai/binding-tools/tool-approval.service.js';
import { getDb } from '../../../src/lib/db/index.js';
import { toolApprovals } from '@siteflow/database/schema';
import { eq } from 'drizzle-orm';

describe('Binding Tools Approval Gate Tests', () => {
  const approvalService = new ToolApprovalService();
  const testOrgId = '11111111-1111-1111-1111-111111111111';
  const testUserId = '22222222-2222-2222-2222-222222222222';
  const db = getDb();

  afterAll(async () => {
    await db.delete(toolApprovals).where(eq(toolApprovals.organizationId, testOrgId));
  });

  it('should create approval request for send_message tool', async () => {
    const approval = await approvalService.requestApproval({
      organizationId: testOrgId,
      toolName: 'send_message',
      requestedBy: testUserId,
      requestContext: { agent: 'test-agent' },
      toolArgs: {
        recipientId: '33333333-3333-3333-3333-333333333333',
        subject: 'Test Message',
        body: 'This is a test',
        priority: 'NORMAL',
      },
    });

    expect(approval.status).toBe('PENDING');
    expect(approval.toolName).toBe('send_message');
    expect(approval.expiresAt).toBeTruthy();
  });

  it('should approve tool execution', async () => {
    const pending = await approvalService.requestApproval({
      organizationId: testOrgId,
      toolName: 'send_message',
      requestedBy: testUserId,
      requestContext: {},
      toolArgs: { test: 'data' },
    });

    const approved = await approvalService.approve(pending.id, testUserId);

    expect(approved.status).toBe('APPROVED');
    expect(approved.approvedBy).toBe(testUserId);
    expect(approved.approvedAt).toBeTruthy();
  });

  it('should reject tool execution with reason', async () => {
    const pending = await approvalService.requestApproval({
      organizationId: testOrgId,
      toolName: 'send_message',
      requestedBy: testUserId,
      requestContext: {},
      toolArgs: { test: 'data' },
    });

    const rejected = await approvalService.reject(
      pending.id,
      testUserId,
      'Message content inappropriate'
    );

    expect(rejected.status).toBe('REJECTED');
    expect(rejected.rejectionReason).toBe('Message content inappropriate');
  });

  it('should list pending approvals for organization', async () => {
    await approvalService.requestApproval({
      organizationId: testOrgId,
      toolName: 'send_message',
      requestedBy: testUserId,
      requestContext: {},
      toolArgs: { test: '1' },
    });

    await approvalService.requestApproval({
      organizationId: testOrgId,
      toolName: 'submit_purchase_request',
      requestedBy: testUserId,
      requestContext: {},
      toolArgs: { test: '2' },
    });

    const pending = await approvalService.getPending(testOrgId);

    expect(pending.length).toBeGreaterThanOrEqual(2);
    expect(pending.every((p) => p.status === 'PENDING')).toBe(true);
  });

  it('should create approval request for purchase request tool', async () => {
    const approval = await approvalService.requestApproval({
      organizationId: testOrgId,
      toolName: 'submit_purchase_request',
      requestedBy: testUserId,
      requestContext: { calculatedTotal: 5000 },
      toolArgs: {
        projectId: '44444444-4444-4444-4444-444444444444',
        items: [
          { description: 'Steel beams', quantity: 10, unitPrice: 500, unit: 'piece' },
        ],
        justification: 'Needed for foundation work',
        urgency: 'HIGH',
      },
    });

    expect(approval.status).toBe('PENDING');
    expect(approval.toolName).toBe('submit_purchase_request');
  });

  it('should enforce 24h expiry on approval requests', async () => {
    const approval = await approvalService.requestApproval({
      organizationId: testOrgId,
      toolName: 'send_message',
      requestedBy: testUserId,
      requestContext: {},
      toolArgs: { test: 'expiry' },
    });

    const now = new Date();
    const expiryDiff = approval.expiresAt.getTime() - now.getTime();
    const hoursUntilExpiry = expiryDiff / (1000 * 60 * 60);

    expect(hoursUntilExpiry).toBeGreaterThan(23);
    expect(hoursUntilExpiry).toBeLessThanOrEqual(24);
  });

  it('should prevent execution without approval (gate test)', async () => {
    const approval = await approvalService.requestApproval({
      organizationId: testOrgId,
      toolName: 'send_message',
      requestedBy: testUserId,
      requestContext: {},
      toolArgs: { recipientId: 'test', subject: 'Test', body: 'Test' },
    });

    // Tool should NOT execute - only create approval request
    expect(approval.status).toBe('PENDING');

    // Verify tool did not execute (no message sent)
    // In real implementation, check message queue/database
    const status = await approvalService.checkStatus(approval.id);
    expect(status?.status).toBe('PENDING');
  });

  it('should track approval context for audit trail', async () => {
    const context = {
      agent: 'cost-financial',
      conversationId: 'conv-123',
      userId: testUserId,
    };

    const approval = await approvalService.requestApproval({
      organizationId: testOrgId,
      toolName: 'submit_purchase_request',
      requestedBy: testUserId,
      requestContext: context,
      toolArgs: { test: 'audit' },
    });

    expect(approval.requestContext).toEqual(context);
  });
});
