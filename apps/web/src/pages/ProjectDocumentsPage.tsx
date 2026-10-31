/**
 * ProjectDocumentsPage — /org/:orgId/projects/:projectId/documents
 *
 * S3 two-phase upload flow:
 *   1. initiateUpload → { document, uploadUrl }
 *   2. completeUpload({ checksum }) → status ACTIVE
 *
 * Permissions: project.document.upload / download / manage
 */
import React, { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, FileText, Trash2, ChevronDown, ChevronRight, Upload } from 'lucide-react';
import { cn } from '../lib/cn';
import {
  useListDocumentsQuery,
  useInitiateUploadMutation,
  useCompleteUploadMutation,
  useDeleteDocumentMutation,
  useListDocumentVersionsQuery,
} from '../features/project/documentApi';
import { usePermission } from '../hooks/usePermission';
import { useToast } from '../components/ui/Toast';
import { toastErrorMessage } from '../lib/authErrors';
import { inputCls } from '../components/ui/FormField';
import type { DocumentCategory, DocumentStatus } from '../types/documentTypes';

const CATEGORIES: DocumentCategory[] = ['DRAWING', 'SPECIFICATION', 'PERMIT', 'CERTIFICATE', 'REPORT', 'PHOTO', 'VIDEO', 'CONTRACT', 'INVOICE', 'OTHER'];

const STATUS_BADGE: Record<DocumentStatus, string> = {
  PENDING_UPLOAD: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  ACTIVE:         'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  SUPERSEDED:     'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  ARCHIVED:       'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  DELETED:        'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
};

const CATEGORY_FILTERS = ['ALL', ...CATEGORIES] as const;

