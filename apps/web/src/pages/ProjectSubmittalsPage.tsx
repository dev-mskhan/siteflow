/**
 * ProjectSubmittalsPage — /org/:orgId/projects/:projectId/submittals
 * State: DRAFT → SUBMITTED → UNDER_REVIEW → APPROVED|REJECTED|REVISE_AND_RESUBMIT → CLOSED
 * resubmit creates new revision. Revision history expandable per row.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, FileStack, ChevronDown, ChevronRight } from 'lucide-react';
import { cn } from '../lib/cn';
import { useListSubmittalsQuery, useCreateSubmittalMutation, useTransitionSubmittalMutation, useListSubmittalRevisionsQuery } from '../api/rfiApi';
import { usePermission } from '../hooks/usePermission';
import { useToast } from '../components/ui/Toast';
import { toastErrorMessage } from '../lib/authErrors';
import { inputCls } from '../components/ui/FormField';
import type { SubmittalStatus, SubmittalReviewResponse } from '../types/rfiTypes';

const STATUS_BADGE: Record<SubmittalStatus, string> = {
  DRAFT:                'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  SUBMITTED:            'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  UNDER_REVIEW:         'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  APPROVED:             'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  REJECTED:             'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  REVISE_AND_RESUBMIT:  'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  CLOSED:               'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
};
const REVIEW_BADGE: Record<SubmittalReviewResponse, string> = {
  APPROVED:               '✓ Approved',
  APPROVED_WITH_COMMENTS: '✓ Approved w/ comments',
  REVISE_AND_RESUBMIT:    '↺ Revise & resubmit',
  REJECTED:               '✗ Rejected',
};

const FILTERS = ['ALL', 'DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'REVISE_AND_RESUBMIT'] as const;

const RevisionsPanel: React.FC<{ orgId: string; projectId: string; submittalId: string }> = ({ orgId, projectId, submittalId }) => {
  const { data } = useListSubmittalRevisionsQuery({ orgId, projectId, submittalId });
  const revisions = data?.revisions ?? [];
  if (revisions.length === 0) return <div className="px-6 py-3 text-sm text-[var(--muted)]">No revision history.</div>;
  return (
    <div className="px-4 pb-4 bg-[var(--paper)]">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] py-2">Revision history</p>
      <div className="space-y-1.5">
        {revisions.map((r) => (
          <div key={r.id} className="flex items-center gap-4 text-sm border border-[var(--hairline-2)] px-3 py-2">
            <span className="font-mono text-[10px] text-[var(--muted)] w-10">Rev.{r.revisionNumber}</span>
            <span className="font-mono text-[9px] text-[var(--muted)]">{new Date(r.submittedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            <span className={cn('font-mono text-[9px]', r.reviewResponse === 'APPROVED' ? 'text-[#166534]' : r.reviewResponse === 'REJECTED' ? 'text-[#991b1b]' : 'text-[#92400e]')}>
              {r.reviewResponse ? REVIEW_BADGE[r.reviewResponse] : 'Pending review'}
            </span>
            {r.reviewNotes && <span className="text-sm text-[var(--muted)] truncate">{r.reviewNotes}</span>}
          </div>
        ))}
      </div>
    </div>
  );
};

export const ProjectSubmittalsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const navigate = useNavigate();
  const { success: toastOk, error: toastErr } = useToast();
  const canCreate = usePermission('project.submittal.create');
  const canReview = usePermission('project.submittal.review');
  const canManage = usePermission('project.submittal.manage');

  const [filter, setFilter] = useState<typeof FILTERS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [reviewingId, setReviewingId] = useState<string | null>(null);
  const [reviewResponse, setReviewResponse] = useState<SubmittalReviewResponse>('APPROVED');
  const [reviewNotes, setReviewNotes] = useState('');

  const [title, setTitle]     = useState('');
  const [specRef, setSpecRef] = useState('');
  const [discipline, setDiscipline] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { data, isLoading } = useListSubmittalsQuery({ orgId: orgId!, projectId: projectId! });
  const [createSubmittal, { isLoading: creating }] = useCreateSubmittalMutation();
  const [transition, { isLoading: transitioning }] = useTransitionSubmittalMutation();

  const onCreate = async () => {
    if (!title.trim()) { toastErr('Title required', ''); return; }
    try {
      const sub = await createSubmittal({ orgId: orgId!, projectId: projectId!, input: { title: title.trim(), specReference: specRef.trim() || undefined, discipline: discipline.trim() || undefined, dueDate: dueDate || undefined } }).unwrap();
      toastOk('Submittal created', '');
      setShowCreate(false); setTitle(''); setSpecRef(''); setDiscipline(''); setDueDate('');
      navigate(`/org/${orgId}/projects/${projectId}/submittals/${sub.id}`);
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const doTransition = async (submittalId: string, action: 'submit' | 'resubmit' | 'close') => {
    try {
      await transition({ orgId: orgId!, projectId: projectId!, submittalId, action }).unwrap();
      toastOk(`Submittal ${action}ted`, '');
    } catch (err) { toastErr('Action failed', toastErrorMessage(err as never)); }
  };

  const doReview = async (submittalId: string) => {
    try {
      await transition({ orgId: orgId!, projectId: projectId!, submittalId, action: 'review', reviewInput: { response: reviewResponse, responseNotes: reviewNotes.trim() || undefined } }).unwrap();
      toastOk('Review recorded', '');
      setReviewingId(null); setReviewNotes('');
    } catch (err) { toastErr('Review failed', toastErrorMessage(err as never)); }
  };

  const submittals = data?.data ?? [];
  const rows = filter === 'ALL' ? submittals : submittals.filter((s) => s.status === filter);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Submittals</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{submittals.length} total</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
            <Plus className="h-4 w-4" strokeWidth={2} /> New submittal
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New submittal</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="sm:col-span-4"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Spec reference</label><input value={specRef} onChange={(e) => setSpecRef(e.target.value)} maxLength={255} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Discipline</label><input value={discipline} onChange={(e) => setDiscipline(e.target.value)} maxLength={255} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Due date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls()} /></div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{creating ? 'Creating…' : 'Create'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {reviewingId && (
        <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Record review</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Response *</label>
              <select value={reviewResponse} onChange={(e) => setReviewResponse(e.target.value as SubmittalReviewResponse)} className={inputCls()}>
                {(['APPROVED','APPROVED_WITH_COMMENTS','REVISE_AND_RESUBMIT','REJECTED'] as SubmittalReviewResponse[]).map((r) => <option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Review notes</label><input value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} maxLength={5000} className={inputCls()} /></div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => doReview(reviewingId)} disabled={transitioning} className="font-mono text-[9px] uppercase bg-[var(--ink)] text-white px-4 py-1.5 disabled:opacity-50">Submit review</button>
            <button type="button" onClick={() => { setReviewingId(null); setReviewNotes(''); }} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex border-b border-[var(--hairline-2)] mb-6 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 whitespace-nowrap transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f.replace(/_/g,' ')}
          </button>
        ))}
      </div>

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[28px_2fr_70px_90px_90px_90px_200px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['', 'Title', 'Rev.', 'Status', 'Spec', 'Due', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>)}
        </div>
        {isLoading ? [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />) :
        rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]"><FileStack className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} /><p className="text-sm text-[var(--muted)]">No submittals.</p></div>
        ) : rows.map((sub) => (
          <div key={sub.id}>
            <div onClick={() => navigate(`/org/${orgId}/projects/${projectId}/submittals/${sub.id}`)}
              className="grid grid-cols-[28px_2fr_70px_90px_90px_90px_200px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] cursor-pointer transition-colors">
              <button type="button" onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === sub.id ? null : sub.id); }} className="p-0.5 text-[var(--muted)] hover:text-[var(--ink)]">
                {expandedId === sub.id ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} /> : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
              </button>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{sub.title}</p>
                <p className="font-mono text-[9px] text-[var(--muted)]">{sub.submittalNumber}</p>
              </div>
              <p className="font-mono text-[10px] text-[var(--muted)]">Rev.{sub.revisionNumber}</p>
              <span className={`inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit ${STATUS_BADGE[sub.status]}`}>{sub.status.replace(/_/g,' ')}</span>
              <p className="font-mono text-[9px] text-[var(--muted)] truncate">{sub.specReference ?? '—'}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{sub.dueDate ?? '—'}</p>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {sub.status === 'DRAFT' && canCreate && <button onClick={() => doTransition(sub.id, 'submit')} disabled={transitioning} className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">Submit</button>}
                {sub.status === 'SUBMITTED' && canReview && <button onClick={() => { setReviewingId(sub.id); setReviewResponse('APPROVED'); setReviewNotes(''); }} className="font-mono text-[8px] uppercase border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-1.5 py-0.5">Review</button>}
                {sub.status === 'REVISE_AND_RESUBMIT' && canCreate && <button onClick={() => doTransition(sub.id, 'resubmit')} disabled={transitioning} className="font-mono text-[8px] uppercase border border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af] px-1.5 py-0.5 disabled:opacity-50">Resubmit</button>}
                {!['CLOSED','CANCELLED'].includes(sub.status) && canManage && <button onClick={() => doTransition(sub.id, 'close')} disabled={transitioning} className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[var(--muted)] px-1.5 py-0.5 disabled:opacity-50">Close</button>}
              </div>
            </div>
            {expandedId === sub.id && <RevisionsPanel orgId={orgId!} projectId={projectId!} submittalId={sub.id} />}
          </div>
        ))}
      </div>
    </div>
  );
};
