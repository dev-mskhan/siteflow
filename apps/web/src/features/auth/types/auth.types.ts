/**
 * SiteFlow Auth Types
 * Canonical TypeScript interfaces and types aligned with @siteflow/shared
 */

export type {
  UserDTO,
  SessionDTO,
  RegisterInput,
  LoginInput,
  VerifyEmailInput,
  ResendVerificationInput,
  ForgotPasswordInput,
  ResetPasswordInput,
  ChangePasswordInput,
  SessionIdParamInput,
} from '@siteflow/shared';

export interface AuthResponse {
  user: import('@siteflow/shared').UserDTO;
}

export interface SessionsResponse {
  sessions: import('@siteflow/shared').SessionDTO[];
  nextCursor?: string;
}

export interface InvitationAcceptResponse {
  organizationId: string;
  roleName: string;
  message?: string;
}
