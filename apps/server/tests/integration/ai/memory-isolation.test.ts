// apps/server/tests/integration/ai/memory-isolation.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { getMemoryStore } from '../../../src/modules/ai/memory/memory-store.js';

describe('Memory Isolation Tests', () => {
  const memoryStore = getMemoryStore();
  const org1 = '11111111-1111-1111-1111-111111111111';
  const org2 = '22222222-2222-2222-2222-222222222222';
  const project1 = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  const project2 = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

  afterAll(async () => {
    // Cleanup all test data
    const mem1 = memoryStore.forContext({ organizationId: org1 });
    const mem2 = memoryStore.forContext({ organizationId: org2 });
    await mem1.clear();
    await mem2.clear();
  });

  it('should enforce org-level isolation', async () => {
    const mem1 = memoryStore.forContext({ organizationId: org1 });
    const mem2 = memoryStore.forContext({ organizationId: org2 });

    await mem1.set('shared-key', 'org1-value');
    await mem2.set('shared-key', 'org2-value');

    const val1 = await mem1.get('shared-key');
    const val2 = await mem2.get('shared-key');

    expect(val1).toBe('org1-value');
    expect(val2).toBe('org2-value');
  });

  it('should enforce project-level isolation within same org', async () => {
    const mem1 = memoryStore.forContext({ organizationId: org1, projectId: project1 });
    const mem2 = memoryStore.forContext({ organizationId: org1, projectId: project2 });

    await mem1.set('project-key', 'project1-value');
    await mem2.set('project-key', 'project2-value');

    const val1 = await mem1.get('project-key');
    const val2 = await mem2.get('project-key');

    expect(val1).toBe('project1-value');
    expect(val2).toBe('project2-value');
  });

  it('should enforce agent-level isolation within same project', async () => {
    const memCompliance = memoryStore.forContext({
      organizationId: org1,
      projectId: project1,
      agentName: 'compliance',
    });
    const memCost = memoryStore.forContext({
      organizationId: org1,
      projectId: project1,
      agentName: 'cost-financial',
    });

    await memCompliance.set('agent-key', 'compliance-value');
    await memCost.set('agent-key', 'cost-value');

    const val1 = await memCompliance.get('agent-key');
    const val2 = await memCost.get('agent-key');

    expect(val1).toBe('compliance-value');
    expect(val2).toBe('cost-value');
  });

  it('should reject numeric keys (GDPR requirement)', async () => {
    const mem = memoryStore.forContext({ organizationId: org1 });

    await expect(mem.set('12345', 'value')).rejects.toThrow();
    await expect(mem.set('user-12345', 'value')).resolves.not.toThrow();
  });

  it('should respect TTL and auto-expire keys', async () => {
    const mem = memoryStore.forContext({ organizationId: org1 });

    await mem.set('ttl-key', 'ttl-value', 1); // 1 second TTL
    const immediate = await mem.get('ttl-key');
    expect(immediate).toBe('ttl-value');

    // Wait 1.5 seconds
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const expired = await mem.get('ttl-key');
    expect(expired).toBeNull();
  });

  it('should cascade delete on org deletion (GDPR right to erasure)', async () => {
    const testOrg = '99999999-9999-9999-9999-999999999999';
    const mem = memoryStore.forContext({ organizationId: testOrg });

    await mem.set('key1', 'value1');
    await mem.set('key2', 'value2');
    await mem.set('key3', 'value3');

    // Simulate org deletion
    await mem.clear();

    const val1 = await mem.get('key1');
    const val2 = await mem.get('key2');
    const val3 = await mem.get('key3');

    expect(val1).toBeNull();
    expect(val2).toBeNull();
    expect(val3).toBeNull();
  });

  it('should list all keys with namespace prefix', async () => {
    const mem = memoryStore.forContext({
      organizationId: org1,
      projectId: project1,
      agentName: 'test-agent',
    });

    await mem.set('list-key-1', 'value1');
    await mem.set('list-key-2', 'value2');
    await mem.set('list-key-3', 'value3');

    const keys = await mem.list();

    expect(keys).toContain('list-key-1');
    expect(keys).toContain('list-key-2');
    expect(keys).toContain('list-key-3');
    expect(keys.length).toBeGreaterThanOrEqual(3);

    // Cleanup
    await mem.delete('list-key-1');
    await mem.delete('list-key-2');
    await mem.delete('list-key-3');
  });
});
