import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { and, eq } from 'drizzle-orm';
import {
  financialAuditEvents,
  projectCostCodes,
  projects,
  scheduleOfValueRevisions,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 12);
const authHeaders = (token: string) => ({ authorization: `Bearer ${token}` });

describe('commercial segregation of duties (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let costCodeId: string;
  let actorUserId: string;
  let token: string;

  const projectBase = () => `/api/v1/organizations/${organizationId}/projects/${projectId}`;

  beforeAll(async () => {
    app = await createTestApp();
    const user = await createVerifiedUser({ email: `commercial-sod-${runId}@example.com` });
    actorUserId = user.user.id;
    token = user.token;
    organizationId = (await createOrgWithAdmin(app, token, `Commercial SoD ${runId}`)).orgId;
    projectId = crypto.randomUUID();
    costCodeId = crypto.randomUUID();
    await getDb()
      .insert(projects)
      .values({
        id: projectId,
        organizationId,
        projectNumber: `SOD-${runId}`,
        name: `Commercial SoD ${runId}`,
        currency: 'USD',
      });
    await getDb()
      .insert(projectCostCodes)
      .values({
        id: costCodeId,
        organizationId,
        projectId,
        code: `SOD-${runId}`,
        createdBy: actorUserId,
      });
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('denies the SOV creator from approving their own submitted revision without mutation or audit side effects', async () => {
    const created = await app.inject({
      method: 'POST',
      url: `${projectBase()}/schedule-of-values`,
      headers: authHeaders(token),
      payload: {
        contractValue: '100.00',
        currencyCode: 'USD',
        lines: [
          {
            description: 'SoD test scope',
            costCodeId,
            scheduledValue: '100.00',
            retainagePercent: '0.00',
          },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const schedule = created.json().data.scheduleOfValues;

    const submitted = await app.inject({
      method: 'POST',
      url: `${projectBase()}/schedule-of-values/${schedule.id}/submit`,
      headers: authHeaders(token),
      payload: { expectedVersion: schedule.version },
    });
    expect(submitted.statusCode).toBe(200);
    const pending = submitted.json().data.scheduleOfValues;

    const auditsBefore = await getDb()
      .select({ id: financialAuditEvents.id })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityType, 'ScheduleOfValues'),
          eq(financialAuditEvents.entityId, schedule.id),
        ),
      );
    const denied = await app.inject({
      method: 'POST',
      url: `${projectBase()}/schedule-of-values/${schedule.id}/approve`,
      headers: authHeaders(token),
      payload: { expectedVersion: pending.version },
    });
    expect(denied.statusCode).toBe(403);
    expect(denied.json().error.code).toBe('FINANCIAL_SOD_VIOLATION');

    const [persisted] = await getDb()
      .select()
      .from(scheduleOfValueRevisions)
      .where(
        and(
          eq(scheduleOfValueRevisions.organizationId, organizationId),
          eq(scheduleOfValueRevisions.projectId, projectId),
          eq(scheduleOfValueRevisions.scheduleOfValuesId, schedule.id),
        ),
      );
    const auditsAfter = await getDb()
      .select({ id: financialAuditEvents.id })
      .from(financialAuditEvents)
      .where(
        and(
          eq(financialAuditEvents.organizationId, organizationId),
          eq(financialAuditEvents.projectId, projectId),
          eq(financialAuditEvents.entityType, 'ScheduleOfValues'),
          eq(financialAuditEvents.entityId, schedule.id),
        ),
      );
    expect(persisted?.status).toBe('PENDING_APPROVAL');
    expect(auditsAfter.map((event) => event.id)).toEqual(auditsBefore.map((event) => event.id));
  });
});
