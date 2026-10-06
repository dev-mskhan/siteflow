import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  documentEntityLinks,
  documents,
  outboxEvents,
  projectMembers,
  rfis,
  tasks,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import { addMemberDirectly, createOrgWithAdmin, createVerifiedUser } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

describe('Project RFIs (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let memberToken: string;
  let otherOrganizationId: string;
  let otherProjectId: string;
  let otherToken: string;
  let foreignTaskId: string;
  const runId = crypto.randomUUID().slice(0, 8);

  const createProject = async (
    token: string,
    targetOrganizationId: string,
    name: string,
  ): Promise<ProjectDTO> => {
    const response = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${targetOrganizationId}/projects`,
      headers: { authorization: ['Bearer', token].join(' ') },
      payload: { name, currency: 'USD' },
    });
    expect(response.statusCode).toBe(201);
    return response.json<ApiSuccessResponse<{ project: ProjectDTO }>>().data.project;
  };

  beforeAll(async () => {
    app = await createTestApp();
    const owner = await createVerifiedUser({ email: `rfi_owner_${runId}@example.com` });
    ownerUserId = owner.user.id;
    ownerToken = owner.token;
    const organization = await createOrgWithAdmin(app, ownerToken, `RFI ${runId}`);
    organizationId = organization.orgId;
    projectId = (await createProject(ownerToken, organizationId, `RFI Project ${runId}`)).id;

    const member = await createVerifiedUser({ email: `rfi_member_${runId}@example.com` });
    memberToken = member.token;
    await addMemberDirectly(organizationId, member.user.id, organization.roleMap.get('Client')!);
    await getDb().insert(projectMembers).values({
      id: crypto.randomUUID(),
      organizationId,
      projectId,
      userId: member.user.id,
      role: 'PROJECT_MEMBER',
      status: 'ACTIVE',
      addedBy: ownerUserId,
    });

    const other = await createVerifiedUser({ email: `rfi_other_${runId}@example.com` });
    otherToken = other.token;
    const otherOrganization = await createOrgWithAdmin(app, otherToken, `Other RFI ${runId}`);
    otherOrganizationId = otherOrganization.orgId;
    otherProjectId = (await createProject(otherToken, otherOrganizationId, `Other Project ${runId}`)).id;
    foreignTaskId = crypto.randomUUID();
    await getDb().insert(tasks).values({
      id: foreignTaskId,
      organizationId: otherOrganizationId,
      projectId: otherProjectId,
      taskCode: `FOREIGN-${runId}`,
      name: 'Foreign project task',
    });
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('allocates scoped numbers, validates task ownership, and enforces the RFI lifecycle', async () => {
    const base = `/api/v1/organizations/${organizationId}/projects/${projectId}/rfis`;
    const auth = { authorization: ['Bearer', ownerToken].join(' ') };
    const invalidLinkedTask = await app.inject({
      method: 'POST',
      url: base,
      headers: auth,
      payload: {
        title: 'Foreign task inquiry',
        question: 'Does this task belong to our project?',
        linkedTaskId: foreignTaskId,
      },
    });
    expect(invalidLinkedTask.statusCode).toBe(422);

    const foreignBase = `/api/v1/organizations/${otherOrganizationId}/projects/${otherProjectId}/rfis`;
    const foreignRfiResponse = await app.inject({
      method: 'POST',
      url: foreignBase,
      headers: { authorization: ['Bearer', otherToken].join(' ') },
      payload: {
        title: 'Foreign project RFI',
        question: 'This inquiry belongs to another organization.',
      },
    });
    expect(foreignRfiResponse.statusCode).toBe(201);
    const foreignRfiId = foreignRfiResponse.json<ApiSuccessResponse<{
      rfi: { id: string };
    }>>().data.rfi.id;

    const createResponse = await app.inject({
      method: 'POST',
      url: base,
      headers: auth,
      payload: {
        title: 'Clarify foundation detail',
        question: 'Confirm the specified reinforcement at grid A-1.',
        discipline: 'Structural',
        priority: 'HIGH',
        dueDate: '2027-01-15',
        scheduleImpactDays: 3,
        costImpact: 1250.5,
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const created = createResponse.json<ApiSuccessResponse<{
      rfi: { id: string; rfiNumber: string; status: string };
    }>>().data.rfi;
    expect(created).toMatchObject({ status: 'DRAFT' });
    expect(created.rfiNumber).toMatch(/^RFI-\d{6}-\d{3,}$/);

    const rfiListResponse = await app.inject({
      method: 'GET',
      url: `${base}?limit=100`,
      headers: auth,
    });
    expect(rfiListResponse.statusCode).toBe(200);
    expect(rfiListResponse.body).not.toContain(foreignRfiId);

    const evidenceDocumentId = crypto.randomUUID();
    await getDb().insert(documents).values({
      id: evidenceDocumentId,
      organizationId,
      projectId,
      category: 'DRAWING',
      title: 'RFI drawing evidence',
      status: 'ACTIVE',
      processingStatus: 'COMPLETED',
      uploadedBy: ownerUserId,
      fileName: 'drawing.pdf',
      fileSize: 1,
      contentType: 'application/pdf',
      storageKey: `tests/${evidenceDocumentId}.pdf`,
      accessPolicy: 'PROJECT_MANAGERS_ONLY',
    });
    const attachResponse = await app.inject({
      method: 'POST',
      url: `${base}/${created.id}/documents`,
      headers: auth,
      payload: { documentId: evidenceDocumentId },
    });
    expect(attachResponse.statusCode).toBe(204);
    const links = await getDb().select().from(documentEntityLinks)
      .where(eq(documentEntityLinks.documentId, evidenceDocumentId));
    expect(links[0]).toMatchObject({
      organizationId,
      entityType: 'rfi',
      entityId: created.id,
    });

    const secondCreateResponse = await app.inject({
      method: 'POST',
      url: base,
      headers: auth,
      payload: { title: 'Secondary inquiry', question: 'Confirm the alternate finish.' },
    });
    expect(secondCreateResponse.statusCode).toBe(201);
    const secondRfi = secondCreateResponse.json<ApiSuccessResponse<{
      rfi: { id: string; rfiNumber: string };
    }>>().data.rfi;
    expect(secondRfi.rfiNumber).not.toBe(created.rfiNumber);

    const concurrentSubmitRfiResponse = await app.inject({
      method: 'POST',
      url: base,
      headers: auth,
      payload: { title: 'Concurrent submission inquiry', question: 'Can this be submitted once?' },
    });
    expect(concurrentSubmitRfiResponse.statusCode).toBe(201);
    const concurrentSubmitRfi = concurrentSubmitRfiResponse.json<ApiSuccessResponse<{
      rfi: { id: string };
    }>>().data.rfi;
    const submitRequests = await Promise.all([ownerToken, memberToken].map((token) => app.inject({
      method: 'POST',
      url: `${base}/${concurrentSubmitRfi.id}/submit`,
      headers: { authorization: ['Bearer', token].join(' ') },
    })));
    expect(submitRequests.map((response) => response.statusCode).sort()).toEqual([200, 422]);
    const submittedRfi = await getDb().select().from(rfis)
      .where(eq(rfis.id, concurrentSubmitRfi.id));
    expect(submittedRfi[0]?.status).toBe('OPEN');

    const invalidResponse = await app.inject({
      method: 'POST',
      url: `${base}/${created.id}/respond`,
      headers: auth,
      payload: { response: 'Response before submit' },
    });
    expect(invalidResponse.statusCode).toBe(422);

    const submitResponse = await app.inject({
      method: 'POST',
      url: `${base}/${created.id}/submit`,
      headers: auth,
    });
    expect(submitResponse.statusCode).toBe(200);
    expect(submitResponse.json().data.rfi.status).toBe('OPEN');

    const editAfterSubmit = await app.inject({
      method: 'PATCH',
      url: `${base}/${created.id}`,
      headers: auth,
      payload: { title: 'Cannot edit submitted RFI' },
    });
    expect(editAfterSubmit.statusCode).toBe(422);

    const respondResponse = await app.inject({
      method: 'POST',
      url: `${base}/${created.id}/respond`,
      headers: auth,
      payload: { response: 'Use the reinforcement detail on drawing S-04.', scheduleImpactDays: 2 },
    });
    expect(respondResponse.statusCode).toBe(200);
    expect(respondResponse.json().data.rfi).toMatchObject({
      status: 'ANSWERED',
      scheduleImpactDays: 2,
      response: 'Use the reinforcement detail on drawing S-04.',
    });

    const closeResponse = await app.inject({
      method: 'POST',
      url: `${base}/${created.id}/close`,
      headers: auth,
    });
    expect(closeResponse.statusCode).toBe(200);
    expect(closeResponse.json().data.rfi.status).toBe('CLOSED');

    const cancelResponse = await app.inject({
      method: 'POST',
      url: `${base}/${secondRfi.id}/cancel`,
      headers: auth,
    });
    expect(cancelResponse.statusCode).toBe(200);
    expect(cancelResponse.json().data.rfi.status).toBe('CANCELLED');

    const foreignRead = await app.inject({
      method: 'GET',
      url: `/api/v1/organizations/${otherOrganizationId}/projects/${otherProjectId}/rfis/${created.id}`,
      headers: { authorization: ['Bearer', otherToken].join(' ') },
    });
    expect(foreignRead.statusCode).toBe(404);

    const stored = await getDb().select().from(rfis).where(eq(rfis.id, created.id));
    expect(stored[0]).toMatchObject({ organizationId, projectId, status: 'CLOSED' });
    const events = await getDb().select().from(outboxEvents).where(and(
      eq(outboxEvents.organizationId, organizationId),
    ));
    const rfiEvents = events.filter((event) =>
      ['rfi.submitted', 'rfi.responded', 'rfi.closed'].includes(event.eventType),
    );
    expect(rfiEvents.map((event) => event.eventType)).toEqual(
      expect.arrayContaining(['rfi.submitted', 'rfi.responded', 'rfi.closed']),
    );
  });
});
