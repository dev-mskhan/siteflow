import { z } from 'zod';

export const createSupplierSchema = z.object({
  supplierCode: z.string().trim().min(1).max(50),
  legalName: z.string().trim().min(1).max(500),
  displayName: z.string().trim().min(1).max(500),
  supplierType: z
    .enum(['MATERIAL_SUPPLIER', 'SERVICE_PROVIDER', 'EQUIPMENT_SUPPLIER', 'GENERAL_SUPPLIER'])
    .optional(),
  taxReference: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(1000).optional(),
  website: z.string().trim().url().max(500).optional(),
  paymentTerms: z.string().trim().max(500).optional(),
  currencyCode: z.string().trim().length(3).toUpperCase().optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const updateSupplierSchema = z.object({
  legalName: z.string().trim().min(1).max(500).optional(),
  displayName: z.string().trim().min(1).max(500).optional(),
  supplierType: z
    .enum(['MATERIAL_SUPPLIER', 'SERVICE_PROVIDER', 'EQUIPMENT_SUPPLIER', 'GENERAL_SUPPLIER'])
    .optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
  taxReference: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(254).optional().nullable(),
  phone: z.string().trim().max(50).optional(),
  address: z.string().trim().max(1000).optional(),
  website: z.string().trim().url().max(500).optional().nullable(),
  paymentTerms: z.string().trim().max(500).optional(),
  currencyCode: z.string().trim().length(3).toUpperCase().optional(),
  notes: z.string().trim().max(4000).optional(),
});

export const createSupplierContactSchema = z.object({
  name: z.string().trim().min(1).max(300),
  role: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(254).optional(),
  phone: z.string().trim().max(50).optional(),
  isPrimary: z.boolean().optional().default(false),
});

export const updateSupplierContactSchema = z.object({
  name: z.string().trim().min(1).max(300).optional(),
  role: z.string().trim().max(200).optional(),
  email: z.string().trim().email().max(254).optional().nullable(),
  phone: z.string().trim().max(50).optional(),
  isPrimary: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const listSuppliersQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  status: z.enum(['ACTIVE', 'INACTIVE', 'SUSPENDED']).optional(),
});
