import { z } from 'zod';

export const BOQ_CSV_MAX_BYTES = 2 * 1024 * 1024;

const id = z.string().trim().min(1).max(128);
const title = z.string().trim().min(1).max(160);
const currencyCode = z.string().regex(/^[A-Z]{3}$/);
const expectedVersion = z.number().int().positive();

export const createBoqSchema = z
  .object({
    title,
    description: z.string().trim().max(5000).nullable().optional(),
    currencyCode,
  })
  .strict();

export const reviseBoqSchema = z
  .object({
    expectedVersion,
    reason: z.string().trim().min(10).max(500),
  })
  .strict();

export const boqImportPreviewSchema = z
  .object({
    csvText: z.string().min(1).max(BOQ_CSV_MAX_BYTES),
    expectedVersion,
  })
  .strict();

export const boqImportCommitSchema = z
  .object({
    importId: id,
    csvText: z.string().min(1).max(BOQ_CSV_MAX_BYTES),
    expectedVersion,
  })
  .strict();

export const boqTransitionSchema = z
  .object({ expectedVersion })
  .strict();

export const boqItemMappingSchema = z
  .object({
    costCodeId: id.nullable(),
    expectedVersion,
  })
  .strict();

export const boqParamsSchema = z
  .object({
    organizationId: id,
    projectId: id,
    boqId: id.optional(),
    revisionId: id.optional(),
    itemId: id.optional(),
    importId: id.optional(),
  })
  .strict();

export const boqListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(256).optional(),
    status: z.enum(['DRAFT', 'IN_REVIEW', 'APPROVED', 'LOCKED']).optional(),
  })
  .strict();

export const boqRevisionListQuerySchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(25),
    cursor: z.string().max(256).optional(),
  })
  .strict();

export const boqExportQuerySchema = z
  .object({
    revisionId: id.optional(),
  })
  .strict();

export type CreateBoqInput = z.infer<typeof createBoqSchema>;
export type ReviseBoqInput = z.infer<typeof reviseBoqSchema>;
export type BoqImportPreviewInput = z.infer<typeof boqImportPreviewSchema>;
export type BoqImportCommitInput = z.infer<typeof boqImportCommitSchema>;
export type BoqTransitionInput = z.infer<typeof boqTransitionSchema>;
export type BoqItemMappingInput = z.infer<typeof boqItemMappingSchema>;
