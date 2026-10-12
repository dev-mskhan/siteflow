/**
 * SiteFlow Authentication API Client
 * Connects to Fastify /api/v1/auth and /api/v1/invitations endpoints
 */

import { apiClient } from '../../../lib/api/index';
import type {
  LoginInput,
  RegisterInput,
  ChangePasswordInput,
  UserDTO,
  SessionDTO,
} from '../types/auth.types';

export const authApi = {
  /**
   * Log in with email and password
   */
  async login(credentials: LoginInput): Promise<{ user: UserDTO }> {
    return apiClient.post<{ user: UserDTO }>('/auth/login', credentials);
  },

  /**
   * Register a new user account
   */
  async register(data: RegisterInput): Promise<{ user: UserDTO }> {
    return apiClient.post<{ user: UserDTO }>('/auth/register', data);
  },

  /**
   * Retrieve currently authenticated user profile
   */
  async getMe(): Promise<{ user: UserDTO }> {
    return apiClient.get<{ user: UserDTO }>('/auth/me');
  },

  /**
   * Log out of current session and clear auth cookies
   */
  async logout(): Promise<{ message?: string }> {
    return apiClient.post<{ message?: string }>('/auth/logout');
  },

  /**
   * Invalidate all active sessions for the authenticated user
   */
  async logoutAll(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/logout-all');
  },

  /**
   * Refresh session using refresh token cookie
   */
  async refresh(): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/refresh');
  },

  /**
   * Verify email address with one-time verification token
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/verify-email', { token });
  },

  /**
   * Resend account verification email
   */
  async resendVerification(email: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/resend-verification', { email });
  },

  /**
   * Request password reset link
   */
  async forgotPassword(email: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/forgot-password', { email });
  },

  /**
   * Complete password reset using one-time token and new password
   */
  async resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/reset-password', { token, newPassword });
  },

  /**
   * Change current password (requires authentication)
   */
  async changePassword(data: ChangePasswordInput): Promise<{ message: string }> {
    return apiClient.post<{ message: string }>('/auth/change-password', data);
  },

  /**
   * List active sessions for the current user
   */
  async getSessions(): Promise<{ sessions: SessionDTO[]; nextCursor?: string }> {
    return apiClient.get<{ sessions: SessionDTO[]; nextCursor?: string }>('/auth/sessions');
  },

  /**
   * Revoke a specific session
   */
  async deleteSession(sessionId: string): Promise<{ message: string }> {
    return apiClient.delete<{ message: string }>(`/auth/sessions/${sessionId}`);
  },

  /**
   * Accept an organization invitation token
   */
  async acceptInvitation(token: string): Promise<{ organizationId: string; roleName: string }> {
    return apiClient.post<{ organizationId: string; roleName: string }>(`/invitations/${token}/accept`);
  },

  /**
   * Redirect browser to start Google OAuth flow
   */
  startGoogleOAuth(): void {
    const apiUrl =
      (typeof import.meta !== 'undefined' && (import.meta as unknown as { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL) ||
      '/api/v1';
    window.location.href = `${apiUrl}/auth/google`;
  },
};
