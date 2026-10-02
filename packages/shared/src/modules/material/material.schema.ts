// packages/shared/src/modules/material/material.schema.ts
import { z } from 'zod';

export const createMaterialSchema = z.object({
  materialCode: z.string().trim().min(1).max(100),
  name: z.string().trim().min(1).max(500),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(200).optional(),
  defaultUnitCode: z.string().trim().min(1).max(20).toUpperCase(),
  materialType: z.enum(['MATERIAL', 'EQUIPMENT', 'CONSUMABLE', 'SERVICE', 'OTHER']).optional(),
  defaultTaxCode: z.string().trim().max(50).optional(),
  defaultCurrencyCode: z.string().trim().length(3).toUpperCase().optional(),
});

export const updateMaterialSchema = z.object({
  name: z.string().trim().min(1).max(500).optional(),
  description: z.string().trim().max(2000).optional(),
  category: z.string().trim().max(200).optional(),
  defaultUnitCode: z.string().trim().min(1).max(20).toUpperCase().optional(),
  materialType: z.enum(['MATERIAL', 'EQUIPMENT', 'CONSUMABLE', 'SERVICE', 'OTHER']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  defaultTaxCode: z.string().trim().max(50).optional(),
  defaultCurrencyCode: z.string().trim().length(3).toUpperCase().optional(),
});

export const listMaterialsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  category: z.string().trim().optional(),
});

export type CreateMaterialInput = z.infer<typeof createMaterialSchema>;
export type UpdateMaterialInput = z.infer<typeof updateMaterialSchema>;
export type ListMaterialsQuery = z.infer<typeof listMaterialsQuerySchema>;
