// apps/server/src/modules/ai/okf/okf.schemas.ts
import { z } from 'zod';

export const listPagesSchemaDoc = {
  tags: ['OKF'],
  summary: 'List OKF pages',
  params: z.object({
    organizationId: z.string().uuid(),
  }),
  querystring: z.object({
    status: z.enum(['DRAFT', 'APPROVED', 'REJECTED', 'ARCHIVED']).optional(),
    pagePath: z.string().optional(),
  }),
};

export const getPageSchemaDoc = {
  tags: ['OKF'],
  summary: 'Get OKF page details',
  params: z.object({
    organizationId: z.string().uuid(),
    pageId: z.string().uuid(),
  }),
};

export const approvePageSchemaDoc = {
  tags: ['OKF'],
  summary: 'Approve OKF page (admin only)',
  params: z.object({
    organizationId: z.string().uuid(),
    pageId: z.string().uuid(),
  }),
  body: z.object({
    approvalNotes: z.string().max(1000).optional(),
  }),
};

export const rejectPageSchemaDoc = {
  tags: ['OKF'],
  summary: 'Reject OKF page (admin only)',
  params: z.object({
    organizationId: z.string().uuid(),
    pageId: z.string().uuid(),
  }),
  body: z.object({
    approvalNotes: z.string().max(1000).optional(),
  }),
};

export const deletePageSchemaDoc = {
  tags: ['OKF'],
  summary: 'Delete OKF page (admin only)',
  params: z.object({
    organizationId: z.string().uuid(),
    pageId: z.string().uuid(),
  }),
};
