// apps/server/src/modules/ai/tools/definitions/binding.tools.ts
// Binding tools - require approval before execution

import { z } from 'zod';
import { registerTool } from '../tool-registry.js';

const approvalService = new ToolApprovalService();

// ── 1. send_message (Communication binding tool) ──────────────────────────────
registerTool({
  name: 'send_message',
  description:
    'Send a message or notification to a user or team. ' +
    'REQUIRES APPROVAL before execution. Creates approval request that user must confirm.',
  argsSchema: z.object({
    recipientId: z.string().uuid().describe('User ID to send message to'),
    subject: z.string().max(200).describe('Message subject'),
    body: z.string().max(2000).describe('Message body'),
    priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).default('NORMAL'),
  }),
  riskTier: 'BINDING',
  requiredPermission: 'communication.send',
  async execute(args, ctx) {
    // TODO: Implement actual message sending (email/notification service)
    return {
      messageId: 'msg_' + Date.now(),
      sentAt: new Date().toISOString(),
      status: 'SENT',
      recipient: args.recipientId,
      subject: args.subject,
    };
  },
});

// ── 2. submit_purchase_request (Procurement binding tool) ─────────────────────
registerTool({
  name: 'submit_purchase_request',
  description:
    'Submit a purchase request for materials or services. ' +
    'REQUIRES APPROVAL before execution. Creates approval request that procurement must confirm.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('Project ID'),
    items: z.array(
      z.object({
        description: z.string(),
        quantity: z.number().positive(),
        unitPrice: z.number().positive(),
        unit: z.string(),
      })
    ),
    vendor: z.string().optional(),
    justification: z.string().max(1000).describe('Why this purchase is needed'),
    urgency: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']).default('MEDIUM'),
  }),
  riskTier: 'BINDING',
  requiredPermission: 'procurement.request.create',
  async execute(args, ctx) {
    // Calculate total
    const total = args.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);

    // TODO: Implement actual purchase request creation
    return {
      requestId: 'pr_' + Date.now(),
      projectId: args.projectId,
      status: 'SUBMITTED',
      estimatedTotal: total,
      submittedAt: new Date().toISOString(),
      submittedBy: ctx.userId,
    };
  },
});
