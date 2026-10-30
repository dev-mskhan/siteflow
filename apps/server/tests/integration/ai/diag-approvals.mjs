// Diagnostic script to debug agent_approvals constraint issue
import { connect } from '@siteflow/database';
import { serverEnv } from '../../../src/config/env.js';

const sql = (await import('@siteflow/database')).postgres(
  process.env.DATABASE_URL ?? 'postgres://siteflow:siteflow@localhost:5434/siteflow_test',
  { max: 1 }
);

try {
  const id = crypto.randomUUID();
  const runId = crypto.randomUUID();
  const orgId = 'test-org-diag';

  console.log('Attempting INSERT with PENDING status...');
  const result = await sql`
    INSERT INTO app.agent_approvals (
      id, run_id, organization_id, proposal_type, proposal, status, expires_at
    ) VALUES (
      ${id}, ${runId}, ${orgId}, 'TEST', ${{}}::jsonb, 'PENDING', NOW() + INTERVAL '1 hour'
    ) RETURNING *;
  `;
  console.log('SUCCESS:', result[0]);
} catch (err) {
  console.error('FAILED:', err);
} finally {
  await sql.end();
}
