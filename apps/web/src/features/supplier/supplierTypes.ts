/**
 * supplierTypes.ts — mirrors server DTOs exactly.
 *
 * Sources:
 *   SupplierDTO        → supplier/supplier.types.ts
 *   SupplierContactDTO → supplier/supplier.types.ts
 *   Validation         → @siteflow/shared supplier.schema.ts
 *
 * NOTES:
 *   - supplierCode: 1–50 chars
 *   - legalName / displayName: 1–500
 *   - email: valid email, max 254; website: valid URL, max 500
 *   - currencyCode: exactly 3 uppercase chars
 *   - notes: max 4000
 *   - contact.name: 1–300
 *   - List pagination: cursor + limit (1–100, default 50)
 */

// ── Enums ─────────────────────────────────────────────────────────────────────

export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';

export type SupplierType =
  | 'MATERIAL_SUPPLIER'
  | 'SERVICE_PROVIDER'
  | 'EQUIPMENT_SUPPLIER'
  | 'GENERAL_SUPPLIER';

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface SupplierDTO {
  id: string;
  organizationId: string;
  supplierCode: string;
  legalName: string;
  displayName: string;
  supplierType: SupplierType;
  status: SupplierStatus;
  taxReference: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  paymentTerms: string | null;
  currencyCode: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SupplierContactDTO {
  id: string;
  organizationId: string;
  supplierId: string;
  name: string;
  role: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── Input types ───────────────────────────────────────────────────────────────

export interface CreateSupplierInput {
  supplierCode: string;       // 1–50
  legalName: string;          // 1–500
  displayName: string;        // 1–500
  supplierType?: SupplierType;
  taxReference?: string;      // max 200
  email?: string;             // valid email, max 254
  phone?: string;             // max 50
  address?: string;           // max 1000
  website?: string;           // valid URL, max 500
  paymentTerms?: string;      // max 500
  currencyCode?: string;      // exactly 3 chars, uppercase
  notes?: string;             // max 4000
}

export interface UpdateSupplierInput {
  legalName?: string;
  displayName?: string;
  supplierType?: SupplierType;
  status?: SupplierStatus;
  taxReference?: string;
  email?: string | null;
  phone?: string;
  address?: string;
  website?: string | null;
  paymentTerms?: string;
  currencyCode?: string;
  notes?: string;
}

export interface CreateSupplierContactInput {
  name: string;               // 1–300
  role?: string;              // max 200
  email?: string;             // valid email, max 254
  phone?: string;             // max 50
  isPrimary?: boolean;
}

export interface UpdateSupplierContactInput {
  name?: string;
  role?: string;
  email?: string | null;
  phone?: string;
  isPrimary?: boolean;
  isActive?: boolean;
}

// ── List query ────────────────────────────────────────────────────────────────

export interface ListSuppliersQuery {
  cursor?: string;
  limit?: number;
  status?: SupplierStatus;
}
