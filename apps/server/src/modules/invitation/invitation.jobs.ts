// apps/server/src/modules/invitation/invitation.jobs.ts
export const ORG_QUEUES = {
  SEND_INVITATION_EMAIL: 'org:send-invitation-email',
  EXPIRE_INVITATIONS: 'org:expire-invitations',
} as const;

export interface SendInvitationEmailPayload {
  invitationId: string;
  organizationId: string;
  email: string;
  orgName: string;
  inviterName: string;
  token: string;
}

export interface ExpireInvitationsPayload extends Record<string, unknown> {
  // Cron job — no payload fields needed
}
