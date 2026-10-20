/**
 * documentTypes — Group 9 DTOs mirroring document.routes.ts exactly.
 */

export type DocumentCategory =
  | 'DRAWING' | 'SPECIFICATION' | 'PERMIT' | 'CERTIFICATE'
  | 'REPORT' | 'PHOTO' | 'VIDEO' | 'CONTRACT' | 'INVOICE' | 'OTHER';

export type DocumentStatus =
  | 'PENDING_UPLOAD' | 'ACTIVE' | 'SUPERSEDED' | 'ARCHIVED' | 'DELETED';

export type DocumentProcessingStatus =
  | 'NOT_STARTED' | 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export type DocumentAccessPolicy =
  | 'PROJECT_MEMBERS' | 'PROJECT_MANAGERS_ONLY' | 'ADMIN_ONLY';

export interface DocumentDTO {
  id: string;
  organizationId: string;
  projectId: string;
  category: DocumentCategory;
  title: string;
  description: string | null;
  status: DocumentStatus;
  processingStatus: DocumentProcessingStatus;
  currentVersion: number;
  uploadedBy: string | null;
  fileName: string;
  fileSize: number;
  contentType: string;
  checksum: string | null;
  accessPolicy: DocumentAccessPolicy;
  expiryDate: string | null;
  expiresNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentVersionDTO {
  id: string;
  documentId: string;
  versionNumber: number;
  uploadedBy: string | null;
  fileName: string;
  fileSize: number;
  contentType: string;
  checksum: string | null;
  notes: string | null;
  createdAt: string;
}

export interface InitiateUploadInput {
  title: string;              // min:1 max:500
  category: DocumentCategory;
  fileName: string;           // min:1 max:255
  contentType: string;        // mime-type pattern
  fileSize: number;           // bytes, min:1
  description?: string;       // max:10000
  accessPolicy?: DocumentAccessPolicy;
  expiryDate?: string;        // YYYY-MM-DD
}

export interface InitiateVersionInput {
  fileName: string;
  contentType: string;
  fileSize: number;
  notes?: string;             // max:10000
}

export interface UpdateDocumentInput {
  title?: string;
  description?: string | null;
  accessPolicy?: DocumentAccessPolicy;
  expiryDate?: string | null;
}
