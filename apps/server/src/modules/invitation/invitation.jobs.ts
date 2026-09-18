// apps/server/src/modules/invitation/invitation.jobs.ts
export const ORG_QUEUES = {
  SEND_INVITATION_EMAIL: 'org:send-invitation-email',
} as const;

export interface SendInvitationEmailPayload {
  invitationId: string;
  organizationId: string;
  email: string;
  orgName: string;
  inviterName: string;
  token: string;
}
