import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { createTestApp } from '../helpers/test-app.js';
import { createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';

const runId = crypto.randomUUID().replaceAll('-', '').slice(0, 10);

describe('Organization-level tender audit scope (integration)', () => {
  let app: FastifyInstance;
  let token: string;
  let organizationId: string;

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `tender_audit_${runId}@example.com` });
    token = owner.token;
    organizationId = (
      await createOrgWithAdmin(app, token, `Tender Audit ${runId}`)
    ).orgId;

    const trial = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${organizationId}/billing/trial`,
      headers: { authorization: `Bearer ${token}` },
    });
    expect(trial.statusCode).toBe(201);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
  });

  it('updates and transitions tenders without a project foreign-key error', async () => {
    const tenderPath = `/api/v1/organizations/${organizationId}/tenders`;
    const created = await app.inject({
      method: 'POST',
      url: tenderPath,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `Tender ${runId}`,
        clientName: `Client ${runId}`,
        submissionDeadline: '2035-06-30T17:00:00+00:00',
        submissionTimezone: 'UTC',
        currencyCode: 'USD',
      },
    });
    expect(created.statusCode).toBe(201);
    const tenderId = created.json().data.tender.id as string;

    const updated = await app.inject({
      method: 'PATCH',
      url: `${tenderPath}/${tenderId}`,
      headers: { authorization: `Bearer ${token}` },
      payload: {
        title: `Updated tender ${runId}`,
        clientName: `Client ${runId}`,
        submissionDeadline: '2035-06-30T17:00:00+00:00',
        submissionTimezone: 'UTC',
        currencyCode: 'USD',
        expectedVersion: 1,
      },
    });
    expect(updated.statusCode).toBe(200);

    const transitioned = await app.inject({
      method: 'POST',
      url: `${tenderPath}/${tenderId}/submit`,
      headers: { authorization: `Bearer ${token}` },
      payload: { expectedVersion: 2 },
    });
    expect(transitioned.statusCode).toBe(200);
    expect(transitioned.json().data.tender.status).toBe('SUBMITTED');
  });
});
