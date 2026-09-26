// apps/server/src/modules/auth/token.service.ts
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createLogger } from '@siteflow/observability/server';
import { serverEnv } from '../../config/env.js';
import { TokenExpiredError, InvalidTokenError } from './auth.errors.js';

const logger = createLogger({ name: 'token-service' });

export interface AccessTokenPayload {
  sub: string;   // userId
  email: string;
  status: 'ACTIVE' | 'INACTIVE' | 'SUSPENDED';
  sessionId?: string;
}

/**
 * Signs a JWT access token.
 */
export function createAccessToken(payload: AccessTokenPayload): string {
  logger.debug({ userId: payload.sub }, 'Creating access token');
  return jwt.sign(payload, serverEnv.JWT_SECRET, {
    expiresIn: serverEnv.JWT_EXPIRY as jwt.SignOptions['expiresIn'],
  });
}

/**
 * Verifies and decodes a JWT access token.
 * Throws TokenExpiredError or InvalidTokenError on failure.
 */
export function verifyAccessToken(token: string): AccessTokenPayload {
  try {
    return jwt.verify(token, serverEnv.JWT_SECRET) as AccessTokenPayload;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError('Access token has expired');
    }
    throw new InvalidTokenError('Invalid access token');
  }
}

/**
 * Generates a cryptographically random opaque refresh token (64 hex chars = 256 bits).
 * Returns both the raw token (to set in cookie) and its SHA-256 hash (to store in DB).
 */
export function generateRefreshToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

/**
 * Hashes a raw refresh token for DB lookup.
 */
export function hashRefreshToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

/**
 * Generates a random token for email verification / password reset.
 * Returns both raw (to send in email) and hash (to store in DB).
 */
export function generateOneTimeToken(): { raw: string; hash: string } {
  const raw = crypto.randomBytes(32).toString('hex');
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
}

/**
 * Hashes a one-time token for DB lookup.
 */
export function hashOneTimeToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}
