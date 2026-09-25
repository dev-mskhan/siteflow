// apps/server/src/modules/auth/auth.handler.ts
import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from './auth.service.js';
import { generateOAuthState, generatePkcePair } from './google-oauth.service.js';
import { createSuccessResponse } from '../../shared/response.js';
import { serverEnv } from '../../config/env.js';
import {
  registerSchema,
  loginSchema,
  verifyEmailSchema,
  resendVerificationSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  sessionIdParamSchema,
} from '@siteflow/shared';

const authService = new AuthService();

function setAuthCookies(reply: FastifyReply, accessToken: string, refreshToken: string) {
  const isProd = serverEnv.NODE_ENV === 'production';

  reply.setCookie('access_token', accessToken, {
    path: '/',
    httpOnly: true,
    signed: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 15 * 60, // 15 minutes in seconds
  });

  reply.setCookie('refresh_token', refreshToken, {
    path: '/',
    httpOnly: true,
    signed: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: serverEnv.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60, // days in seconds
  });
}

function clearAuthCookies(reply: FastifyReply) {
  reply.clearCookie('access_token', { path: '/' });
  reply.clearCookie('refresh_token', { path: '/' });
}

export async function handleRegister(request: FastifyRequest, reply: FastifyReply) {
  const body = registerSchema.parse(request.body);
  const result = await authService.register(body);

  setAuthCookies(reply, result.accessToken, result.refreshToken);

  return reply.status(201).send(
    createSuccessResponse({
      user: result.user,
    }),
  );
}

export async function handleLogin(request: FastifyRequest, reply: FastifyReply) {
  const body = loginSchema.parse(request.body);
  const ipAddress = request.ip;
  const userAgent = request.headers['user-agent'];

  const result = await authService.login(body, ipAddress, userAgent);

  setAuthCookies(reply, result.accessToken, result.refreshToken);

  return reply.send(
    createSuccessResponse({
      user: result.user,
    }),
  );
}

export async function handleGoogleAuth(request: FastifyRequest, reply: FastifyReply) {
  const state = generateOAuthState();
  const { codeVerifier, codeChallenge } = generatePkcePair();
  const isProd = serverEnv.NODE_ENV === 'production';

  // Store CSRF state & PKCE verifier in short-lived signed cookies
  reply.setCookie('oauth_state', state, {
    path: '/',
    httpOnly: true,
    signed: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 600,
  });

  reply.setCookie('oauth_code_verifier', codeVerifier, {
    path: '/',
    httpOnly: true,
    signed: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: 600,
  });

  const { url } = authService.getGoogleAuthUrl(state, codeChallenge);

  const acceptHeader = request.headers['accept'] ?? '';
  if (acceptHeader.includes('text/html') && !acceptHeader.includes('application/json')) {
    return reply.redirect(url, 302);
  }

  return reply.send(createSuccessResponse({ url, state }));
}

export async function handleGoogleCallback(request: FastifyRequest, reply: FastifyReply) {
  const query = request.query as { code?: string; state?: string };

  if (!query.code) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Authorization code is required in query parameter' },
    });
  }

  let storedState: string | undefined;
  let storedVerifier: string | undefined;

  if (request.cookies && request.cookies['oauth_state']) {
    const rawState = request.cookies['oauth_state'];
    const unsigned = request.unsignCookie(rawState);
    if (unsigned.valid && unsigned.value) storedState = unsigned.value;
  }
  if (request.cookies && request.cookies['oauth_code_verifier']) {
    const rawVerifier = request.cookies['oauth_code_verifier'];
    const unsigned = request.unsignCookie(rawVerifier);
    if (unsigned.valid && unsigned.value) storedVerifier = unsigned.value;
  }

  if (storedState && query.state !== storedState) {
    return reply.status(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Invalid or expired OAuth state parameter' },
    });
  }

  reply.clearCookie('oauth_state', { path: '/' });
  reply.clearCookie('oauth_code_verifier', { path: '/' });

  const ipAddress = request.ip;
  const userAgent = request.headers['user-agent'];

  const result = await authService.loginWithGoogle(query.code, ipAddress, userAgent, storedVerifier);

  setAuthCookies(reply, result.accessToken, result.refreshToken);

  const acceptHeader = request.headers['accept'] ?? '';
  if (acceptHeader.includes('application/json')) {
    return reply.send(
      createSuccessResponse({
        user: result.user,
        code: query.code,
      }),
    );
  }

  const frontendTarget = `${(serverEnv.FRONTEND_URL ?? 'http://localhost:3000').replace(/\/$/, '')}/auth/complete`;
  return reply.redirect(frontendTarget, 302);
}

