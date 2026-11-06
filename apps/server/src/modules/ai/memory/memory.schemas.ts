// apps/server/src/modules/ai/memory/memory.schemas.ts
import { z } from 'zod';

export const listMemorySchemaDoc = {
  tags: ['AI Memory'],
  summary: 'List all memory items for organization',
  params: z.object({
    organizationId: z.string().uuid(),
  }),
};

export const getMemorySchemaDoc = {
  tags: ['AI Memory'],
  summary: 'Get a specific memory item',
  params: z.object({
    organizationId: z.string().uuid(),
    key: z.string(),
  }),
};

export const setMemorySchemaDoc = {
  tags: ['AI Memory'],
  summary: 'Set a memory item (admin only)',
  params: z.object({
    organizationId: z.string().uuid(),
    key: z.string(),
  }),
  body: z.object({
    value: z.unknown(),
  }),
};

export const deleteMemorySchemaDoc = {
  tags: ['AI Memory'],
  summary: 'Delete a memory item or clear all (admin only)',
  params: z.object({
    organizationId: z.string().uuid(),
    key: z.string().optional(),
  }),
};
