// Live smoke test against the configured model, local database, Langfuse, and
// already-running PgBoss worker.
//
// Run from the repository root with:
//   $env:AI_LIVE='1'
//   $env:AI_LIVE_PROJECT_ID='<existing test project UUID with purchase orders>'
//   pnpm --filter @siteflow/server test -- tests/integration/ai/procurement.live.test.ts

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { and, eq, gt, inArray } from 'drizzle-orm';
import {
  agentToolCalls,
  organizationMemberships,
  permissions,
  projects,
  purchaseOrders,
  rolePermissions,
  roles,
} from '@siteflow/database/schema';
import { serverEnv } from '../../../src/config/env.js';
import { getDb } from '../../../src/lib/db/index.js';
import { stopQueue } from '../../../src/lib/queue/index.js';
import { AgentRunRepository } from '../../../src/modules/ai/runs/agent-run.repository.js';
import { AgentRunService } from '../../../src/modules/ai/runs/agent-run.service.js';
import { rbacService } from '../../../src/modules/rbac/rbac.service.js';
import { rbacCacheService } from '../../../src/modules/rbac/rbac.cache.service.js';
import { procurementOutputSchema } from '../../../src/modules/ai/agents/procurement/output.schema.js';

const LIVE_ENABLED = process.env.AI_LIVE === '1';
const PROJECT_ID = process.env.AI_LIVE_PROJECT_ID;
const MAX_WAIT_MS = 240_000;
const POLL_INTERVAL_MS = 1_500;
const TERMINAL_STATUSES = new Set([
  'SUCCEEDED',
  'FAILED',
  'CANCELLED',
  'AWAITING_APPROVAL',
]);

if (LIVE_ENABLED && !PROJECT_ID) {
  throw new Error('AI_LIVE_PROJECT_ID must identify an existing test project');
}