// Versions sub-panel
const VersionsPanel: React.FC<{ orgId: string; projectId: string; documentId: string }> = ({ orgId, projectId, documentId }) => {
  const { data } = useListDocumentVersionsQuery({ orgId, projectId, documentId });
  const versions = data?.versions ?? [];
  if (versions.length === 0) return <div className="px-6 py-3 text-sm text-[var(--muted)]">No versions.</div>;
  return (
    <div className="px-4 pb-4 bg-[var(--paper)]">
      <div className="grid grid-cols-[50px_2fr_80px_100px_1fr] gap-3 px-0 py-2 border-b border-[var(--hairline-2)]">
        {['Ver.', 'File name', 'Size', 'Uploaded', 'Notes'].map((h) => (
          <p key={h} className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">{h}</p>
        ))}
      </div>
      {versions.map((v) => (
        <div key={v.id} className="grid grid-cols-[50px_2fr_80px_100px_1fr] gap-3 items-center py-2 border-b border-[var(--hairline-2)] last:border-b-0">
          <p className="font-mono text-[10px] text-[var(--muted)]">v{v.versionNumber}</p>
          <p className="text-sm truncate">{v.fileName}</p>
          <p className="font-mono text-[9px] text-[var(--muted)]">{(v.fileSize / 1024).toFixed(0)} KB</p>
          <p className="font-mono text-[9px] text-[var(--muted)]">{new Date(v.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}</p>
          <p className="text-sm text-[var(--muted)] truncate">{v.notes ?? '—'}</p>
        </div>
      ))}
    </div>
  );
};

export const ProjectDocumentsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const navigate = useNavigate();
  const { success: toastOk, error: toastErr } = useToast();
  const canUpload = usePermission('document:upload');
  const canManage = usePermission('project.document.manage');

  const [catFilter, setCatFilter] = useState<typeof CATEGORY_FILTERS[number]>('ALL');
  const [showUpload, setShowUpload] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Upload form
  const fileRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle]     = useState('');
  const [uploadCategory, setUploadCategory] = useState<DocumentCategory>('OTHER');
  const [uploadAccessPolicy, setUploadAccessPolicy] = useState<'PROJECT_MEMBERS' | 'PROJECT_MANAGERS_ONLY' | 'ADMIN_ONLY'>('PROJECT_MEMBERS');
  const [uploadExpiry, setUploadExpiry]   = useState('');
  const [uploadDesc, setUploadDesc]       = useState('');

  const { data, isLoading } = useListDocumentsQuery({
    orgId: orgId!,
    projectId: projectId!,
    category: catFilter !== 'ALL' ? catFilter as DocumentCategory : undefined,
  });
  const [initiateUpload] = useInitiateUploadMutation();
  const [completeUpload] = useCompleteUploadMutation();
  const [deleteDocument] = useDeleteDocumentMutation();

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    if (file && !uploadTitle) setUploadTitle(file.name.replace(/\.[^.]+$/, ''));
  };

  const onUpload = async () => {
    if (!selectedFile || !uploadTitle.trim()) { toastErr('File and title required', ''); return; }
    setUploading(true);
    try {
      // Phase 1: initiate
      const { document: doc, uploadUrl } = await initiateUpload({
        orgId: orgId!, projectId: projectId!,
        input: {
          title: uploadTitle.trim(),
          category: uploadCategory,
          fileName: selectedFile.name,
          contentType: selectedFile.type || 'application/octet-stream',
          fileSize: selectedFile.size,
          description: uploadDesc.trim() || undefined,
          accessPolicy: uploadAccessPolicy,
          expiryDate: uploadExpiry || undefined,
        },
      }).unwrap();

      // Phase 2: upload the file to the presigned object-storage URL.
      const uploadController = new AbortController();
      const uploadTimeout = window.setTimeout(() => uploadController.abort(), 30_000);
      let uploadResponse: Response;
      try {
        uploadResponse = await fetch(uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': selectedFile.type || 'application/octet-stream' },
          body: selectedFile,
          signal: uploadController.signal,
        });
      } catch (error) {
        if (uploadController.signal.aborted) {
          throw new Error('Storage upload timed out. Check the storage connection and try again.');
        }
        throw error;
      } finally {
        window.clearTimeout(uploadTimeout);
      }
      if (!uploadResponse.ok) {
        throw new Error(`Storage upload failed (${uploadResponse.status})`);
      }

      const digest = await crypto.subtle.digest('SHA-256', await selectedFile.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest), (byte) =>
        byte.toString(16).padStart(2, '0'),
      ).join('');

      // Phase 3: complete
      await completeUpload({ orgId: orgId!, projectId: projectId!, documentId: doc.id, checksum }).unwrap();

      toastOk('Document uploaded', doc.title);
      setShowUpload(false);
      setSelectedFile(null);
      setUploadTitle(''); setUploadDesc(''); setUploadExpiry('');
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      toastErr('Upload failed', err instanceof Error ? err.message : toastErrorMessage(err as never));
    } finally {
      setUploading(false);
    }
  };

  const onDelete = async (documentId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await deleteDocument({ orgId: orgId!, projectId: projectId!, documentId }).unwrap();
      toastOk('Document deleted', '');
    } catch (err) {
      toastErr('Delete failed', toastErrorMessage(err as never));
    }
  };

  const documents = data?.data ?? [];

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Documents</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{documents.length} document{documents.length !== 1 ? 's' : ''}</p>
        </div>
        {canUpload && !showUpload && (
          <button type="button" onClick={() => setShowUpload(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> Upload document
          </button>
        )}
      </div>

      {/* Upload form */}
      {showUpload && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Upload document</p>
          <p className="text-sm text-[var(--muted)]">
            File is uploaded directly to secure storage. The system verifies the checksum after upload.
          </p>

          {/* File picker */}
          <div className="border-2 border-dashed border-[var(--hairline-2)] p-6 text-center cursor-pointer hover:border-[var(--ink)] transition-colors"
            onClick={() => fileRef.current?.click()}>
            <Upload className="h-8 w-8 text-[var(--muted)] mx-auto mb-2" strokeWidth={1.5} />
            {selectedFile
              ? <p className="text-sm font-medium">{selectedFile.name} <span className="text-[var(--muted)]">({(selectedFile.size / 1024).toFixed(0)} KB)</span></p>
              : <p className="text-sm text-[var(--muted)]">Click to select file</p>}
            <input ref={fileRef} type="file" aria-label="Document file" className="hidden" onChange={onFileChange} />
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label>
              <input aria-label="Document title" value={uploadTitle} onChange={(e) => setUploadTitle(e.target.value)} maxLength={500} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Category</label>
              <select value={uploadCategory} onChange={(e) => setUploadCategory(e.target.value as DocumentCategory)} className={inputCls()}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Access policy</label>
              <select value={uploadAccessPolicy} onChange={(e) => setUploadAccessPolicy(e.target.value as any)} className={inputCls()}>
                <option value="PROJECT_MEMBERS">Project members</option>
                <option value="PROJECT_MANAGERS_ONLY">Managers only</option>
                <option value="ADMIN_ONLY">Admin only</option>
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Expiry date</label>
              <input type="date" value={uploadExpiry} onChange={(e) => setUploadExpiry(e.target.value)} className={inputCls()} />
            </div>
            <div className="sm:col-span-3">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label>
              <input value={uploadDesc} onChange={(e) => setUploadDesc(e.target.value)} maxLength={10000} className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onUpload} disabled={uploading || !selectedFile}
              className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
            <button type="button" onClick={() => { setShowUpload(false); setSelectedFile(null); setUploadTitle(''); }} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex border-b border-[var(--hairline-2)] mb-6 overflow-x-auto">
        {CATEGORY_FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setCatFilter(f)}
            className={`px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 whitespace-nowrap transition-colors ${catFilter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[28px_2fr_100px_90px_70px_70px_100px_80px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['', 'Title', 'Category', 'Status', 'Ver.', 'Size', 'Expiry', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />) :
        documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <FileText className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No documents yet.</p>
          </div>
        ) : documents.map((doc) => (
          <div key={doc.id}>
            <div
              onClick={() => navigate(`/org/${orgId}/projects/${projectId}/documents/${doc.id}`)}
              className="grid grid-cols-[28px_2fr_100px_90px_70px_70px_100px_80px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors"
            >
              <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === doc.id ? null : doc.id); }}
                className="p-0.5 text-[var(--muted)] hover:text-[var(--ink)]">
                {expandedId === doc.id ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} /> : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
              </button>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{doc.title}</p>
                <p className="font-mono text-[9px] text-[var(--muted)] truncate">{doc.fileName}</p>
              </div>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{doc.category}</p>
              <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[doc.status]}`}>
                {doc.status.replace('_', ' ')}
              </span>
              <p className="font-mono text-[10px] text-[var(--muted)]">v{doc.currentVersion}</p>
              <p className="font-mono text-[9px] text-[var(--muted)]">{(doc.fileSize / 1024).toFixed(0)} KB</p>
              <p className={cn('font-mono text-[9px]', doc.expiryDate && new Date(doc.expiryDate).getTime() - Date.now() < 30 * 86400000 ? 'text-[#92400e]' : 'text-[var(--muted)]')}>
                {doc.expiryDate ?? '—'}
              </p>
              <div className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {canManage && (
                  <button onClick={(e) => onDelete(doc.id, e)}
                    className="p-1 text-[var(--muted)] hover:text-[#991b1b] transition-colors" title="Delete">
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                )}
              </div>
            </div>
            {expandedId === doc.id && (
              <VersionsPanel orgId={orgId!} projectId={projectId!} documentId={doc.id} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
