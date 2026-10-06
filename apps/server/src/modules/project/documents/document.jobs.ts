export const DOCUMENT_QUEUES = {
  UPLOADED: 'document.uploaded',
  VERSION_CREATED: 'document.version_created',
} as const;

export interface DocumentUploadedPayload {
  organizationId: string;
  projectId: string;
  documentId: string;
  versionNumber: number;
  category?: string;
}
