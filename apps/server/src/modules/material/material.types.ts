export type MaterialStatus = 'ACTIVE' | 'INACTIVE';
export type MaterialType = 'MATERIAL' | 'EQUIPMENT' | 'CONSUMABLE' | 'SERVICE' | 'OTHER';

export interface MaterialDTO {
  id: string;
  organizationId: string;
  materialCode: string;
  name: string;
  description: string | null;
  category: string | null;
  defaultUnitCode: string;
  materialType: MaterialType;
  status: MaterialStatus;
  defaultTaxCode: string | null;
  defaultCurrencyCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMaterialInput {
  materialCode: string;
  name: string;
  description?: string;
  category?: string;
  defaultUnitCode: string;
  materialType?: MaterialType;
  defaultTaxCode?: string;
  defaultCurrencyCode?: string;
}

export interface UpdateMaterialInput {
  name?: string;
  description?: string;
  category?: string;
  defaultUnitCode?: string;
  materialType?: MaterialType;
  status?: MaterialStatus;
  defaultTaxCode?: string;
  defaultCurrencyCode?: string;
}

export interface ListMaterialsQuery {
  cursor?: string;
  limit?: number;
  status?: MaterialStatus;
  category?: string;
}
