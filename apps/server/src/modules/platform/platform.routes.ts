// apps/server/src/modules/platform/platform.routes.ts
import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { createSuccessResponse } from '../../shared/response.js';
import { authenticate } from '../auth/auth.middleware.js';
import { requirePlatformPermission } from './platform-permission.middleware.js';
import { PlatformReadRepository, type PlatformCursor } from './platform-read.repository.js';

const readRepo = new PlatformReadRepository();

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

export const platformRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authenticate);
    protectedRoutes.addHook('preHandler', requirePlatformPermission('read:organizations'));

    protectedRoutes.get(
      '/organizations',
      { schema: { tags: ['Platform'], summary: 'List organizations (platform operators only)' } },
      handleListPlatformOrganizations,
    );
    protectedRoutes.get(
      '/accounts',
      { schema: { tags: ['Platform'], summary: 'List user accounts (platform operators only)' } },
      handleListPlatformAccounts,
    );
  });
};
