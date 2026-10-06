import { and, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { documentAccessLogs, outboxEvents, projectMembers } from '@siteflow/database/schema';
import { documentVersions, documents } from '@siteflow/database/schema';
import { getDb } from '../../src/lib/db/index.js';
import { DocumentService } from '../../src/modules/project/documents/document.service.js';
import { DOCUMENT_QUEUES } from '../../src/modules/project/documents/document.jobs.js';
import type { ApiSuccessResponse } from '../../src/shared/response.js';
import type { ProjectDTO } from '../../src/modules/project/core/project.types.js';
import { createOrgWithAdmin, createVerifiedUser, addMemberDirectly } from '../helpers/fixtures.js';
import { createTestApp } from '../helpers/test-app.js';

describe('Project documents (integration)', () => {
  let app: FastifyInstance;
  let organizationId: string;
  let projectId: string;
  let ownerUserId: string;
  let ownerToken: string;
  let memberToken: string;
  let otherOrganizationId: string;
  let otherProjectId: string;
  let otherOwnerToken: string;
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

  const ensureProjectMember = async (
    targetOrganizationId: string,
    targetProjectId: string,
    userId: string,
    role: 'PROJECT_MEMBER' | 'PROJECT_MANAGER',
  ): Promise<void> => {
    const db = getDb();
    const [existing] = await db
      .select({ id: projectMembers.id, role: projectMembers.role })
      .from(projectMembers)
      .where(and(
        eq(projectMembers.organizationId, targetOrganizationId),
        eq(projectMembers.projectId, targetProjectId),
        eq(projectMembers.userId, userId),
      ))
      .limit(1);

    if (existing) {
      if (existing.role !== role) {
        await db.update(projectMembers).set({ role }).where(eq(projectMembers.id, existing.id));
      }
      return;
    }
    await db.insert(projectMembers).values({
      id: crypto.randomUUID(),
      organizationId: targetOrganizationId,
      projectId: targetProjectId,
      userId,
      role,
      status: 'ACTIVE',
      addedBy: ownerUserId,
    });
  };

  beforeAll(async () => {
    app = await createTestApp();

    const owner = await createVerifiedUser({ email: `documents_owner_${runId}@example.com` });
    ownerUserId = owner.user.id;
    ownerToken = owner.token;
    const organization = await createOrgWithAdmin(app, ownerToken, `Documents ${runId}`);
    organizationId = organization.orgId;
    const project = await createProject(ownerToken, organizationId, `Documents Project ${runId}`);
    projectId = project.id;
    await ensureProjectMember(organizationId, projectId, ownerUserId, 'PROJECT_MANAGER');

    const member = await createVerifiedUser({ email: `documents_member_${runId}@example.com` });
    memberToken = member.token;
    await addMemberDirectly(organizationId, member.user.id, organization.roleMap.get('Client')!);
    await ensureProjectMember(organizationId, projectId, member.user.id, 'PROJECT_MEMBER');

    const otherOwner = await createVerifiedUser({ email: `documents_other_${runId}@example.com` });
    otherOwnerToken = otherOwner.token;
    const otherOrganization = await createOrgWithAdmin(
      app,
      otherOwnerToken,
      `Other Documents ${runId}`,
    );
    otherOrganizationId = otherOrganization.orgId;
    const otherProject = await createProject(
      otherOwnerToken,
      otherOrganizationId,
      `Other Documents Project ${runId}`,
    );
    otherProjectId = otherProject.id;
  }, 60000);

  afterAll(async () => {
    await app.close();
  });

  it('completes uploads, enforces manager-only downloads, and hides cross-tenant documents', async () => {
    const basePath = `/api/v1/organizations/${organizationId}/projects/${projectId}/documents`;
    const content = `SiteFlow integration document ${runId}`;
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
    const checksum = Buffer.from(digest).toString('hex');

    const initiateResponse = await app.inject({
      method: 'POST',
      url: basePath,
      headers: { authorization: ['Bearer', ownerToken].join(' ') },
      payload: {
        title: 'Confidential progress report',
        category: 'REPORT',
        fileName: 'progress.txt',
        contentType: 'text/plain',
        fileSize: Buffer.byteLength(content),
        accessPolicy: 'PROJECT_MANAGERS_ONLY',
      },
    });
    expect(initiateResponse.statusCode).toBe(201);
    const initiated = initiateResponse.json<
      ApiSuccessResponse<{ document: { id: string; status: string }; uploadUrl: string }>
    >().data;
    expect(initiated.document.status).toBe('PENDING_UPLOAD');

    const uploadResponse = await fetch(initiated.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: content,
    });
    expect(uploadResponse.status).toBe(200);

    const completeResponse = await app.inject({
      method: 'POST',
      url: `${basePath}/${initiated.document.id}/complete`,
      headers: { authorization: ['Bearer', ownerToken].join(' ') },
      payload: { checksum },
    });
    expect(completeResponse.statusCode).toBe(200);
    const completed = completeResponse.json<
      ApiSuccessResponse<{ document: { id: string; status: string; processingStatus: string } }>
    >().data.document;
    expect(completed).toMatchObject({ status: 'ACTIVE', processingStatus: 'PENDING' });

    await new DocumentService().processUploadedVersion(
      organizationId,
      projectId,
      completed.id,
      1,
    );

    const downloadResponse = await app.inject({
      method: 'GET',
      url: `${basePath}/${completed.id}/download`,
      headers: { authorization: ['Bearer', ownerToken].join(' ') },
    });
    expect(downloadResponse.statusCode).toBe(200);
    const signedDownloadUrl = downloadResponse.json().data.downloadUrl as string;
    expect(signedDownloadUrl).toContain('X-Amz-Signature');

    const originalDocument = await getDb()
      .select({ storageKey: documents.storageKey, currentVersion: documents.currentVersion })
      .from(documents)
      .where(eq(documents.id, completed.id))
      .then((rows) => rows[0]!);
    const versionContent = `Updated SiteFlow document ${runId}`;
    const versionDigest = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(versionContent),
    );
    const versionChecksum = Buffer.from(versionDigest).toString('hex');

    const versionInitiateResponse = await app.inject({
      method: 'POST',
      url: `${basePath}/${completed.id}/versions`,
      headers: { authorization: ['Bearer', ownerToken].join(' ') },
      payload: {
        fileName: 'progress-v2.txt',
        contentType: 'text/plain',
        fileSize: Buffer.byteLength(versionContent),
      },
    });
    expect(versionInitiateResponse.statusCode).toBe(201);
    const initiatedVersion = versionInitiateResponse.json<
      ApiSuccessResponse<{ version: { id: string; versionNumber: number }; uploadUrl: string }>
    >().data;
    expect(initiatedVersion.version.versionNumber).toBe(2);
    expect(originalDocument.currentVersion).toBe(1);

    const versionUploadResponse = await fetch(initiatedVersion.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'text/plain' },
      body: versionContent,
    });
    expect(versionUploadResponse.status).toBe(200);

    const versionCompleteResponse = await app.inject({
      method: 'POST',
      url: `${basePath}/${completed.id}/versions/${initiatedVersion.version.id}/complete`,
      headers: { authorization: ['Bearer', ownerToken].join(' ') },
      payload: { checksum: versionChecksum },
    });
    expect(versionCompleteResponse.statusCode).toBe(200);
    await new DocumentService().processUploadedVersion(
      organizationId,
      projectId,
      completed.id,
      2,
    );
    const currentDocument = await getDb()
      .select({ storageKey: documents.storageKey, currentVersion: documents.currentVersion })
      .from(documents)
      .where(eq(documents.id, completed.id))
      .then((rows) => rows[0]!);
    expect(currentDocument.currentVersion).toBe(2);
    expect(currentDocument.storageKey).not.toBe(originalDocument.storageKey);

    const versions = await getDb()
      .select()
      .from(documentVersions)
      .where(eq(documentVersions.documentId, completed.id));
    expect(versions).toHaveLength(2);
    expect(versions.find((version) => version.versionNumber === 1)?.storageKey)
      .toBe(originalDocument.storageKey);

    const memberResponse = await app.inject({
      method: 'GET',
      url: `${basePath}/${completed.id}/download`,
      headers: { authorization: ['Bearer', memberToken].join(' ') },
    });
    expect(memberResponse.statusCode).toBe(403);

    const adminOnlyResponse = await app.inject({
      method: 'PATCH',
      url: `${basePath}/${completed.id}`,
      headers: { authorization: ['Bearer', ownerToken].join(' ') },
      payload: { accessPolicy: 'ADMIN_ONLY' },
    });
    expect(adminOnlyResponse.statusCode).toBe(200);
    const nonAdminDownload = await app.inject({
      method: 'GET',
      url: `${basePath}/${completed.id}/download`,
      headers: { authorization: ['Bearer', memberToken].join(' ') },
    });
    expect(nonAdminDownload.statusCode).toBe(403);

    const foreignDocumentResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/organizations/${otherOrganizationId}/projects/${otherProjectId}/documents`,
      headers: { authorization: ['Bearer', otherOwnerToken].join(' ') },
      payload: {
        title: 'Foreign document',
        category: 'REPORT',
        fileName: 'foreign.txt',
        contentType: 'text/plain',
        fileSize: 1,
      },
    });
    expect(foreignDocumentResponse.statusCode).toBe(201);
    const foreignDocumentId = foreignDocumentResponse.json<
      ApiSuccessResponse<{ document: { id: string } }>
    >().data.document.id;

    const documentListResponse = await app.inject({
      method: 'GET',
      url: `${basePath}?limit=100`,
      headers: { authorization: ['Bearer', ownerToken].join(' ') },
    });
    expect(documentListResponse.statusCode).toBe(200);
    expect(documentListResponse.body).not.toContain(foreignDocumentId);

    const crossTenantDownload = await app.inject({
      method: 'GET',
      url: `${basePath}/${foreignDocumentId}/download`,
      headers: { authorization: ['Bearer', ownerToken].join(' ') },
    });
    expect(crossTenantDownload.statusCode).toBe(404);
    expect(crossTenantDownload.body).not.toContain('downloadUrl');
    expect(crossTenantDownload.body).not.toContain('X-Amz-Signature');
    const crossTenantVersions = await app.inject({
      method: 'GET',
      url: `${basePath}/${foreignDocumentId}/versions`,
      headers: { authorization: ['Bearer', ownerToken].join(' ') },
    });
    expect(crossTenantVersions.statusCode).toBe(404);

    const [tenantDocument] = await getDb().select({ storageKey: documents.storageKey })
      .from(documents).where(eq(documents.id, completed.id));
    const [otherTenantDocument] = await getDb().select({ storageKey: documents.storageKey })
      .from(documents).where(eq(documents.id, foreignDocumentId));
    expect(tenantDocument?.storageKey).not.toBe(otherTenantDocument?.storageKey);

    const logs = await getDb()
      .select()
      .from(documentAccessLogs)
      .where(and(
        eq(documentAccessLogs.organizationId, organizationId),
        eq(documentAccessLogs.documentId, completed.id),
      ));
    expect(logs.map((log) => log.accessType)).toContain('DOWNLOAD');
      expect(JSON.stringify(logs)).not.toContain(signedDownloadUrl);

    const events = await getDb()
      .select()
      .from(outboxEvents)
      .where(and(
        eq(outboxEvents.organizationId, organizationId),
        eq(outboxEvents.eventType, DOCUMENT_QUEUES.UPLOADED),
      ));
    expect(events.some((event) => (event.payload as { documentId?: string }).documentId === completed.id))
      .toBe(true);
  }, 60000);
});