export async function handleRefresh(request: FastifyRequest, reply: FastifyReply) {
  let refreshToken: string | undefined;

  if (request.cookies && request.cookies['refresh_token']) {
    const rawCookie = request.cookies['refresh_token'];
    const unsigned = request.unsignCookie(rawCookie);
    if (unsigned.valid && unsigned.value) {
      refreshToken = unsigned.value;
    } else if (!rawCookie.startsWith('s:')) {
      refreshToken = rawCookie;
    }
  } else if (request.body && typeof request.body === 'object' && 'refreshToken' in request.body) {
    refreshToken = (request.body as { refreshToken: string }).refreshToken;
  }

  if (!refreshToken) {
    return reply.status(401).send({
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Refresh token missing' },
    });
  }

  const ipAddress = request.ip;
  const userAgent = request.headers['user-agent'];

  const result = await authService.refreshToken(refreshToken, ipAddress, userAgent);

  setAuthCookies(reply, result.accessToken, result.refreshToken);

  return reply.send(
    createSuccessResponse({
      message: 'Token refreshed successfully',
    }),
  );
}

export async function handleLogout(request: FastifyRequest, reply: FastifyReply) {
  const sessionId = request.sessionId;
  await authService.logout(sessionId);
  clearAuthCookies(reply);

  return reply.send(createSuccessResponse({ message: 'Logged out successfully' }));
}

export async function handleVerifyEmail(request: FastifyRequest, reply: FastifyReply) {
  const body = verifyEmailSchema.parse(request.body);
  await authService.verifyEmail(body);

  return reply.send(createSuccessResponse({ message: 'Email verified successfully' }));
}

export async function handleResendVerification(request: FastifyRequest, reply: FastifyReply) {
  const body = resendVerificationSchema.parse(request.body);
  await authService.resendVerification(body);

  return reply.send(
    createSuccessResponse({ message: 'If the email exists and is unverified, a verification link has been sent' }),
  );
}

export async function handleForgotPassword(request: FastifyRequest, reply: FastifyReply) {
  const body = forgotPasswordSchema.parse(request.body);
  await authService.forgotPassword(body);

  return reply.send(
    createSuccessResponse({ message: 'If an account with that email exists, a password reset link has been sent' }),
  );
}

export async function handleResetPassword(request: FastifyRequest, reply: FastifyReply) {
  const body = resetPasswordSchema.parse(request.body);
  await authService.resetPassword(body);

  clearAuthCookies(reply);

  return reply.send(createSuccessResponse({ message: 'Password reset successfully. Please log in with your new password.' }));
}

export async function handleChangePassword(request: FastifyRequest, reply: FastifyReply) {
  const body = changePasswordSchema.parse(request.body);
  const userId = request.user!.sub;

  await authService.changePassword(userId, body);
  clearAuthCookies(reply);

  return reply.send(createSuccessResponse({ message: 'Password changed successfully. Please log in again.' }));
}

export async function handleGetMe(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.sub;
  const user = await authService.getUserProfile(userId);

  return reply.send(createSuccessResponse({ user }));
}

export async function handleGetSessions(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.sub;
  const currentSessionId = request.sessionId;
  const sessions = await authService.getUserSessions(userId, currentSessionId);

  return reply.send(createSuccessResponse({ sessions }));
}

export async function handleDeleteSession(request: FastifyRequest, reply: FastifyReply) {
  const { sessionId } = sessionIdParamSchema.parse(request.params);
  const userId = request.user!.sub;

  await authService.deleteSession(userId, sessionId);

  return reply.send(createSuccessResponse({ message: 'Session revoked successfully' }));
}

export async function handleLogoutAll(request: FastifyRequest, reply: FastifyReply) {
  const userId = request.user!.sub;
  const count = await authService.logoutAll(userId);

  clearAuthCookies(reply);

  return reply.send(createSuccessResponse({ message: `Logged out of ${count} active session(s)` }));
}
