// apps/server/tests/unit/auth/password.service.test.ts
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../../src/modules/auth/password.service.js';

describe('PasswordService', () => {
  it('should correctly hash a password and verify it', async () => {
    const plain = 'SecretPassword123!';
    const hash = await hashPassword(plain);

    expect(hash).toBeDefined();
    expect(hash).not.toBe(plain);
    expect(hash.startsWith('$2')).toBe(true); // bcrypt prefix

    const isValid = await verifyPassword(plain, hash);
    expect(isValid).toBe(true);

    const isWrongValid = await verifyPassword('WrongPassword', hash);
    expect(isWrongValid).toBe(false);
  }, 15000);
});
