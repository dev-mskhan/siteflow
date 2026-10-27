/**
 * TakeoffsPage — /org/:orgId/projects/:projectId/preconstruction/takeoffs
 *
 * Backend:
 *   GET  /:orgId/projects/:projectId/takeoffs/sheets                    permission: project.takeoff.read
 *   POST /:orgId/projects/:projectId/takeoffs/sheets                    permission: project.takeoff.create
 *   PATCH /:orgId/projects/:projectId/takeoffs/sheets/:sheetId          permission: project.takeoff.update
 *   POST /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/submit    permission: project.takeoff.submit
 *   POST /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/approve   permission: project.takeoff.approve
 *   POST /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/reject    permission: project.takeoff.approve
 *   POST /:orgId/projects/:projectId/takeoffs/sheets/:sheetId/revisions permission: project.takeoff.revise
 *   GET  /:orgId/projects/:projectId/takeoffs/summary                   permission: project.takeoff.read
 *
 * State machine (takeoff.service.ts):
 *   DRAFT → PENDING_APPROVAL (submit) → APPROVED (approve) | REJECTED (reject)
 *   REJECTED → DRAFT again → re-submit (same revision)
 *   New revision from: APPROVED | REJECTED — copies measurements + sources
 *   Edit (PATCH sheet, add measurements) only on DRAFT revision
 *   expectedVersion required on all transitions
 *   Actor separation on approve (assertFinancialActorSeparation)
 *   reject reason: min:10 max:500
 *
 * Validation: packages/shared/src/modules/project/takeoff.schema.ts
 *   title: min:1 max:160
 *   measurementMode MANUAL → manualQuantity required; formulaText forbidden
 *   measurementMode FORMULA → formulaText required; manualQuantity forbidden; inputs max:20
 *   deductionQuantity cannot exceed grossQuantity (service-level check)
 *   variableName: /^[A-Za-z_][A-Za-z0-9_]{0,31}$/  (no duplicates in same measurement)
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Ruler, ArrowRight } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListTakeoffSheetsQuery,
  useCreateTakeoffSheetMutation,
  useTransitionTakeoffSheetMutation,
} from '../../features/project/preconstructionApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { isToastError, toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { TakeoffSheetStatus } from '../../types/preconstructionTypes';

const STATUS_BADGE: Record<TakeoffSheetStatus, string> = {
  DRAFT:            'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  PENDING_APPROVAL: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED:         'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  REJECTED:         'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
};

const STEPS: TakeoffSheetStatus[] = ['DRAFT', 'PENDING_APPROVAL', 'APPROVED'];

const FILTER_OPTIONS = ['ALL', 'DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED'] as const;

export const TakeoffsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const canCreate  = usePermission('project.takeoff.create');
  const canApprove = usePermission('project.takeoff.approve');
  const { success: toastOk, error: toastErr } = useToast();

  const [filter, setFilter] = useState<typeof FILTER_OPTIONS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [rejectingId, setRejectingId] = useState<{ id: string; version: number } | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  const [newTitle, setNewTitle]       = useState('');
  const [newDescription, setNewDescription] = useState('');

  const { data, isLoading } = useListTakeoffSheetsQuery({ orgId: orgId!, projectId: projectId! });
  const [createSheet, { isLoading: creating }] = useCreateTakeoffSheetMutation();
  const [transition, { isLoading: transitioning }] = useTransitionTakeoffSheetMutation();

  const onCreate = async () => {
    if (!newTitle.trim()) { toastErr('Title required', ''); return; }
    try {
      await createSheet({
        orgId: orgId!, projectId: projectId!,
        input: { title: newTitle.trim(), description: newDescription.trim() || undefined },
      }).unwrap();
      toastOk('Takeoff sheet created', '');
      setShowCreate(false); setNewTitle(''); setNewDescription('');
    } catch (err) {
      if (isToastError(err as never)) toastErr('Create failed', toastErrorMessage(err as never));
    }
  };

  const onTransition = async (sheetId: string, action: 'submit' | 'approve', version: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await transition({ orgId: orgId!, projectId: projectId!, sheetId, action, expectedVersion: version }).unwrap();
      toastOk(`Sheet ${action}d`, '');
    } catch (err) { toastErr('Action failed', toastErrorMessage(err as never)); }
  };

  const onReject = async () => {
    if (!rejectingId || rejectReason.trim().length < 10) { toastErr('Reason too short', 'Min 10 characters.'); return; }
    try {
      await transition({ orgId: orgId!, projectId: projectId!, sheetId: rejectingId.id, action: 'reject', expectedVersion: rejectingId.version, reason: rejectReason }).unwrap();
      toastOk('Sheet rejected', '');
      setRejectingId(null); setRejectReason('');
    } catch (err) { toastErr('Reject failed', toastErrorMessage(err as never)); }
  };

  const sheets = data?.items ?? [];
  const rows = filter === 'ALL' ? sheets : sheets.filter((s) => s.status === filter);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Quantity takeoffs</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{sheets.length} sheet{sheets.length !== 1 ? 's' : ''}</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Plus className="h-4 w-4" strokeWidth={2} /> New sheet
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New takeoff sheet</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label>
              <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={160} placeholder="e.g. Ground Floor Slab — Area Takeoff" className={inputCls()} />
            </div>
            <div className="col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label>
              <input value={newDescription} onChange={(e) => setNewDescription(e.target.value)} maxLength={2000} className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating}
              className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50">
              {creating ? 'Creating…' : 'Create sheet'}
            </button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Reject inline form */}
      {rejectingId && (
        <div className="mb-4 border border-[#fecaca] bg-[#fef2f2] p-4 flex items-center gap-3">
          <input type="text" value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
            placeholder="Rejection reason (min 10 characters)" maxLength={500}
            className="flex-1 border border-[#fecaca] bg-white px-3 py-2 text-sm focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[#991b1b]" />
          <button onClick={onReject} disabled={transitioning}
            className="font-mono text-[9px] uppercase bg-[#991b1b] text-white px-3 py-2 disabled:opacity-50">
            Confirm
          </button>
          <button type="button" onClick={() => setRejectingId(null)} className="text-sm text-[#991b1b]">✕</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        {FILTER_OPTIONS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      {/* Sheets list */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[2fr_110px_50px_120px_180px] gap-4 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Title', 'Status', 'Rev.', 'Created', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? (
          [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <Ruler className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No takeoff sheets yet.</p>
            <p className="font-mono text-[9px] text-[var(--muted)] mt-1">Create a sheet and add measurements (MANUAL or FORMULA).</p>
          </div>
        ) : (
          rows.map((sheet) => (
            <div key={sheet.id} className="grid grid-cols-[2fr_110px_50px_120px_180px] gap-4 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{sheet.title}</p>
                {sheet.description && <p className="font-mono text-[9px] text-[var(--muted)] truncate">{sheet.description}</p>}
                {sheet.rejectionReason && <p className="font-mono text-[9px] text-[#991b1b] truncate">Rejected: {sheet.rejectionReason}</p>}
              </div>

              <span className={cn('inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit', STATUS_BADGE[sheet.status])}>
                {sheet.status.replace('_', ' ')}
              </span>

              <p className="font-mono text-[10px] text-[var(--muted)]">{sheet.currentRevisionNumber}</p>

              <p className="font-mono text-[10px] text-[var(--muted)]">
                {new Date(sheet.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short' })}
              </p>

              {/* Actions */}
              <div className="flex flex-wrap gap-1.5" onClick={(e) => e.stopPropagation()}>
                {['DRAFT', 'REJECTED'].includes(sheet.status) && (
                  <button onClick={(e) => onTransition(sheet.id, 'submit', sheet.version, e)} disabled={transitioning}
                    className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">
                    Submit
                  </button>
                )}
                {sheet.status === 'PENDING_APPROVAL' && canApprove && (
                  <>
                    <button onClick={(e) => onTransition(sheet.id, 'approve', sheet.version, e)} disabled={transitioning}
                      className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7] disabled:opacity-50">
                      Approve
                    </button>
                    <button onClick={() => { setRejectingId({ id: sheet.id, version: sheet.version }); setRejectReason(''); }}
                      className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[#991b1b] px-1.5 py-0.5 hover:bg-[#fef2f2]">
                      Reject
                    </button>
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
