import { and, desc, eq, lt, or, sql } from 'drizzle-orm';
import {
  documentAccessLogs,
  documentEntityLinks,
  documentVersions,
  documents,
  type Document,
  type DocumentVersion,
  type NewDocument,
  type NewDocumentAccessLog,
  type NewDocumentEntityLink,
  type NewDocumentVersion,
} from '@siteflow/database/schema';

export interface DocumentListOptions {
  organizationId: string;
  projectId: string;
  limit: number;
  category?: string;
  status?: string;
  cursor?: { createdAt: Date; id: string };
}

export class DocumentRepository {
  async findById(db: any, organizationId: string, projectId: string, id: string): Promise<Document | undefined> {
    const [row] = await db
      .select()
      .from(documents)
      .where(and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        eq(documents.projectId, projectId),
      ))
      .limit(1);
    return row;
  }

  async findByIdForUpdate(
    tx: any,
    organizationId: string,
    projectId: string,
    id: string,
  ): Promise<Document | undefined> {
    await tx.execute(sql`SELECT id FROM app.documents
      WHERE id = ${id} AND organization_id = ${organizationId} AND project_id = ${projectId}
      FOR UPDATE`);
    return this.findById(tx, organizationId, projectId, id);
  }

  async create(tx: any, input: NewDocument): Promise<Document> {
    const [row] = await tx.insert(documents).values(input).returning();
    return row;
  }

  async update(
    tx: any,
    organizationId: string,
    projectId: string,
    id: string,
    patch: Partial<NewDocument>,
  ): Promise<Document | undefined> {
    const [row] = await tx
      .update(documents)
      .set(patch)
      .where(and(
        eq(documents.id, id),
        eq(documents.organizationId, organizationId),
        eq(documents.projectId, projectId),
      ))
      .returning();
    return row;
  }

  async listByProject(db: any, options: DocumentListOptions): Promise<Document[]> {
    const filters = [
      eq(documents.organizationId, options.organizationId),
      eq(documents.projectId, options.projectId),
    ];
    if (options.category) filters.push(eq(documents.category, options.category as Document['category']));
    if (options.status) filters.push(eq(documents.status, options.status as Document['status']));
    if (options.cursor) {
      filters.push(or(
        lt(documents.createdAt, options.cursor.createdAt),
        and(eq(documents.createdAt, options.cursor.createdAt), lt(documents.id, options.cursor.id)),
      )!);
    }
    return db
      .select({
        id: documents.id,
        organizationId: documents.organizationId,
        projectId: documents.projectId,
        category: documents.category,
        title: documents.title,
        description: documents.description,
        status: documents.status,
        processingStatus: documents.processingStatus,
        currentVersion: documents.currentVersion,
        uploadedBy: documents.uploadedBy,
        fileName: documents.fileName,
        fileSize: documents.fileSize,
        contentType: documents.contentType,
        checksum: documents.checksum,
        accessPolicy: documents.accessPolicy,
        expiryDate: documents.expiryDate,
        expiresNotified: documents.expiresNotified,
        createdAt: documents.createdAt,
        updatedAt: documents.updatedAt,
      })
      .from(documents)
      .where(and(...filters))
      .orderBy(desc(documents.createdAt), desc(documents.id))
      .limit(options.limit + 1);
  }

  async createVersion(tx: any, input: NewDocumentVersion): Promise<DocumentVersion> {
    const [row] = await tx.insert(documentVersions).values(input).returning();
    return row;
  }

  async findVersionById(
    db: any,
    organizationId: string,
    documentId: string,
    versionId: string,
  ): Promise<DocumentVersion | undefined> {
    const [row] = await db
      .select()
      .from(documentVersions)
      .where(and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.organizationId, organizationId),
        eq(documentVersions.documentId, documentId),
      ))
      .limit(1);
    return row;
  }

  async findVersionByNumber(
    tx: any,
    organizationId: string,
    documentId: string,
    versionNumber: number,
  ): Promise<DocumentVersion | undefined> {
    const [row] = await tx
      .select()
      .from(documentVersions)
      .where(and(
        eq(documentVersions.organizationId, organizationId),
        eq(documentVersions.documentId, documentId),
        eq(documentVersions.versionNumber, versionNumber),
      ))
      .limit(1);
    return row;
  }

  async findVersionByIdForUpdate(
    tx: any,
    organizationId: string,
    documentId: string,
    versionId: string,
  ): Promise<DocumentVersion | undefined> {
    await tx.execute(sql`SELECT id FROM app.document_versions
      WHERE id = ${versionId} AND organization_id = ${organizationId} AND document_id = ${documentId}
      FOR UPDATE`);
    return this.findVersionById(tx, organizationId, documentId, versionId);
  }

  async updateVersion(
    tx: any,
    organizationId: string,
    documentId: string,
    versionId: string,
    patch: Partial<NewDocumentVersion>,
  ): Promise<DocumentVersion | undefined> {
    const [row] = await tx
      .update(documentVersions)
      .set(patch)
      .where(and(
        eq(documentVersions.id, versionId),
        eq(documentVersions.organizationId, organizationId),
        eq(documentVersions.documentId, documentId),
      ))
      .returning();
    return row;
  }

  async listVersions(db: any, organizationId: string, documentId: string): Promise<DocumentVersion[]> {
    return db
      .select()
      .from(documentVersions)
      .where(and(
        eq(documentVersions.organizationId, organizationId),
        eq(documentVersions.documentId, documentId),
      ))
      .orderBy(desc(documentVersions.versionNumber));
  }

  async createAccessLog(tx: any, input: NewDocumentAccessLog): Promise<void> {
    await tx.insert(documentAccessLogs).values(input);
  }

  async linkDocument(tx: any, input: NewDocumentEntityLink): Promise<void> {
    await tx
      .insert(documentEntityLinks)
      .values(input)
      .onConflictDoNothing({
        target: [
          documentEntityLinks.documentId,
          documentEntityLinks.entityType,
          documentEntityLinks.entityId,
        ],
      });
  }
}
