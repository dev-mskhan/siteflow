// apps/server/src/modules/ai/tools/definitions/binding.tools.ts
// Binding tools - require approval before execution

import { z } from 'zod';
import { registerTool } from '../registry.js';
import { ToolApprovalService } from '../../binding-tools/tool-approval.service.js';

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
  riskTier: 'BINDING', // New risk tier
  requiredPermission: 'communication.send',
  async execute(args, ctx) {
    // Create approval request instead of executing directly
    const approval = await approvalService.requestApproval({
      organizationId: ctx.organizationId,
      toolName: 'send_message',
      requestedBy: ctx.userId,
      requestContext: ctx,
      toolArgs: args,
    });

    return {
      status: 'APPROVAL_REQUIRED',
      approvalId: approval.id,
      message:
        'Message draft created. Awaiting user approval before sending. Check approval queue.',
      expiresAt: approval.expiresAt,
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

    // Create approval request
    const approval = await approvalService.requestApproval({
      organizationId: ctx.organizationId,
      toolName: 'submit_purchase_request',
      requestedBy: ctx.userId,
      requestContext: { ...ctx, calculatedTotal: total },
      toolArgs: args,
    });

    return {
      status: 'APPROVAL_REQUIRED',
      approvalId: approval.id,
      estimatedTotal: total,
      message:
        'Purchase request created. Awaiting procurement approval before submission. Check approval queue.',
      expiresAt: approval.expiresAt,
    };
  },
});
