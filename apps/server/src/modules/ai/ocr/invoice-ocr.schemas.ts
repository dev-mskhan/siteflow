// apps/server/src/modules/ai/ocr/invoice-ocr.schemas.ts
import { z } from 'zod';

export const extractInvoiceSchemaDoc = {
  tags: ['OCR'],
  summary: 'Extract invoice data using OCR',
  params: z.object({
    organizationId: z.string().uuid(),
    projectId: z.string().uuid(),
  }),
  body: z.object({
    imageBase64: z.string().min(100).describe('Base64-encoded invoice image'),
    matchPo: z.boolean().optional().default(false).describe('Attempt to match with existing PO'),
  }),
};
