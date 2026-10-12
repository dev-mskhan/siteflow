// apps/server/src/modules/platform/platform.routes.ts
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createSuccessResponse } from '../../shared/response.js';
import { authenticate } from '../auth/auth.middleware.js';
import { UnauthorizedError } from '../auth/auth.errors.js';
import { requirePlatformPermission } from './platform-permission.middleware.js';
import { PlatformReadRepository, type PlatformCursor } from './platform-read.repository.js';
import {
  accountLifecycleSchemaDoc,
  approveOrgSuspensionSchemaDoc,
  approveSupportGrantSchemaDoc,
  listPlatformAccountsSchemaDoc,
  requestSupportGrantSchemaDoc,
  revokeSupportGrantSchemaDoc,
  useSupportGrantSchemaDoc,
  listPlatformOrganizationsSchemaDoc,
  organizationBillingSchemaDoc,
  reactivateOrgSchemaDoc,
  requestOrgSuspensionSchemaDoc,
  webhookInboxSchemaDoc,
  webhookRecoverySchemaDoc,
} from './docs/platform.schemas.js';
import {
  LIFECYCLE_REASON_CODES,
  platformLifecycleService as lifecycleService,
  type LifecycleActionInput,
} from './platform-lifecycle.service.js';
import { platformBillingService } from './platform-billing.service.js';
import {
  SUPPORT_GRANT_SCOPES,
  SUPPORT_GRANT_MAX_MINUTES,
  platformSupportGrantService as grantService,
} from './platform-support-grant.service.js';

const readRepo = new PlatformReadRepository();

const lifecycleBodySchema = z.object({
  password: z.string().min(1).max(256),
  reasonCode: z.enum(LIFECYCLE_REASON_CODES),
  reasonNote: z.string().trim().min(10).max(500),
});

const supportGrantRequestSchema = lifecycleBodySchema.extend({
  operatorUserId: z.string().min(1).max(64),
  organizationId: z.string().min(1).max(64),
  scopes: z.array(z.enum(SUPPORT_GRANT_SCOPES)).min(1).max(SUPPORT_GRANT_SCOPES.length),
});

const supportGrantApproveSchema = z.object({
  password: z.string().min(1).max(256),
  durationMinutes: z.number().int().min(1).max(SUPPORT_GRANT_MAX_MINUTES),
});

const supportGrantRevokeSchema = z.object({
  password: z.string().min(1).max(256),
});

const supportGrantScopeQuerySchema = z.object({
  scope: z.enum(SUPPORT_GRANT_SCOPES),
});

function toActionInput(
  request: FastifyRequest,
  body: z.infer<typeof lifecycleBodySchema>,
): LifecycleActionInput {
  if (!request.user) {
    throw new UnauthorizedError('Authentication required');
  }
  return {
    actorUserId: request.user.sub,
    password: body.password,
    reasonCode: body.reasonCode,
    reasonNote: body.reasonNote,
  };
}

const cursorSchema = z
  .string()
  .max(256)
  .optional()
  .transform((value, ctx): PlatformCursor | undefined => {
    if (!value) return undefined;
    try {
      const decoded = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
      const parsed = z.object({ t: z.string().datetime(), i: z.string().min(1).max(64) }).parse(decoded);
      return { createdAt: new Date(parsed.t), id: parsed.i };
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Invalid cursor' });
      return z.NEVER;
    }
  });

const orgListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: cursorSchema,
  search: z.string().trim().min(1).max(64).optional(),
});

const accountListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(25),
  cursor: cursorSchema,
  emailPrefix: z.string().trim().min(1).max(64).optional(),
});

function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ t: createdAt.toISOString(), i: id })).toString('base64url');
}

