// apps/server/src/modules/invitation/invitation.types.ts

export interface InvitationDTO {
  id: string;
  organizationId: string;
  email: string;
  roleId: string;
  roleName?: string;
  status: string;
  expiresAt: string;
  acceptedAt: string | null;
  invitedBy: string;
  createdAt: string;
}

export type CreateInvitationInput = {
  email: string;
  roleId: string;
  orgName?: string;
  inviterName?: string;
};
