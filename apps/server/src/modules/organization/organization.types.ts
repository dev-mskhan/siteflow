// apps/server/src/modules/organization/organization.types.ts

export type OrgSettings = {
  timezone: string;
  locale: string;
  currency: string;
  dateFormat: string;
};

export interface OrgDTO {
  id: string;
  name: string;
  slug: string;
  status: string;
  settings: OrgSettings;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateOrgInput = {
  name: string;
  slug: string;
  settings?: Partial<OrgSettings>;
};

export type UpdateOrgInput = Partial<Pick<CreateOrgInput, 'name' | 'settings'>>;
