// apps/server/src/modules/ai/tools/definitions/binding.tools.ts
//
// Production BINDING tools — require human approval before execution.
//
// These tools go through the full approval gate in tool-factory.ts:
//   1. RBAC check (requiredPermission)
//   2. Tier gate: checkApprovalGate — must have APPROVED agent_approvals row
//      with matching approvedToolName + approvedArgsHash (exact-action binding)
//   3. Execute only after both gates pass
//
// The approval flow is owned by approval.service.ts — do not import it here.

import { z } from 'zod';
import { getDb } from '../../../../lib/db/index.js';
import { generateId } from '../../../../lib/id.js';
import { materialRequests, materialRequestItems } from '@siteflow/database/schema';
import { notificationService } from '../../../notification/notification.service.js';
import { registerTool } from '../tool-registry.js';

// ── 1. send_message ───────────────────────────────────────────────────────────
// Sends an in-app notification to a user or team member.
// Requires APPROVED binding approval before execution.

registerTool({
  name: 'send_message',
  description:
    'Send an in-app message or notification to a user. ' +
    'REQUIRES HUMAN APPROVAL before execution. ' +
    'Use for: alerting a team member about an issue, requesting information, ' +
    'or escalating a problem that needs human attention.',
  argsSchema: z.object({
    recipientId: z.string().uuid().describe('User ID of the recipient'),
    subject: z.string().max(200).describe('Message subject (shown as notification title)'),
    body: z.string().max(2000).describe('Message body text'),
    priority: z
      .enum(['LOW', 'NORMAL', 'HIGH', 'URGENT'])
      .default('NORMAL')
      .describe('Message priority. Use URGENT only for safety-critical issues.'),
  }),
  riskTier: 'BINDING',
  requiredPermission: 'communication.send',
  async execute(args, ctx) {
    // Create an in-app notification via the notification service.
    // The notification is persisted to the DB and delivered via realtime push.
    const notification = await notificationService.createNotification({
      organizationId: ctx.organizationId,
      projectId: ctx.projectId ?? null,
      recipientId: args.recipientId,
      eventType: 'ai.agent.message',
      channel: 'IN_APP',
      payload: {
        subject: args.subject,
        body: args.body,
        priority: args.priority,
        sentBy: ctx.userId,
        sentByAgent: ctx.agent,
        runId: ctx.runId,
      },
    });

    return {
      messageId: notification.id,
      sentAt: notification.createdAt.toISOString(),
      status: 'SENT',
      recipientId: args.recipientId,
      subject: args.subject,
      organizationId: ctx.organizationId,
    };
  },
});

// ── 2. submit_purchase_request ────────────────────────────────────────────────
// Creates a material request in the procurement module.
// Requires APPROVED binding approval before execution.

registerTool({
  name: 'submit_purchase_request',
  description:
    'Submit a material purchase request to the procurement team. ' +
    'REQUIRES HUMAN APPROVAL before execution. ' +
    'Use when materials or supplies are needed for a project task. ' +
    'Creates a DRAFT material request that procurement can action.',
  argsSchema: z.object({
    projectId: z.string().uuid().describe('Project this request is for'),
    items: z
      .array(
        z.object({
          materialId: z.string().uuid().describe('Material ID from the materials catalogue'),
          description: z.string().max(500).describe('Description of what is needed'),
          quantity: z.number().positive().describe('Quantity required'),
          unit: z.string().max(50).describe('Unit of measure (e.g. m², kg, each)'),
          requiredByDate: z.string().optional().describe('ISO date when material is needed'),
        }),
      )
      .min(1)
      .max(50),
    justification: z
      .string()
      .max(1000)
      .describe('Why this purchase is needed — justification for the procurement team'),
    priority: z
      .enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL'])
      .default('NORMAL')
      .describe('Request urgency'),
    deliveryLocation: z
      .string()
      .max(500)
      .optional()
      .describe('Where materials should be delivered on site'),
  }),
  riskTier: 'BINDING',
  requiredPermission: 'procurement.request.create',
  async execute(args, ctx) {
    const db = getDb();
    const requestId = generateId();

    // Build request number: MR-{projectId slice}-{timestamp}
    const requestNumber = `MR-${args.projectId.slice(0, 8).toUpperCase()}-${Date.now()}`;

    await db.transaction(async (tx) => {
      // Insert the material request header
      await tx.insert(materialRequests).values({
        id: requestId,
        organizationId: ctx.organizationId,
        projectId: args.projectId,
        requestNumber,
        requestedById: ctx.userId,
        status: 'DRAFT',
        priority: args.priority as 'LOW' | 'NORMAL' | 'HIGH' | 'CRITICAL',
        notes: args.justification,
        deliveryLocation: args.deliveryLocation ?? null,
      });

      // Insert line items
      for (const item of args.items) {
        await tx.insert(materialRequestItems).values({
          id: generateId(),
          organizationId: ctx.organizationId,
          materialRequestId: requestId,
          materialId: item.materialId,
          description: item.description,
          quantity: item.quantity.toString(),
          unit: item.unit,
          requiredByDate: item.requiredByDate ?? null,
        });
      }
    });

    return {
      requestId,
      requestNumber,
      projectId: args.projectId,
      organizationId: ctx.organizationId,
      status: 'DRAFT',
      itemCount: args.items.length,
      priority: args.priority,
      submittedAt: new Date().toISOString(),
      submittedBy: ctx.userId,
    };
  },
});
