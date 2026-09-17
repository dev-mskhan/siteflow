// apps/server/tests/unit/auth/token.service.test.ts
import { describe, it, expect } from 'vitest';
import {
  createAccessToken,
  verifyAccessToken,
  generateRefreshToken,
  hashRefreshToken,
  generateOneTimeToken,
  hashOneTimeToken,
} from '../../../src/modules/auth/token.service.js';
import { InvalidTokenError } from '../../../src/modules/auth/auth.errors.js';

describe('TokenService', () => {
  it('should generate and verify JWT access token', () => {
    const payload = {
      sub: 'usr_12345',
      email: 'user@example.com',
      status: 'ACTIVE' as const,
    };

    const token = createAccessToken(payload);
    expect(typeof token).toBe('string');

    const decoded = verifyAccessToken(token);
    expect(decoded.sub).toBe(payload.sub);
    expect(decoded.email).toBe(payload.email);
    expect(decoded.status).toBe(payload.status);
  });

  it('should throw InvalidTokenError for malformed token', () => {
    expect(() => verifyAccessToken('invalid.token.str')).toThrow(InvalidTokenError);
  });

  it('should generate opaque refresh tokens and produce reproducible SHA-256 hashes', () => {
    const { raw, hash } = generateRefreshToken();

    expect(raw).toBeDefined();
    expect(raw.length).toBe(64); // 32 bytes hex
    expect(hash).toBeDefined();
    expect(hash.length).toBe(64); // SHA-256 hex

    const hashAgain = hashRefreshToken(raw);
    expect(hashAgain).toBe(hash);
  });

  it('should generate one-time tokens and hashes', () => {
    const { raw, hash } = generateOneTimeToken();

    expect(raw.length).toBe(64);
    expect(hashOneTimeToken(raw)).toBe(hash);
  });
});
