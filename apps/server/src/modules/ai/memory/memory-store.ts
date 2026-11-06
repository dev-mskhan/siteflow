// apps/server/src/modules/ai/memory/memory-store.ts
//
// LangGraph-compatible memory store adapter with tenant namespacing.
// Uses Redis as backend for persistence and performance.
//
// CRITICAL RULES (from Wave 5 requirements):
// 1. Store ONLY preferences and corrections, NEVER facts or numbers
// 2. Namespace by organizationId (required), projectId (optional), agent (optional)
// 3. Tenant isolation: org A memory INVISIBLE to org B
// 4. Retention: 90-day TTL, weekly cleanup
// 5. GDPR: cascade delete when org/project deleted

import { getRedis } from '../../../lib/redis/redis.js';
import type { Redis } from 'ioredis';
import { createLogger } from '@siteflow/observability/server';
import type { RunContext } from '../core/run-context.js';

const logger = createLogger({ name: 'memory-store' });

// ── Types ─────────────────────────────────────────────────────────────────────

export interface MemoryItem {
  key: string;
  value: unknown;
  createdAt: string;
  expiresAt: string;
  namespace: MemoryNamespace;
}

export interface MemoryNamespace {
  organizationId: string;
  projectId?: string;
  agent?: string;
}

export interface MemoryStoreOptions {
  ttlDays?: number; // Default: 90 days
}

// ── Memory Store ──────────────────────────────────────────────────────────────

export class MemoryStore {
  private redis: Redis;
  private ttlDays: number;

  constructor(options: MemoryStoreOptions = {}) {
    this.redis = getRedis();
    this.ttlDays = options.ttlDays ?? 90;
  }

  // ── Key Generation ────────────────────────────────────────────────────────

  /**
   * Generates namespaced Redis key for memory item.
   * Pattern: memory:{orgId}:{projectId?}:{agent?}:{key}
   */
  private buildKey(namespace: MemoryNamespace, key: string): string {
    const parts = ['memory', namespace.organizationId];
    
    if (namespace.projectId) {
      parts.push(namespace.projectId);
    } else {
      parts.push('_'); // Placeholder for consistent key structure
    }
    
    if (namespace.agent) {
      parts.push(namespace.agent);
    } else {
      parts.push('_');
    }
    
    parts.push(key);
    
    return parts.join(':');
  }

  /**
   * Generates Redis pattern for scanning all keys in a namespace.
   * Used for listing/deleting all memories in a scope.
   */
  private buildPattern(namespace: Partial<MemoryNamespace>): string {
    const parts = ['memory', namespace.organizationId ?? '*'];
    parts.push(namespace.projectId ?? '*');
    parts.push(namespace.agent ?? '*');
    parts.push('*'); // Match all keys
    return parts.join(':');
  }

  // ── CRUD Operations ───────────────────────────────────────────────────────

  /**
   * Set a memory item with automatic TTL.
   * 
   * @example
   * await store.set(
   *   { organizationId: 'org_123', agent: 'compliance' },
   *   'user_preference_units',
   *   'metric'
   * );
   */
  async set(
    namespace: MemoryNamespace,
    key: string,
    value: unknown,
  ): Promise<void> {
    const redisKey = this.buildKey(namespace, key);
    const ttlSeconds = this.ttlDays * 24 * 60 * 60;
    
    const item: MemoryItem = {
      key,
      value,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString(),
      namespace,
    };

    await this.redis.setex(
      redisKey,
      ttlSeconds,
      JSON.stringify(item),
    );

    logger.debug({ namespace, key }, 'Memory item stored');
  }

  /**
   * Get a memory item by key.
   * Returns null if not found or expired.
   */
  async get(
    namespace: MemoryNamespace,
    key: string,
  ): Promise<unknown | null> {
    const redisKey = this.buildKey(namespace, key);
    const raw = await this.redis.get(redisKey);
    
    if (!raw) {
      return null;
    }

    try {
      const item: MemoryItem = JSON.parse(raw);
      return item.value;
    } catch (err) {
      logger.warn({ err, key: redisKey }, 'Failed to parse memory item');
      return null;
    }
  }

