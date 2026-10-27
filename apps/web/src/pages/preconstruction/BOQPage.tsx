/**
 * BOQPage — /org/:orgId/projects/:projectId/preconstruction/boq
 *
 * Backend:
 *   GET  /:orgId/projects/:projectId/boqs                            permission: project.boq.read
 *   POST /:orgId/projects/:projectId/boqs                            permission: project.boq.create
 *   POST /:orgId/projects/:projectId/boqs/:boqId/revisions           permission: project.boq.update
 *   POST /:orgId/projects/:projectId/boqs/:boqId/submit              permission: project.boq.update
 *   POST /:orgId/projects/:projectId/boqs/:boqId/approve             permission: project.boq.approve
 *   POST /:orgId/projects/:projectId/boqs/:boqId/lock                permission: project.boq.approve
 *   POST /:orgId/projects/:projectId/boqs/:boqId/imports/preview     permission: project.boq.import
 *   POST /:orgId/projects/:projectId/boqs/:boqId/imports/commit      permission: project.boq.import
 *   GET  /:orgId/projects/:projectId/boqs/:boqId/revisions           permission: project.boq.read
 *   GET  /:orgId/projects/:projectId/boqs/:boqId/export              permission: project.boq.export
 *
 * State machine (boq.service.ts):
 *   DRAFT → IN_REVIEW (submit) → APPROVED (approve) → LOCKED (lock)
 *   Revise from: APPROVED | LOCKED  (creates new DRAFT revision, copies items)
 *   Import (preview + commit) only on DRAFT
 *   expectedVersion required on submit/approve/lock/revise
 *   Actor separation on approve (assertFinancialActorSeparation)
 *   revise.reason: min:10 max:500
 *
 * Validation: packages/shared/src/modules/project/boq.schema.ts
 *   createBoqSchema: title min:1 max:160, currencyCode 3-char
 *   reviseBoqSchema: expectedVersion + reason min:10 max:500
 *   boqImportPreviewSchema: csvText min:1 max:2MB, expectedVersion
 *   CSV max size: BOQ_CSV_MAX_BYTES = 2 * 1024 * 1024
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, ChevronRight, ChevronDown, Upload, Lock, CheckCircle, Send, FilePlus } from 'lucide-react';
import {
  useListBoqsQuery,
  useCreateBoqMutation,
  useTransitionBoqMutation,
  useReviseBoqMutation,
  useListBoqRevisionsQuery,
  usePreviewBoqImportMutation,
} from '../../features/project/preconstructionApi';
import { usePermission } from '../../hooks/usePermission';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import {
  getServerError,
  isInlineError,
  isToastError,
  toastErrorMessage,
} from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { BoqStatus } from '../../types/preconstructionTypes';

const STATUS_BADGE: Record<BoqStatus, string> = {
  DRAFT:     'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  IN_REVIEW: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED:  'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  LOCKED:    'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
};

// Revision history sub-panel
const RevisionHistory: React.FC<{ orgId: string; projectId: string; boqId: string }> = ({ orgId, projectId, boqId }) => {
  const { data } = useListBoqRevisionsQuery({ orgId, projectId, boqId });
  const revisions = data?.items ?? [];
  return (
    <div className="border-t border-[var(--hairline-2)] px-6 py-3 bg-[var(--surface-2)]">
      <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-2">Revision history</p>
      <div className="space-y-1">
        {revisions.map((r) => (
          <div key={r.id} className="flex items-center gap-4 text-sm">
            <span className="font-mono text-[10px] text-[var(--muted)] w-12">Rev.{r.revisionNumber}</span>
            <span className={`font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 ${STATUS_BADGE[r.status as BoqStatus] ?? STATUS_BADGE.DRAFT}`}>{r.status}</span>
            <span className="font-mono text-[10px] text-[var(--muted)]">
              {new Date(r.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {r.approvedBy && <span className="font-mono text-[10px] text-[#166534]">✓ Approved</span>}
            {r.lockedBy && <span className="font-mono text-[10px] text-[#3730a3]">🔒 Locked</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export const BOQPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const canCreate = usePermission('project.boq.create');
  const canApprove = usePermission('project.boq.approve');
  const canImport = usePermission('project.boq.import');
  const { success: toastOk, error: toastErr } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [revisingId, setRevisingId] = useState<{ id: string; version: number } | null>(null);
  const [reviseReason, setReviseReason] = useState('');
  const [importingId, setImportingId] = useState<{ id: string; version: number } | null>(null);
  const [csvText, setCsvText] = useState('');
  const [importPreview, setImportPreview] = useState<{ importId: string; rowCount: number; totalAmount: string } | null>(null);

  // Create form
  const [title, setTitle]     = useState('');
  const [currency, setCurrency] = useState('PKR');
  const [description, setDescription] = useState('');

  const { data, isLoading } = useListBoqsQuery({ orgId: orgId!, projectId: projectId! });
  const [createBoq, { isLoading: creating, error: createErr }] = useCreateBoqMutation();
  const [transitionBoq, { isLoading: transitioning }] = useTransitionBoqMutation();
  const [reviseBoq, { isLoading: revising }] = useReviseBoqMutation();
  const [previewImport, { isLoading: previewing }] = usePreviewBoqImportMutation();

  const onCreate = async () => {
    if (!title.trim()) { toastErr('Title required', ''); return; }
    try {
      await createBoq({
        orgId: orgId!, projectId: projectId!,
        input: { title: title.trim(), currencyCode: currency.toUpperCase(), description: description.trim() || undefined },
      }).unwrap();
      toastOk('BOQ created', '');
      setShowCreate(false); setTitle(''); setCurrency('PKR'); setDescription('');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onTransition = async (boqId: string, action: 'submit' | 'approve' | 'lock', version: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await transitionBoq({ orgId: orgId!, projectId: projectId!, boqId, action, expectedVersion: version }).unwrap();
      toastOk(`BOQ ${action}d`, '');
    } catch (err) { toastErr('Transition failed', toastErrorMessage(err as never)); }
  };

  const onRevise = async () => {
    if (!revisingId || reviseReason.trim().length < 10) { toastErr('Reason too short', 'Min 10 characters.'); return; }
    try {
      await reviseBoq({ orgId: orgId!, projectId: projectId!, boqId: revisingId.id, input: { expectedVersion: revisingId.version, reason: reviseReason } }).unwrap();
      toastOk('New revision created', '');
      setRevisingId(null); setReviseReason('');
    } catch (err) { toastErr('Revise failed', toastErrorMessage(err as never)); }
  };

  const onPreviewImport = async () => {
    if (!importingId || !csvText.trim()) { toastErr('CSV required', ''); return; }
    try {
      const result = await previewImport({ orgId: orgId!, projectId: projectId!, boqId: importingId.id, csvText, expectedVersion: importingId.version }).unwrap();
      setImportPreview({ importId: result.importId, rowCount: result.rowCount, totalAmount: result.totalAmount });
      toastOk('Preview ready', `${result.rowCount} rows, ${result.sectionCount} sections`);
    } catch (err) { toastErr('Preview failed', toastErrorMessage(err as never)); }
  };

  const boqs = data?.items ?? [];

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Bill of Quantities</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{boqs.length} BOQ{boqs.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New BOQ
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-6 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New bill of quantities</p>
          {isInlineError(createErr) && <InlineAlert variant="error" message={getServerError(createErr)?.message ?? 'Error'} />}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={160} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Currency</label>
              <input value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} maxLength={3} className={inputCls()} />
            </div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} maxLength={5000}
              className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:translate-y-0">
              {creating ? 'Creating…' : 'Create BOQ'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Revise reason form */}
      {revisingId && (
        <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 flex items-center gap-3">
          <input type="text" value={reviseReason} onChange={(e) => setReviseReason(e.target.value)}
            placeholder="Reason for new revision (min 10 characters)" maxLength={500}
            className="flex-1 border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-1.5 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          <button onClick={onRevise} disabled={revising}
            className="font-mono text-[9px] uppercase bg-[var(--ink)] text-white border border-[var(--ink)] px-3 py-1.5 disabled:opacity-50">
            {revising ? 'Creating…' : 'Create revision'}
          </button>
          <button type="button" onClick={() => setRevisingId(null)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">✕</button>
        </div>
      )}

      {/* CSV import form */}
      {importingId && (
        <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">CSV import — max 2 MB</p>
          <p className="font-mono text-[9px] text-[var(--muted)]">
            Required columns: item_key, section_key, description, specification, unit, quantity, unit_rate, currency, cost_code
          </p>
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={6} placeholder="Paste CSV here…"
            className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-xs font-mono resize-y focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          {importPreview && (
            <div className="flex items-center gap-6 p-3 border border-[#bbf7d0] bg-[#f0fdf4]">
              <p className="font-mono text-[10px] text-[#166534]">✓ Preview ready — {importPreview.rowCount} rows</p>
              <p className="font-mono text-[10px] text-[#166534]">Total: {importPreview.totalAmount}</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <button onClick={onPreviewImport} disabled={previewing || !csvText.trim()}
              className="inline-flex items-center gap-2 border border-[var(--hairline-2)] px-4 py-2 text-sm font-medium hover:bg-[var(--surface-2)] disabled:opacity-50">
              {previewing ? 'Previewing…' : 'Preview'}
            </button>
            <button type="button" onClick={() => { setImportingId(null); setCsvText(''); setImportPreview(null); }}
              className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* BOQ list */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[28px_2fr_90px_60px_60px_200px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['', 'Title', 'Status', 'Rev.', 'Currency', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : boqs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <FilePlus className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No bills of quantities yet.</p>
          </div>
        ) : (
          boqs.map((boq) => (
            <div key={boq.id}>
              <div className="grid grid-cols-[28px_2fr_90px_60px_60px_200px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
                {/* Expand toggle */}
                <button type="button" onClick={() => setExpandedId(expandedId === boq.id ? null : boq.id)}
                  className="p-0.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
                  {expandedId === boq.id
                    ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} />
                    : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
                </button>

                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{boq.title}</p>
                  <p className="font-mono text-[9px] text-[var(--muted)]">{boq.boqNumber}</p>
                </div>

                <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[boq.status]}`}>
                  {boq.status.replace('_', ' ')}
                </span>
                <p className="font-mono text-[10px] text-[var(--muted)]">Rev.{boq.currentRevisionNumber}</p>
                <p className="font-mono text-[10px] text-[var(--muted)]">{boq.currencyCode}</p>

                {/* Actions */}
                <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                  {boq.status === 'DRAFT' && (
                    <>
                      <button onClick={(e) => onTransition(boq.id, 'submit', boq.version, e)} disabled={transitioning}
                        className="inline-flex items-center gap-1 font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">
                        <Send className="h-2.5 w-2.5" strokeWidth={2} /> Submit
                      </button>
                      {canImport && (
                        <button onClick={() => setImportingId({ id: boq.id, version: boq.version })}
                          className="inline-flex items-center gap-1 font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)]">
                          <Upload className="h-2.5 w-2.5" strokeWidth={2} /> Import CSV
                        </button>
                      )}
                    </>
                  )}
                  {boq.status === 'IN_REVIEW' && canApprove && (
                    <button onClick={(e) => onTransition(boq.id, 'approve', boq.version, e)} disabled={transitioning}
                      className="inline-flex items-center gap-1 font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7] disabled:opacity-50">
                      <CheckCircle className="h-2.5 w-2.5" strokeWidth={2} /> Approve
                    </button>
                  )}
                  {boq.status === 'APPROVED' && canApprove && (
                    <>
                      <button onClick={(e) => onTransition(boq.id, 'lock', boq.version, e)} disabled={transitioning}
                        className="inline-flex items-center gap-1 font-mono text-[8px] uppercase border border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3] px-1.5 py-0.5 hover:bg-[#e0e7ff] disabled:opacity-50">
                        <Lock className="h-2.5 w-2.5" strokeWidth={2} /> Lock
                      </button>
                      <button onClick={() => { setRevisingId({ id: boq.id, version: boq.version }); setReviseReason(''); }}
                        className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)]">
                        Revise
                      </button>
                    </>
                  )}
                  {boq.status === 'LOCKED' && (
                    <button onClick={() => { setRevisingId({ id: boq.id, version: boq.version }); setReviseReason(''); }}
                      className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)]">
                      Revise
                    </button>
                  )}
                </div>
              </div>

              {expandedId === boq.id && (
                <RevisionHistory orgId={orgId!} projectId={projectId!} boqId={boq.id} />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