export async function handleListPlatformOrganizations(request: FastifyRequest, reply: FastifyReply) {
  const query = orgListQuerySchema.parse(request.query);
  const { rows, hasMore } = await readRepo.listOrganizations({
    limit: query.limit,
    cursor: query.cursor,
    search: query.search,
  });
  const last = rows[rows.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
  return reply.send(
    createSuccessResponse({ organizations: rows }, { limit: query.limit, nextCursor }),
  );
}

export async function handleListPlatformAccounts(request: FastifyRequest, reply: FastifyReply) {
  const query = accountListQuerySchema.parse(request.query);
  const { rows, hasMore } = await readRepo.listAccounts({
    limit: query.limit,
    cursor: query.cursor,
    emailPrefix: query.emailPrefix,
  });
  const last = rows[rows.length - 1];
  const nextCursor = hasMore && last ? encodeCursor(last.createdAt, last.id) : null;
  return reply.send(createSuccessResponse({ accounts: rows }, { limit: query.limit, nextCursor }));
}

const writeRateLimit = { rateLimit: { max: 30, timeWindow: '1 minute' } };

export const platformRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authenticate);
    protectedRoutes.addHook('preHandler', requirePlatformPermission('read:organizations'));

    protectedRoutes.get(
      '/organizations',
      { schema: listPlatformOrganizationsSchemaDoc },
      handleListPlatformOrganizations,
    );
    protectedRoutes.get(
      '/accounts',
      { schema: listPlatformAccountsSchemaDoc },
      handleListPlatformAccounts,
    );
  });

  fastify.register(async (billingReadRoutes) => {
    billingReadRoutes.addHook('preHandler', authenticate);
    billingReadRoutes.addHook('preHandler', requirePlatformPermission('read:billing'));

    billingReadRoutes.get<{ Params: { orgId: string } }>(
      '/organizations/:orgId/billing',
      { schema: organizationBillingSchemaDoc },
      async (request, reply) => {
        const view = await platformBillingService.getOrganizationBillingView(request.params.orgId);
        return reply.send(createSuccessResponse(view));
      },
    );
    billingReadRoutes.get(
      '/billing/webhook-inbox',
      { schema: webhookInboxSchemaDoc },
      async (_request, reply) => {
        const summary = await platformBillingService.getWebhookInboxSummary();
        return reply.send(createSuccessResponse(summary));
      },
    );
  });

  fastify.register(async (billingWriteRoutes) => {
    billingWriteRoutes.addHook('preHandler', authenticate);
    billingWriteRoutes.addHook('preHandler', requirePlatformPermission('write:billing_sync'));

    billingWriteRoutes.post(
      '/billing/webhook-recovery',
      { schema: webhookRecoverySchemaDoc, config: writeRateLimit },
      async (request, reply) => {
        const body = lifecycleBodySchema.parse(request.body);
        const result = await platformBillingService.triggerWebhookRecovery(
          toActionInput(request, body),
        );
        return reply.code(202).send(createSuccessResponse(result));
      },
    );
  });

  fastify.register(async (writeRoutes) => {
    writeRoutes.addHook('preHandler', authenticate);
    writeRoutes.addHook(
      'preHandler',
      requirePlatformPermission('write:organization_lifecycle'),
    );

    writeRoutes.post<{ Params: { userId: string } }>(
      '/accounts/:userId/suspend',
      { schema: accountLifecycleSchemaDoc('suspend'), config: writeRateLimit },
      async (request, reply) => {
        const body = lifecycleBodySchema.parse(request.body);
        await lifecycleService.suspendAccount(request.params.userId, toActionInput(request, body));
        return reply.send(createSuccessResponse({ status: 'SUSPENDED' }));
      },
    );
    writeRoutes.post<{ Params: { userId: string } }>(
      '/accounts/:userId/reactivate',
      { schema: accountLifecycleSchemaDoc('reactivate'), config: writeRateLimit },
      async (request, reply) => {
        const body = lifecycleBodySchema.parse(request.body);
        await lifecycleService.reactivateAccount(request.params.userId, toActionInput(request, body));
        return reply.send(createSuccessResponse({ status: 'ACTIVE' }));
      },
    );
    writeRoutes.post<{ Params: { orgId: string } }>(
      '/organizations/:orgId/suspension-requests',
      { schema: requestOrgSuspensionSchemaDoc, config: writeRateLimit },
      async (request, reply) => {
        const body = lifecycleBodySchema.parse(request.body);
        const result = await lifecycleService.requestOrganizationSuspension(
          request.params.orgId,
          toActionInput(request, body),
        );
        return reply.code(201).send(createSuccessResponse(result));
      },
    );
    writeRoutes.post<{ Params: { approvalId: string } }>(
      '/approvals/:approvalId/approve',
      { schema: approveOrgSuspensionSchemaDoc, config: writeRateLimit },
      async (request, reply) => {
        const body = lifecycleBodySchema.parse(request.body);
        await lifecycleService.approveOrganizationSuspension(
          request.params.approvalId,
          toActionInput(request, body),
        );
        return reply.send(createSuccessResponse({ status: 'SUSPENDED' }));
      },
    );
    writeRoutes.post<{ Params: { orgId: string } }>(
      '/organizations/:orgId/reactivate',
      { schema: reactivateOrgSchemaDoc, config: writeRateLimit },
      async (request, reply) => {
        const body = lifecycleBodySchema.parse(request.body);
        await lifecycleService.reactivateOrganization(
          request.params.orgId,
          toActionInput(request, body),
        );
        return reply.send(createSuccessResponse({ status: 'ACTIVE' }));
      },
    );
  });

  fastify.register(async (grantRoutes) => {
    grantRoutes.addHook('preHandler', authenticate);
    grantRoutes.addHook('preHandler', requirePlatformPermission('manage:support_grants'));

    grantRoutes.post(
      '/support-grants',
      { schema: requestSupportGrantSchemaDoc, config: writeRateLimit },
      async (request, reply) => {
        const body = supportGrantRequestSchema.parse(request.body);
        const result = await grantService.requestGrant({
          ...toActionInput(request, body),
          operatorUserId: body.operatorUserId,
          organizationId: body.organizationId,
          scopes: body.scopes,
        });
        return reply.code(201).send(createSuccessResponse(result));
      },
    );
    grantRoutes.post<{ Params: { grantId: string } }>(
      '/support-grants/:grantId/approve',
      { schema: approveSupportGrantSchemaDoc, config: writeRateLimit },
      async (request, reply) => {
        const body = supportGrantApproveSchema.parse(request.body);
        if (!request.user) throw new UnauthorizedError('Authentication required');
        const result = await grantService.approveGrant(request.params.grantId, {
          actorUserId: request.user.sub,
          password: body.password,
          durationMinutes: body.durationMinutes,
        });
        return reply.send(createSuccessResponse(result));
      },
    );
    grantRoutes.post<{ Params: { grantId: string } }>(
      '/support-grants/:grantId/revoke',
      { schema: revokeSupportGrantSchemaDoc, config: writeRateLimit },
      async (request, reply) => {
        const body = supportGrantRevokeSchema.parse(request.body);
        if (!request.user) throw new UnauthorizedError('Authentication required');
        await grantService.revokeGrant(request.params.grantId, {
          actorUserId: request.user.sub,
          password: body.password,
        });
        return reply.send(createSuccessResponse({ status: 'revoked' }));
      },
    );
  });

  fastify.register(async (grantUseRoutes) => {
    grantUseRoutes.addHook('preHandler', authenticate);
    grantUseRoutes.addHook('preHandler', requirePlatformPermission('use:support_grant'));

    grantUseRoutes.get<{ Params: { grantId: string }; Querystring: { scope: string } }>(
      '/support-grants/:grantId/organization',
      { schema: useSupportGrantSchemaDoc },
      async (request, reply) => {
        const scope = supportGrantScopeQuerySchema.parse(request.query).scope;
        if (!request.user) throw new UnauthorizedError('Authentication required');
        const view = await grantService.useGrant(request.params.grantId, request.user.sub, scope);
        return reply.send(createSuccessResponse(view));
      },
    );
  });
};
