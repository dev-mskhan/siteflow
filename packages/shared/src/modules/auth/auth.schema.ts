// packages/shared/src/modules/auth/auth.schema.ts
import { z } from 'zod';

// ─── Reusable Field Validations ────────────────────────────────────────────────
export const emailSchema = z
  .string({ required_error: 'Email is required' })
  .trim()
  .toLowerCase()
  .email('Invalid email address format');

export const passwordSchema = z
  .string({ required_error: 'Password is required' })
  .min(8, 'Password must be at least 8 characters long')
  .max(100, 'Password must not exceed 100 characters');

export const nameSchema = z
  .string({ required_error: 'Name is required' })
  .trim()
  .min(1, 'Name cannot be empty')
  .max(50, 'Name must not exceed 50 characters');

// ─── Request Schemas ──────────────────────────────────────────────────────────
export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: nameSchema.optional(),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string({ required_error: 'Password is required' }),
});

export const verifyEmailSchema = z.object({
  token: z.string({ required_error: 'Verification token is required' }).trim().min(1, 'Token is required'),
});

export const resendVerificationSchema = z.object({
  email: emailSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  token: z.string({ required_error: 'Reset token is required' }).trim().min(1, 'Token is required'),
  newPassword: passwordSchema,
});

export const changePasswordSchema = z.object({
  currentPassword: z.string({ required_error: 'Current password is required' }),
  newPassword: passwordSchema,
});

export const sessionIdParamSchema = z.object({
  sessionId: z.string().uuid('Invalid session ID format'),
});

// ─── Response DTO Schemas / Types ──────────────────────────────────────────────
export interface UserDTO {
  id: string;
  email: string;
  firstName: string;
  lastName: string | null;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  emailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface SessionDTO {
  id: string;
  ipAddress: string | null;
  userAgent: string | null;
  lastUsedAt: string | null;
  createdAt: string;
  isCurrent?: boolean;
}

// ─── Inferred TypeScript Input Types ──────────────────────────────────────────
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type SessionIdParamInput = z.infer<typeof sessionIdParamSchema>;
