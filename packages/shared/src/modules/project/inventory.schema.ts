// packages/shared/src/modules/project/inventory.schema.ts
import { z } from 'zod';

export const adjustInventorySchema = z.object({
  materialId: z.string().min(1),
  location: z.string().min(1).default('default'),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/)
    .refine((v) => parseFloat(v) > 0, 'quantity must be > 0'),
  unitCode: z.string().trim().min(1).max(20).toUpperCase(),
  direction: z.enum(['IN', 'OUT']),
  reason: z.string().trim().min(1).max(2000),
});

export const transferInventorySchema = z.object({
  materialId: z.string().min(1),
  quantity: z
    .string()
    .regex(/^\d+(\.\d{1,3})?$/)
    .refine((v) => parseFloat(v) > 0, 'quantity must be > 0'),
  unitCode: z.string().trim().min(1).max(20).toUpperCase(),
  fromLocation: z.string().min(1),
  toLocation: z.string().min(1),
});

export type AdjustInventoryInput = z.infer<typeof adjustInventorySchema>;
export type TransferInventoryInput = z.infer<typeof transferInventorySchema>;
