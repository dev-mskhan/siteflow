import { z } from 'zod';

export const documentCategorySchema = z.enum([
  'DRAWING',
  'SPECIFICATION',
  'PERMIT',
  'CERTIFICATE',
  'REPORT',
  'PHOTO',
  'VIDEO',
  'CONTRACT',
  'INVOICE',
  'OTHER',
]);

export const documentStatusSchema = z.enum([
  'PENDING_UPLOAD',
  'ACTIVE',
  'SUPERSEDED',
  'ARCHIVED',
  'DELETED',
]);

export const documentAccessSchema = z.enum([
  'PROJECT_MEMBERS',
  'PROJECT_MANAGERS_ONLY',
  'ADMIN_ONLY',
]);

const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
});

const fileNameSchema = z
  .string()
  .min(1)
  .max(255)
  .refine((value) => !/[\\/\\0]/.test(value), 'File name must not contain a path');

const contentTypeSchema = z
  .string()
  .min(3)
  .max(255)
  .regex(/^[\w.+-]+\/[\w.+-]+$/);

export const createDocumentSchema = z.object({
  title: z.string().trim().min(1).max(500),
  category: documentCategorySchema,
  fileName: fileNameSchema,
  contentType: contentTypeSchema,
  fileSize: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  description: z.string().max(10000).optional(),
  accessPolicy: documentAccessSchema.optional(),
  expiryDate: dateSchema.optional(),
});

export const completeDocumentSchema = z.object({
  checksum: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

export const listDocumentsQuerySchema = z.object({
  cursor: z.string().min(1).max(512).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  category: documentCategorySchema.optional(),
  status: documentStatusSchema.optional(),
});

export const updateDocumentSchema = z
  .object({
    title: z.string().trim().min(1).max(500).optional(),
    description: z.string().max(10000).nullable().optional(),
    accessPolicy: documentAccessSchema.optional(),
    expiryDate: dateSchema.nullable().optional(),
  })
  .refine((value) => Object.keys(value).length > 0, 'At least one field must be provided');

export const createDocumentVersionSchema = z.object({
  fileName: fileNameSchema,
  contentType: contentTypeSchema,
  fileSize: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  notes: z.string().max(10000).optional(),
});

export const completeDocumentVersionSchema = completeDocumentSchema;

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type CompleteDocumentInput = z.infer<typeof completeDocumentSchema>;
export type ListDocumentsQuery = z.infer<typeof listDocumentsQuerySchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;
export type CreateDocumentVersionInput = z.infer<typeof createDocumentVersionSchema>;
