/**
 * ProjectRFIsPage — /org/:orgId/projects/:projectId/rfis
 * State: DRAFT → OPEN(submit) → UNDER_REVIEW → ANSWERED(respond) → CLOSED(close). cancel anytime.
 */
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, MessageSquare } from 'lucide-react';
import { cn } from '../lib/cn';
import { useListRFIsQuery, useCreateRFIMutation, useTransitionRFIMutation } from '../api/rfiApi';
import { usePermission } from '../hooks/usePermission';
import { useToast } from '../components/ui/Toast';
import { toastErrorMessage } from '../lib/authErrors';
import { inputCls } from '../components/ui/FormField';
import type { RFIStatus, RFIPriority } from '../types/rfiTypes';

const STATUS_BADGE: Record<RFIStatus, string> = {
  DRAFT:        'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  OPEN:         'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  UNDER_REVIEW: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  ANSWERED:     'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  CLOSED:       'border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3]',
  CANCELLED:    'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)] opacity-60',
};
const PRIORITY_BADGE: Record<RFIPriority, string> = {
  LOW: 'text-[var(--muted)]', NORMAL: 'text-[var(--muted)]',
  HIGH: 'text-[#92400e]', URGENT: 'text-[#991b1b] font-bold',
};

const FILTERS = ['ALL', 'DRAFT', 'OPEN', 'UNDER_REVIEW', 'ANSWERED', 'CLOSED', 'CANCELLED'] as const;

