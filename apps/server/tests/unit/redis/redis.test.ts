import { describe, it, expect, vi } from 'vitest';
import { deleteRedisKeysByPattern } from '../../../src/lib/redis/redis.js';

describe('deleteRedisKeysByPattern', () => {
  it('scans and deletes matched keys until cursor is 0', async () => {
    const mockClient = {
      scan: vi
        .fn()
        .mockResolvedValueOnce(['10', ['key:1', 'key:2']])
        .mockResolvedValueOnce(['0', ['key:3']]),
      del: vi.fn().mockResolvedValueOnce(2).mockResolvedValueOnce(1),
    };

    const count = await deleteRedisKeysByPattern(mockClient as any, 'key:*');
    expect(count).toBe(3);
    expect(mockClient.scan).toHaveBeenCalledTimes(2);
    expect(mockClient.scan).toHaveBeenNthCalledWith(1, '0', 'MATCH', 'key:*', 'COUNT', 100);
    expect(mockClient.scan).toHaveBeenNthCalledWith(2, '10', 'MATCH', 'key:*', 'COUNT', 100);
    expect(mockClient.del).toHaveBeenCalledWith('key:1', 'key:2');
    expect(mockClient.del).toHaveBeenCalledWith('key:3');
  });

  it('handles empty results without calling del', async () => {
    const mockClient = {
      scan: vi.fn().mockResolvedValueOnce(['0', []]),
      del: vi.fn(),
    };

    const count = await deleteRedisKeysByPattern(mockClient as any, 'empty:*');
    expect(count).toBe(0);
    expect(mockClient.del).not.toHaveBeenCalled();
  });

  it('throws error if maxBatches is exceeded', async () => {
    const mockClient = {
      scan: vi.fn().mockResolvedValue(['1', ['key:1']]),
      del: vi.fn().mockResolvedValue(1),
    };

    await expect(
      deleteRedisKeysByPattern(mockClient as any, 'infinite:*', { maxBatches: 2 }),
    ).rejects.toThrow('Redis scan exceeded 2 batches for pattern infinite:*');
  });

  it('throws error if maxKeys is exceeded', async () => {
    const mockClient = {
      scan: vi.fn().mockResolvedValue(['0', ['k1', 'k2', 'k3']]),
      del: vi.fn(),
    };

    await expect(
      deleteRedisKeysByPattern(mockClient as any, 'huge:*', { maxKeys: 2 }),
    ).rejects.toThrow('Redis scan exceeded 2 keys for pattern huge:*');
  });
});
