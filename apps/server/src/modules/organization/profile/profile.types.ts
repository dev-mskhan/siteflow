// apps/server/src/modules/organization/profile/profile.types.ts

export interface OrgProfileDTO {
  organizationId: string;
  legalName: string | null;
  businessName: string | null;
  businessType: string | null;
  registrationNumber: string | null;
  taxIdentificationNumber: string | null;
  primaryEmail: string | null;
  primaryPhone: string | null;
  secondaryPhone: string | null;
  website: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  stateProvince: string | null;
  postalCode: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateProfileInput = {
  legalName?: string | null;
  businessName?: string | null;
  businessType?: string | null;
  registrationNumber?: string | null;
  taxIdentificationNumber?: string | null;
  primaryEmail?: string | null;
  primaryPhone?: string | null;
  secondaryPhone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  stateProvince?: string | null;
  postalCode?: string | null;
  country?: string | null;
};
