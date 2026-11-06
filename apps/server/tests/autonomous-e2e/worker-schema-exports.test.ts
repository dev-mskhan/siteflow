import { describe, expect, it } from 'vitest';

describe('AI worker schema package exports', () => {
  it('exports the schema tables imported during worker startup', async () => {
    const schema = await import('@siteflow/database/schema');

    expect(schema.okfPages).toBeDefined();
    expect(schema.toolApprovals).toBeDefined();
  });
});
