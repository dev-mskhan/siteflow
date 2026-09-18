// apps/server/src/modules/membership/membership.types.ts

export interface MemberDTO {
  id: string;
  organizationId: string;
  userId: string;
  roleId: string;
  roleName?: string;
  userEmail?: string;
  userFirstName?: string;
  userLastName?: string | null;
  status: string;
  joinedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export type UpdateMemberInput = {
  roleId?: string;
  status?: 'ACTIVE' | 'SUSPENDED';
};
