// packages/shared/src/modules/project/material-request.schema.ts
import { z } from 'zod';

export const MATERIAL_REQUEST_STATUSES = [
  'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED',
  'PARTIALLY_ORDERED', 'ORDERED', 'FULFILLED', 'CANCELLED', 'REJECTED',
] as const;

const materialRequestItemSchema = z.object({
  materialId: z.string().min(1),
  description: z.string().trim().max(500).optional(),
  quantity: z.string().regex(/^\d+(\.\d{1,3})?$/).refine((v) => parseFloat(v) > 0, 'quantity must be > 0'),
  unitCode: z.string().trim().min(1).max(20).toUpperCase(),
  requiredByDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  taskId: z.string().optional(),
  phaseId: z.string().optional(),
  costCodeId: z.string().optional(),
  boqLineId: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const createMaterialRequestSchema = z.object({
  requiredByDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deliveryLocation: z.string().trim().max(500).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  notes: z.string().trim().max(4000).optional(),
  items: z.array(materialRequestItemSchema).min(1),
});

export const updateMaterialRequestSchema = z.object({
  requiredByDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  deliveryLocation: z.string().trim().max(500).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'URGENT']).optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const listMaterialRequestsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(MATERIAL_REQUEST_STATUSES).optional(),
});

export type CreateMaterialRequestInput = z.infer<typeof createMaterialRequestSchema>;
export type UpdateMaterialRequestInput = z.infer<typeof updateMaterialRequestSchema>;
export type ListMaterialRequestsQuery = z.infer<typeof listMaterialRequestsQuerySchema>;
