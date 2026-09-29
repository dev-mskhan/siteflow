export type SupplierStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
export type SupplierType = 'MATERIAL_SUPPLIER' | 'SERVICE_PROVIDER' | 'EQUIPMENT_SUPPLIER' | 'GENERAL_SUPPLIER';

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

export interface CreateSupplierInput {
  supplierCode: string;
  legalName: string;
  displayName: string;
  supplierType?: SupplierType;
  taxReference?: string;
  email?: string;
  phone?: string;
  address?: string;
  website?: string;
  paymentTerms?: string;
  currencyCode?: string;
  notes?: string;
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
  name: string;
  role?: string;
  email?: string;
  phone?: string;
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

export interface ListSuppliersQuery {
  cursor?: string;
  limit?: number;
  status?: SupplierStatus;
}
