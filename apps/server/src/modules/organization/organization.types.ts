// apps/server/src/modules/organization/organization.types.ts

export interface OrgDTO {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateOrgInput = {
  name: string;
  slug?: string; // optional — derived from name if omitted
};

export type UpdateOrgInput = Partial<Pick<CreateOrgInput, 'name'>>;