export const ProjectRFIsPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const navigate  = useNavigate();
  const { success: toastOk, error: toastErr } = useToast();
  const canCreate  = usePermission('project.rfi.create');
  const canRespond = usePermission('project.rfi.respond');
  const canManage  = usePermission('project.rfi.manage');

  const [filter, setFilter] = useState<typeof FILTERS[number]>('ALL');
  const [showCreate, setShowCreate] = useState(false);
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const [responseText, setResponseText] = useState('');

  // Create form
  const [title, setTitle]     = useState('');
  const [question, setQuestion] = useState('');
  const [priority, setPriority] = useState<RFIPriority>('NORMAL');
  const [discipline, setDiscipline] = useState('');
  const [dueDate, setDueDate] = useState('');

  const { data, isLoading } = useListRFIsQuery({ orgId: orgId!, projectId: projectId! });
  const [createRFI, { isLoading: creating }] = useCreateRFIMutation();
  const [transition, { isLoading: transitioning }] = useTransitionRFIMutation();

  const onCreate = async () => {
    if (!title.trim() || !question.trim()) { toastErr('Title and question required', ''); return; }
    try {
      const rfi = await createRFI({ orgId: orgId!, projectId: projectId!, input: { title: title.trim(), question: question.trim(), priority, discipline: discipline.trim() || undefined, dueDate: dueDate || undefined } }).unwrap();
      toastOk('RFI created', '');
      setShowCreate(false); setTitle(''); setQuestion(''); setDiscipline(''); setDueDate('');
      navigate(`/org/${orgId}/projects/${projectId}/rfis/${rfi.id}`);
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const doTransition = async (rfiId: string, action: 'submit' | 'close' | 'cancel') => {
    try {
      await transition({ orgId: orgId!, projectId: projectId!, rfiId, action }).unwrap();
      toastOk(`RFI ${action}d`, '');
    } catch (err) { toastErr('Action failed', toastErrorMessage(err as never)); }
  };

  const doRespond = async (rfiId: string) => {
    if (!responseText.trim()) { toastErr('Response required', ''); return; }
    try {
      await transition({ orgId: orgId!, projectId: projectId!, rfiId, action: 'respond', respondInput: { response: responseText.trim() } }).unwrap();
      toastOk('Response recorded', '');
      setRespondingId(null); setResponseText('');
    } catch (err) { toastErr('Respond failed', toastErrorMessage(err as never)); }
  };

  const rfis = data?.data ?? [];
  const rows = filter === 'ALL' ? rfis : rfis.filter((r) => r.status === filter);

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">RFIs</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{rfis.length} total</p>
        </div>
        {canCreate && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
            <Plus className="h-4 w-4" strokeWidth={2} /> New RFI
          </button>
        )}
      </div>

      {showCreate && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New RFI</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-3"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label><input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={500} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Priority</label><select value={priority} onChange={(e) => setPriority(e.target.value as RFIPriority)} className={inputCls()}>{(['LOW','NORMAL','HIGH','URGENT'] as RFIPriority[]).map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Discipline</label><input value={discipline} onChange={(e) => setDiscipline(e.target.value)} maxLength={255} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Due date</label><input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className={inputCls()} /></div>
            <div className="sm:col-span-3"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Question *</label><textarea value={question} onChange={(e) => setQuestion(e.target.value)} rows={3} maxLength={20000} className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" /></div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreate} disabled={creating} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{creating ? 'Creating…' : 'Create RFI'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {respondingId && (
        <div className="mb-4 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 space-y-3">
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">Record response</p>
          <textarea value={responseText} onChange={(e) => setResponseText(e.target.value)} rows={3} maxLength={20000} placeholder="Response (min 1 character)" className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" />
          <div className="flex gap-2">
            <button onClick={() => doRespond(respondingId)} disabled={transitioning || !responseText.trim()} className="font-mono text-[9px] uppercase bg-[var(--ink)] text-white px-4 py-1.5 disabled:opacity-50">Submit response</button>
            <button type="button" onClick={() => { setRespondingId(null); setResponseText(''); }} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      <div className="flex border-b border-[var(--hairline-2)] mb-6 overflow-x-auto">
        {FILTERS.map((f) => (
          <button key={f} type="button" onClick={() => setFilter(f)}
            className={`px-3 py-2.5 font-mono text-[9px] uppercase tracking-[0.12em] border-b-2 whitespace-nowrap transition-colors ${filter === f ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
            {f.replace('_', ' ')}
          </button>
        ))}
      </div>

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[80px_2fr_80px_70px_90px_100px_180px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Number', 'Title', 'Priority', 'Discipline', 'Due', 'Status', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>)}
        </div>
        {isLoading ? [1, 2].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />) :
        rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]"><MessageSquare className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} /><p className="text-sm text-[var(--muted)]">No RFIs.</p></div>
        ) : rows.map((rfi) => {
          const isOverdue = rfi.dueDate && rfi.status === 'OPEN' && new Date(rfi.dueDate) < new Date();
          return (
            <div key={rfi.id} onClick={() => navigate(`/org/${orgId}/projects/${projectId}/rfis/${rfi.id}`)}
              className={cn('grid grid-cols-[80px_2fr_80px_70px_90px_100px_180px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 cursor-pointer transition-colors', isOverdue ? 'bg-[#fffbeb] hover:bg-[#fef3c7]' : 'bg-[var(--paper)] hover:bg-[var(--surface-2)]')}>
              <p className="font-mono text-[10px] text-[var(--muted)]">{rfi.rfiNumber}</p>
              <p className="text-sm font-medium truncate">{rfi.title}</p>
              <p className={cn('font-mono text-[9px] uppercase', PRIORITY_BADGE[rfi.priority])}>{rfi.priority}</p>
              <p className="font-mono text-[9px] text-[var(--muted)] truncate">{rfi.discipline ?? '—'}</p>
              <p className={cn('font-mono text-[10px]', isOverdue ? 'text-[#991b1b] font-medium' : 'text-[var(--muted)]')}>{rfi.dueDate ?? '—'}</p>
              <span className={`inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit ${STATUS_BADGE[rfi.status]}`}>{rfi.status.replace('_', ' ')}</span>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {rfi.status === 'DRAFT' && <button onClick={() => doTransition(rfi.id, 'submit')} disabled={transitioning} className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">Submit</button>}
                {['OPEN', 'UNDER_REVIEW'].includes(rfi.status) && canRespond && <button onClick={() => { setRespondingId(rfi.id); setResponseText(''); }} className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5">Respond</button>}
                {rfi.status === 'ANSWERED' && canManage && <button onClick={() => doTransition(rfi.id, 'close')} disabled={transitioning} className="font-mono text-[8px] uppercase border border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3] px-1.5 py-0.5 disabled:opacity-50">Close</button>}
                {!['CLOSED', 'CANCELLED'].includes(rfi.status) && canManage && <button onClick={() => doTransition(rfi.id, 'cancel')} disabled={transitioning} className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] text-[var(--muted)] px-1.5 py-0.5 disabled:opacity-50">Cancel</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
