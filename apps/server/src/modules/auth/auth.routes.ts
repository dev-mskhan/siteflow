// apps/server/src/modules/auth/auth.routes.ts
// Fastify plugin — registers all /api/v1/auth/* routes with OpenAPI schemas.
import type { FastifyPluginAsync } from 'fastify';
import { authenticate } from './auth.middleware.js';
import {
  handleRegister,
  handleLogin,
  handleRefresh,
  handleLogout,
  handleVerifyEmail,
  handleResendVerification,
  handleForgotPassword,
  handleResetPassword,
  handleChangePassword,
  handleGetMe,
  handleGetSessions,
  handleDeleteSession,
  handleLogoutAll,
} from './auth.handler.js';
import {
  registerSchema,
  loginSchema,
  refreshSchema,
  logoutSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  getMeSchema,
  getSessionsSchema,
  deleteSessionSchema,
  logoutAllSchema,
} from './docs/auth.schemas.js';

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  // ─── Public Routes ────────────────────────────────────────────────────────
  fastify.post('/register', { schema: registerSchema }, handleRegister);
  fastify.post('/login', { schema: loginSchema }, handleLogin);
  fastify.post('/refresh', { schema: refreshSchema }, handleRefresh);
  fastify.post('/verify-email', { schema: verifyEmailSchema }, handleVerifyEmail);
  fastify.post('/resend-verification', { schema: resendVerificationSchema }, handleResendVerification);
  fastify.post('/forgot-password', { schema: forgotPasswordSchema }, handleForgotPassword);
  fastify.post('/reset-password', { schema: resetPasswordSchema }, handleResetPassword);

  // ─── Protected Routes (JWT required) ─────────────────────────────────────
  fastify.register(async (protectedRoutes) => {
    protectedRoutes.addHook('preHandler', authenticate);

    protectedRoutes.post('/logout', { schema: logoutSchema }, handleLogout);
    protectedRoutes.post('/change-password', { schema: changePasswordSchema }, handleChangePassword);
    protectedRoutes.get('/me', { schema: getMeSchema }, handleGetMe);
    protectedRoutes.get('/sessions', { schema: getSessionsSchema }, handleGetSessions);
    protectedRoutes.delete('/sessions/:sessionId', { schema: deleteSessionSchema }, handleDeleteSession);
    protectedRoutes.post('/logout-all', { schema: logoutAllSchema }, handleLogoutAll);
  });
};