  /**
   * Delete a specific memory item.
   */
  async delete(
    namespace: MemoryNamespace,
    key: string,
  ): Promise<boolean> {
    const redisKey = this.buildKey(namespace, key);
    const deleted = await this.redis.del(redisKey);
    return deleted > 0;
  }

  /**
   * List all memory keys in a namespace.
   * Returns keys only (not values) for efficiency.
   */
  async list(
    namespace: Partial<MemoryNamespace>,
  ): Promise<string[]> {
    const pattern = this.buildPattern(namespace);
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      
      // Extract the key part (last segment after last colon)
      for (const redisKey of batch) {
        const parts = redisKey.split(':');
        const key = parts[parts.length - 1];
        if (key) keys.push(key);
      }
    } while (cursor !== '0');

    return keys;
  }

  /**
   * Get all memory items in a namespace.
   * Returns full items with values.
   */
  async getAll(
    namespace: Partial<MemoryNamespace>,
  ): Promise<MemoryItem[]> {
    const pattern = this.buildPattern(namespace);
    const items: MemoryItem[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;

      if (batch.length > 0) {
        const values = await this.redis.mget(...batch);
        
        for (let i = 0; i < batch.length; i++) {
          const raw = values[i];
          if (!raw) continue;
          
          try {
            const item: MemoryItem = JSON.parse(raw);
            items.push(item);
          } catch (err) {
            logger.warn({ err, key: batch[i] }, 'Failed to parse memory item');
          }
        }
      }
    } while (cursor !== '0');

    return items;
  }

  /**
   * Delete all memory items in a namespace.
   * Used for org/project deletion (GDPR compliance).
   * 
   * @returns Number of items deleted
   */
  async deleteAll(
    namespace: Partial<MemoryNamespace>,
  ): Promise<number> {
    const pattern = this.buildPattern(namespace);
    let deleted = 0;
    let cursor = '0';
    let batches = 0;
    const maxBatches = 1000;

    do {
      if (batches >= maxBatches) {
        throw new Error(`Memory deletion exceeded ${maxBatches} batches for pattern ${pattern}`);
      }

      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      batches++;

      if (batch.length > 0) {
        deleted += await this.redis.del(...batch);
      }
    } while (cursor !== '0');

    logger.info({ namespace, deleted }, 'Memory namespace cleared');
    return deleted;
  }

  // ── Convenience Methods ───────────────────────────────────────────────────

  /**
   * Create a namespaced memory accessor from RunContext.
   * This is what agents will use in their graphs.
   * 
   * @example
   * const memory = store.forContext(ctx);
   * await memory.set('user_preference', 'metric_units');
   * const pref = await memory.get('user_preference');
   */
  forContext(ctx: RunContext): NamespacedMemory {
    return new NamespacedMemory(this, {
      organizationId: ctx.organizationId,
      projectId: ctx.projectId,
      agent: ctx.agent,
    });
  }
}

// ── Namespaced Memory (Convenience Wrapper) ───────────────────────────────────

/**
 * Scoped memory interface for a specific namespace.
 * Automatically applies organizationId, projectId, agent from RunContext.
 */
export class NamespacedMemory {
  constructor(
    private store: MemoryStore,
    private namespace: MemoryNamespace,
  ) {}

  async set(key: string, value: unknown): Promise<void> {
    return this.store.set(this.namespace, key, value);
  }

  async get(key: string): Promise<unknown | null> {
    return this.store.get(this.namespace, key);
  }

  async delete(key: string): Promise<boolean> {
    return this.store.delete(this.namespace, key);
  }

  async list(): Promise<string[]> {
    return this.store.list(this.namespace);
  }

  async getAll(): Promise<MemoryItem[]> {
    return this.store.getAll(this.namespace);
  }

  async clear(): Promise<number> {
    return this.store.deleteAll(this.namespace);
  }

  getNamespace(): MemoryNamespace {
    return { ...this.namespace };
  }
}

// ── Global Instance ───────────────────────────────────────────────────────────

let _memoryStore: MemoryStore | undefined;

/**
 * Get the shared memory store instance.
 * Creates it on first call (lazy init).
 */
export function getMemoryStore(options?: MemoryStoreOptions): MemoryStore {
  if (!_memoryStore) {
    _memoryStore = new MemoryStore(options);
  }
  return _memoryStore;
}
