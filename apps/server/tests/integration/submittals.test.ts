import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  documentEntityLinks,
  documents,
  outboxEvents,
  projectMembers,
  submittalRevisions,
  submittalRevisionReviews,
  submittals,
} from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import {
  addMemberDirectly,
  createOrgWithAdmin,
  createVerifiedUser,
} from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

describe('Project submittals (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let reviewerMemberId: string;
  let foreignReviewerMemberId: string;
  let otherAdminToken: string;
  let foreignOrganizationId: string;
  let foreignProjectId: string;
  let foreignOwnerToken: string;
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
    const owner = await createVerifiedUser({ email: `submittal_owner_${runId}@example.com` });
    ownerUserId = owner.user.id;
    ownerToken = owner.token;
    const organization = await createOrgWithAdmin(app, ownerToken, `Submittals ${runId}`);
    organizationId = organization.orgId;
    projectId = (await createProject(ownerToken, organizationId, `Submittal Project ${runId}`)).id;

    const [ownerMembership] = await getDb().select({ id: projectMembers.id })
      .from(projectMembers).where(and(
        eq(projectMembers.organizationId, organizationId),
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, ownerUserId),
      )).limit(1);
    reviewerMemberId = ownerMembership!.id;

    const otherProjectId = (await createProject(
      ownerToken,
      organizationId,
      `Other Submittal Project ${runId}`,
    )).id;
    const [otherProjectMembership] = await getDb().select({ id: projectMembers.id })
      .from(projectMembers).where(and(
        eq(projectMembers.organizationId, organizationId),
        eq(projectMembers.projectId, otherProjectId),
        eq(projectMembers.userId, ownerUserId),
      )).limit(1);
    foreignReviewerMemberId = otherProjectMembership!.id;

    const otherAdmin = await createVerifiedUser({ email: `submittal_other_${runId}@example.com` });
    otherAdminToken = otherAdmin.token;
    await addMemberDirectly(
      organizationId,
      otherAdmin.user.id,
      organization.roleMap.get('Organization Admin')!,
    );

    const foreignOwner = await createVerifiedUser({ email: `submittal_foreign_${runId}@example.com` });
    foreignOwnerToken = foreignOwner.token;
    const foreignOrganization = await createOrgWithAdmin(
      app,
      foreignOwnerToken,
      `Foreign Submittals ${runId}`,
    );
    foreignOrganizationId = foreignOrganization.orgId;
    foreignProjectId = (await createProject(
      foreignOwnerToken,
      foreignOrganizationId,
      `Foreign Submittal Project ${runId}`,
    )).id;
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('preserves immutable revisions, checks reviewer ownership, and serializes concurrent reviews', async () => {
    const base = `/api/v1/organizations/${organizationId}/projects/${projectId}/submittals`;
    const auth = { authorization: ['Bearer', ownerToken].join(' ') };
    const createResponse = await app.inject({
      method: 'POST',
      url: base,
      headers: auth,
      payload: {
        title: 'Concrete mix design',
        specReference: '03 30 00',
        discipline: 'Structural',
        reviewerMemberId,
        dueDate: '2027-03-01',
      },
    });
    expect(createResponse.statusCode).toBe(201);
    const submittal = createResponse.json<ApiSuccessResponse<{
      submittal: { id: string; submittalNumber: string; status: string };
    }>>().data.submittal;
    expect(submittal.status).toBe('DRAFT');
    expect(submittal.submittalNumber).toMatch(/^SUB-\d{6}-\d{3,}$/);

    const foreignBase = `/api/v1/organizations/${foreignOrganizationId}/projects/${foreignProjectId}/submittals`;
    const foreignSubmittalResponse = await app.inject({
      method: 'POST',
      url: foreignBase,
      headers: { authorization: ['Bearer', foreignOwnerToken].join(' ') },
      payload: { title: 'Foreign project submittal' },
    });
    expect(foreignSubmittalResponse.statusCode).toBe(201);
    const foreignSubmittalId = foreignSubmittalResponse.json<ApiSuccessResponse<{
      submittal: { id: string };
    }>>().data.submittal.id;
    const submittalListResponse = await app.inject({
      method: 'GET',
      url: `${base}?limit=100`,
      headers: auth,
    });
    expect(submittalListResponse.statusCode).toBe(200);
    expect(submittalListResponse.body).not.toContain(foreignSubmittalId);
    const foreignRevisionsResponse = await app.inject({
      method: 'GET',
      url: `${base}/${foreignSubmittalId}/revisions`,
      headers: auth,
    });
    expect(foreignRevisionsResponse.statusCode).toBe(404);

    const foreignReviewerResponse = await app.inject({
      method: 'POST',
      url: base,
      headers: auth,
      payload: {
        title: 'Invalid cross-project reviewer',
        reviewerMemberId: foreignReviewerMemberId,
      },
    });
    expect(foreignReviewerResponse.statusCode).toBe(422);

    const evidenceDocumentId = crypto.randomUUID();
    await getDb().insert(documents).values({
      id: evidenceDocumentId,
      organizationId,
      projectId,
      category: 'SPECIFICATION',
      title: 'Product data evidence',
      status: 'ACTIVE',
      processingStatus: 'COMPLETED',
      uploadedBy: ownerUserId,
      fileName: 'product-data.pdf',
      fileSize: 1,
      contentType: 'application/pdf',
      storageKey: `tests/${evidenceDocumentId}.pdf`,
      accessPolicy: 'PROJECT_MANAGERS_ONLY',
    });
    const attachResponse = await app.inject({
      method: 'POST',
      url: `${base}/${submittal.id}/documents`,
      headers: auth,
      payload: { documentId: evidenceDocumentId },
    });
    expect(attachResponse.statusCode).toBe(204);
    const links = await getDb().select().from(documentEntityLinks)
      .where(eq(documentEntityLinks.documentId, evidenceDocumentId));
    expect(links[0]).toMatchObject({ entityType: 'submittal', entityId: submittal.id });

    const submitResponse = await app.inject({
      method: 'POST',
      url: `${base}/${submittal.id}/submit`,
      headers: auth,
    });
    expect(submitResponse.statusCode).toBe(200);
    expect(submitResponse.json().data.submittal.status).toBe('SUBMITTED');

    const unauthorizedReviewer = await app.inject({
      method: 'POST',
      url: `${base}/${submittal.id}/review`,
      headers: { authorization: ['Bearer', otherAdminToken].join(' ') },
      payload: { response: 'REVISE_AND_RESUBMIT', responseNotes: 'Provide updated data.' },
    });
    expect(unauthorizedReviewer.statusCode).toBe(403);

    const reviseResponse = await app.inject({
      method: 'POST',
      url: `${base}/${submittal.id}/review`,
      headers: auth,
      payload: { response: 'REVISE_AND_RESUBMIT', responseNotes: 'Provide updated data.' },
    });
    expect(reviseResponse.statusCode).toBe(200);
    expect(reviseResponse.json().data.submittal.status).toBe('REVISE_AND_RESUBMIT');

    const resubmitResponse = await app.inject({
      method: 'POST',
      url: `${base}/${submittal.id}/resubmit`,
      headers: auth,
    });
    expect(resubmitResponse.statusCode).toBe(200);
    expect(resubmitResponse.json().data.submittal.status).toBe('SUBMITTED');

    const revisionsResponse = await app.inject({
      method: 'GET',
      url: `${base}/${submittal.id}/revisions`,
      headers: auth,
    });
    expect(revisionsResponse.statusCode).toBe(200);
    expect(revisionsResponse.json().data.revisions).toHaveLength(2);
    expect(revisionsResponse.json().data.revisions[0]).toMatchObject({
      revisionNumber: 1,
      status: 'REVISE_AND_RESUBMIT',
      responseNotes: 'Provide updated data.',
    });
    expect(revisionsResponse.json().data.revisions[1]).toMatchObject({
      revisionNumber: 2,
      status: 'SUBMITTED',
    });
    const revisionDetailResponse = await app.inject({
      method: 'GET',
      url: `${base}/${submittal.id}/revisions/${revisionsResponse.json().data.revisions[0].id}`,
      headers: auth,
    });
    expect(revisionDetailResponse.statusCode).toBe(200);
    expect(revisionDetailResponse.json().data.revision).toMatchObject({
      revisionNumber: 1,
      status: 'REVISE_AND_RESUBMIT',
    });

    const reviewRequest = () => app.inject({
      method: 'POST',
      url: `${base}/${submittal.id}/review`,
      headers: auth,
      payload: { response: 'APPROVED', responseNotes: 'Accepted.' },
    });
    const concurrentReviews = await Promise.all([reviewRequest(), reviewRequest()]);
    expect(concurrentReviews.map((response) => response.statusCode).sort()).toEqual([200, 422]);

    const closeResponse = await app.inject({
      method: 'POST',
      url: `${base}/${submittal.id}/close`,
      headers: auth,
    });
    expect(closeResponse.statusCode).toBe(200);
    expect(closeResponse.json().data.submittal.status).toBe('CLOSED');

    const storedRevisions = await getDb().select().from(submittalRevisions)
      .where(eq(submittalRevisions.submittalId, submittal.id));
    expect(storedRevisions).toHaveLength(2);
    expect(storedRevisions.map((revision) => revision.status)).toEqual(['SUBMITTED', 'SUBMITTED']);
    const reviewRows = await getDb().select().from(submittalRevisionReviews).where(and(
      eq(submittalRevisionReviews.submittalId, submittal.id),
      eq(submittalRevisionReviews.organizationId, organizationId),
    ));
    expect(reviewRows).toHaveLength(2);
    const events = await getDb().select().from(outboxEvents).where(
      eq(outboxEvents.organizationId, organizationId),
    );
    expect(events.map((event) => event.eventType)).toEqual(
      expect.arrayContaining([
        'submittal.submitted',
        'submittal.reviewed',
        'submittal.resubmitted',
        'submittal.closed',
      ]),
    );
    const storedHeader = await getDb().select().from(submittals)
      .where(eq(submittals.id, submittal.id));
    expect(storedHeader[0]?.status).toBe('CLOSED');
  });
});