describe.skipIf(!LIVE_ENABLED)('procurement live worker smoke test', () => {
  const runs = new AgentRunRepository();
  const runService = new AgentRunService();
  let project: {
    id: string;
    organizationId: string;
    createdBy: string;
    name: string;
  };
  let purchaseOrder: { id: string; poNumber: string };
  let temporaryRoleId: string | undefined;
  let membershipId: string | undefined;
  let originalRoleId: string | undefined;
  let permissionCacheOrganizationId: string | undefined;

  async function restoreTestPermissions(): Promise<void> {
    if (temporaryRoleId) {
      if (membershipId && originalRoleId) {
        await getDb()
          .update(organizationMemberships)
          .set({ roleId: originalRoleId })
          .where(eq(organizationMemberships.id, membershipId));
      }
      await rbacCacheService.invalidateOrg(project.organizationId);
      await rbacCacheService.invalidateRolePermissions(temporaryRoleId);
      await getDb().delete(roles).where(eq(roles.id, temporaryRoleId));
      temporaryRoleId = undefined;
    }
    if (permissionCacheOrganizationId) {
      await rbacCacheService.invalidateOrg(permissionCacheOrganizationId);
      permissionCacheOrganizationId = undefined;
    }
  }

  beforeAll(async () => {
    const databaseHost = new URL(serverEnv.DATABASE_URL).hostname;
    if (!['localhost', '127.0.0.1', '::1'].includes(databaseHost)) {
      throw new Error(
        `Refusing live AI test against non-local database host "${databaseHost}"`,
      );
    }
    if (serverEnv.AI_PROVIDER === 'fake') {
      throw new Error('AI_PROVIDER=fake; refusing to run a live model test');
    }
    if (!serverEnv.LANGFUSE_PUBLIC_KEY || !serverEnv.LANGFUSE_SECRET_KEY) {
      throw new Error('Langfuse is not configured; refusing a trace-evaluation run');
    }

    const [candidate] = await getDb()
      .select({
        id: projects.id,
        organizationId: projects.organizationId,
        createdBy: projects.createdBy,
        name: projects.name,
      })
      .from(projects)
      .where(eq(projects.id, PROJECT_ID!))
      .limit(1);
    if (
      !candidate ||
      !candidate.createdBy ||
      !candidate.name.toLowerCase().includes('test')
    ) {
      throw new Error('AI_LIVE_PROJECT_ID must belong to an existing test project with an owner');
    }
    project = { ...candidate, createdBy: candidate.createdBy };

    const [membership] = await getDb()
      .select({
        id: organizationMemberships.id,
        roleId: organizationMemberships.roleId,
      })
      .from(organizationMemberships)
      .where(
        and(
          eq(organizationMemberships.organizationId, project.organizationId),
          eq(organizationMemberships.userId, project.createdBy),
          eq(organizationMemberships.status, 'ACTIVE'),
        ),
      )
      .limit(1);
    if (!membership) {
      throw new Error('The selected test project owner is not an active organization member');
    }
    membershipId = membership.id;
    originalRoleId = membership.roleId;

    const permissionKeys = [
      'project.purchase_order.read',
      'project.quote.read',
      'project.material_request.read',
    ];
    await getDb()
      .insert(permissions)
      .values(permissionKeys.map((key) => ({ id: crypto.randomUUID(), key })))
      .onConflictDoNothing({ target: permissions.key });
    const permissionRows = await getDb()
      .select({ id: permissions.id })
      .from(permissions)
      .where(inArray(permissions.key, permissionKeys));
    temporaryRoleId = crypto.randomUUID();
    await getDb().insert(roles).values({
      id: temporaryRoleId,
      organizationId: project.organizationId,
      name: `Temporary AI live test ${crypto.randomUUID().slice(0, 8)}`,
      description: 'Temporary procurement read permissions for one local live test',
      isSystem: false,
    });
    await getDb()
      .insert(rolePermissions)
      .values(permissionRows.map(({ id }) => ({ roleId: temporaryRoleId!, permissionId: id })));
    await getDb()
      .update(organizationMemberships)
      .set({ roleId: temporaryRoleId })
      .where(eq(organizationMemberships.id, membership.id));
    permissionCacheOrganizationId = project.organizationId;
    await rbacCacheService.invalidateOrg(project.organizationId);

    const orgContext = await rbacService.getOrganizationContext(
      project.organizationId,
      project.createdBy,
    );
    if (
      permissionKeys.some((permission) => !rbacService.hasPermission(orgContext, permission))
    ) {
      throw new Error('Temporary test role did not receive required procurement permissions');
    }

    const [candidatePurchaseOrder] = await getDb()
      .select({ id: purchaseOrders.id, poNumber: purchaseOrders.poNumber })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.projectId, project.id),
          gt(purchaseOrders.totalAmount, '0'),
        ),
      )
      .limit(1);
    if (!candidatePurchaseOrder) {
      throw new Error('The selected test project has no non-zero purchase orders');
    }
    purchaseOrder = candidatePurchaseOrder;
  }, 30_000);

  afterAll(async () => {
    await restoreTestPermissions();
    await stopQueue();
    await getDb().$client.end();
  });

  it(
    'runs a procurement inquiry through the running worker and evaluates sourced output',
    async () => {
      const question =
        `Call get_purchase_order for purchase order ${purchaseOrder.poNumber} in the selected project. ` +
        'Report the exact status and supplier name from that record only. Do not report amounts, counts, ' +
        'or other figures; return an empty figures array and cite that purchase-order record.';
      const startedAt = Date.now();
      const { runId } = await runService.startRun({
        organizationId: project.organizationId,
        agent: 'procurement',
        input: { question, projectId: project.id },
        createdBy: project.createdBy,
        channel: 'api',
        trigger: 'USER',
      });

      console.log(`[procurement live] queued run ${runId} for ${project.name}`);

      const deadline = startedAt + MAX_WAIT_MS;
      let nextProgressLog = startedAt + 15_000;
      let run = await runs.findByIdInternal(runId);

      while (run && !TERMINAL_STATUSES.has(run.status) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        run = await runs.findByIdInternal(runId);
        if (Date.now() >= nextProgressLog) {
          console.log(
            `[procurement live] ${runId}: ${run?.status ?? 'missing'} after ${Math.round((Date.now() - startedAt) / 1000)}s`,
          );
          nextProgressLog += 15_000;
        }
      }

      if (!run || !TERMINAL_STATUSES.has(run.status)) {
        await runService.cancelRun(runId, project.organizationId, project.createdBy);
        throw new Error(
          `Timed out after ${MAX_WAIT_MS}ms; run ${runId} remained ${run?.status ?? 'missing'}. ` +
            'If still QUEUED, the running worker is not consuming this database/queue.',
        );
      }

      const toolRows = await getDb()
        .select({
          toolName: agentToolCalls.toolName,
          status: agentToolCalls.status,
          durationMs: agentToolCalls.durationMs,
        })
        .from(agentToolCalls)
        .where(eq(agentToolCalls.runId, runId));

      console.log(
        JSON.stringify({
          runId,
          status: run.status,
          elapsedMs: Date.now() - startedAt,
          traceId: run.traceId,
          tokens: { input: run.tokensIn, output: run.tokensOut },
          costUsd: run.costUsd,
          error: run.error,
          tools: toolRows,
        }),
      );

      expect(run.status, run.error ?? 'worker did not complete successfully').toBe('SUCCEEDED');
      expect(run.traceId, 'Langfuse trace ID was not recorded').toBeTruthy();
      expect((run.tokensIn ?? 0) + (run.tokensOut ?? 0)).toBeGreaterThan(0);

      const output =
        typeof run.output === 'string' ? JSON.parse(run.output) : run.output;
      const parsed = procurementOutputSchema.safeParse(output);
      expect(parsed.success, 'agent output did not match the output contract').toBe(true);
      if (!parsed.success) return;

      const successfulToolNames = new Set(
        toolRows
          .filter((toolCall) => toolCall.status === 'SUCCESS')
          .map((toolCall) => toolCall.toolName),
      );
      expect(
        [...successfulToolNames].some((toolName) =>
          ['get_purchase_order', 'list_purchase_orders'].includes(toolName),
        ),
        'worker did not successfully retrieve purchase-order data',
      ).toBe(true);
      expect(parsed.data.answer.confidence).not.toBe('INSUFFICIENT_DATA');
      expect(parsed.data.citations.length).toBeGreaterThan(0);
      expect(
        parsed.data.citations.some((citation) =>
          ['get_purchase_order', 'list_purchase_orders'].includes(citation.toolName),
        ),
      ).toBe(true);
      for (const citation of parsed.data.citations) {
        expect(citation.snippet.trim()).not.toBe('');
        expect(successfulToolNames.has(citation.toolName)).toBe(true);
      }

      console.log(
        JSON.stringify({
          confidence: parsed.data.answer.confidence,
          figures: parsed.data.answer.figures.length,
          citations: parsed.data.citations.map((citation) => citation.toolName),
          summary: parsed.data.summary,
        }),
      );
    },
    260_000,
  );
});
