// apps/server/src/modules/auth/password.service.ts
import bcrypt from 'bcryptjs';
import { createLogger } from '@siteflow/observability/server';

const logger = createLogger({ name: 'password-service' });

const SALT_ROUNDS = process.env.NODE_ENV === 'test' ? 4 : 12;

/**
 * Hashes a plain-text password using bcrypt.
 */
export async function hashPassword(password: string): Promise<string> {
  logger.debug('Hashing password');
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compares a plain-text password against a bcrypt hash.
 * Returns true if they match, false otherwise.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  logger.debug('Verifying password');
  return bcrypt.compare(password, hash);
}
