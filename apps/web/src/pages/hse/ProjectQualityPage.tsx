/**
 * ProjectQualityPage — /org/:orgId/projects/:projectId/quality
 * Tabs: Inspections | Deficiencies | Corrective Actions
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, ClipboardCheck } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListQualityInspectionsQuery, useCreateQualityInspectionMutation, useTransitionQualityInspectionMutation,
  useListQualityDeficienciesQuery, useCreateQualityDeficiencyMutation, useTransitionQualityDeficiencyMutation,
  useListCorrectiveActionsQuery, useCreateCorrectiveActionMutation, useTransitionCorrectiveActionMutation,
} from '../../features/project/hseApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';

type Tab = 'inspections' | 'deficiencies' | 'actions';
const TabBtn: React.FC<{ label: string; active: boolean; onClick: () => void }> = ({ label, active, onClick }) => (
  <button type="button" onClick={onClick}
    className={`px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors ${active ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
    {label}
  </button>
);

export const ProjectQualityPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const canInspect = usePermission('project.quality.inspect');
  const canDeficiency = usePermission('project.quality.manage_deficiency');

  const [tab, setTab]         = useState<Tab>('inspections');
  const [showCreate, setShowCreate] = useState(false);

  // Inspection form
  const [inspType, setInspType] = useState('Concrete inspection');
  const [inspDate, setInspDate] = useState('');
  const [inspLoc, setInspLoc]   = useState('');
  // Deficiency form
  const [defTitle, setDefTitle] = useState('');
  const [defSeverity, setDefSeverity] = useState('HIGH');
  const [defDesc, setDefDesc]   = useState('');
  const [defDue, setDefDue]     = useState('');
  // CA form
  const [caTitle, setCaTitle]   = useState('');
  const [caSource, setCaSource] = useState('QUALITY_DEFICIENCY');
  const [caSourceId, setCaSourceId] = useState('');
  const [caDesc, setCaDesc]     = useState('');
  const [caDue, setCaDue]       = useState('');

  const { data: inspData, isLoading: inspLoading } = useListQualityInspectionsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: defData }  = useListQualityDeficienciesQuery({ orgId: orgId!, projectId: projectId! });
  const { data: caData }   = useListCorrectiveActionsQuery({ orgId: orgId!, projectId: projectId! });

  const [createInsp, { isLoading: crInsp }]      = useCreateQualityInspectionMutation();
  const [transInsp, { isLoading: trInsp }]        = useTransitionQualityInspectionMutation();
  const [createDef, { isLoading: crDef }]         = useCreateQualityDeficiencyMutation();
  const [transDef, { isLoading: trDef }]          = useTransitionQualityDeficiencyMutation();
  const [createCA, { isLoading: crCA }]           = useCreateCorrectiveActionMutation();
  const [transCA, { isLoading: trCA }]            = useTransitionCorrectiveActionMutation();

  const onCreateInspection = async () => {
    if (!inspType.trim()) return;
    try {
      await createInsp({ orgId: orgId!, projectId: projectId!, input: { inspectionType: inspType.trim(), scheduledDate: inspDate || undefined, location: inspLoc.trim() || undefined } }).unwrap();
      toastOk('Inspection created', ''); setShowCreate(false); setInspType('Concrete inspection'); setInspDate(''); setInspLoc('');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const onCreateDeficiency = async () => {
    if (!defTitle.trim()) return;
    try {
      await createDef({ orgId: orgId!, projectId: projectId!, input: { title: defTitle.trim(), severity: defSeverity, description: defDesc.trim() || undefined, dueDate: defDue || undefined } }).unwrap();
      toastOk('Deficiency recorded', ''); setShowCreate(false); setDefTitle(''); setDefDesc(''); setDefDue('');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const onCreateCA = async () => {
    if (!caTitle.trim() || !caSourceId.trim()) { toastErr('Title and source ID required', ''); return; }
    try {
      await createCA({ orgId: orgId!, projectId: projectId!, input: { sourceType: caSource, sourceId: caSourceId.trim(), title: caTitle.trim(), description: caDesc.trim() || undefined, dueDate: caDue || undefined } }).unwrap();
      toastOk('Corrective action created', ''); setShowCreate(false); setCaTitle(''); setCaDesc(''); setCaDue(''); setCaSourceId('');
    } catch (err) { toastErr('Create failed', toastErrorMessage(err as never)); }
  };

  const inspections = inspData?.data ?? [];
  const deficiencies = defData?.data ?? [];
  const actions = caData?.data ?? [];

  const INSP_STATUS_BADGE: Record<string, string> = {
    SCHEDULED: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
    IN_PROGRESS: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
    COMPLETED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
    CANCELLED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  };
  const DEF_STATUS_BADGE: Record<string, string> = {
    OPEN: 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
    IN_PROGRESS: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
    RESOLVED: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
    CLOSED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
    DISPUTED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
    CANCELLED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  };
  const CA_STATUS_BADGE: Record<string, string> = {
    OPEN: 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
    IN_PROGRESS: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
    COMPLETED: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
    VERIFIED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
    CANCELLED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Quality</h2>
        {((tab === 'inspections' && canInspect) || (tab !== 'inspections' && canDeficiency)) && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
            <Plus className="h-4 w-4" strokeWidth={2} /> New {tab === 'inspections' ? 'inspection' : tab === 'deficiencies' ? 'deficiency' : 'corrective action'}
          </button>
        )}
      </div>

      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        <TabBtn label="Inspections" active={tab === 'inspections'} onClick={() => { setTab('inspections'); setShowCreate(false); }} />
        <TabBtn label="Deficiencies" active={tab === 'deficiencies'} onClick={() => { setTab('deficiencies'); setShowCreate(false); }} />
        <TabBtn label="Corrective actions" active={tab === 'actions'} onClick={() => { setTab('actions'); setShowCreate(false); }} />
      </div>

      {/* CREATE FORMS */}
      {showCreate && tab === 'inspections' && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New inspection</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Inspection type *</label><input value={inspType} onChange={(e) => setInspType(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Scheduled date</label><input type="date" value={inspDate} onChange={(e) => setInspDate(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Location</label><input value={inspLoc} onChange={(e) => setInspLoc(e.target.value)} className={inputCls()} /></div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreateInspection} disabled={crInsp} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{crInsp ? 'Creating…' : 'Create'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {showCreate && tab === 'deficiencies' && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New deficiency</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label><input value={defTitle} onChange={(e) => setDefTitle(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Severity</label><select value={defSeverity} onChange={(e) => setDefSeverity(e.target.value)} className={inputCls()}>{['LOW','MEDIUM','HIGH','CRITICAL'].map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Due date</label><input type="date" value={defDue} onChange={(e) => setDefDue(e.target.value)} className={inputCls()} /></div>
            <div className="col-span-2"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label><textarea value={defDesc} onChange={(e) => setDefDesc(e.target.value)} rows={2} className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" /></div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreateDeficiency} disabled={crDef} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{crDef ? 'Creating…' : 'Create'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {showCreate && tab === 'actions' && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New corrective action</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Title *</label><input value={caTitle} onChange={(e) => setCaTitle(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Source type</label><select value={caSource} onChange={(e) => setCaSource(e.target.value)} className={inputCls()}>{['QUALITY_DEFICIENCY','SAFETY_INCIDENT','SAFETY_OBSERVATION'].map((s) => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Source ID *</label><input value={caSourceId} onChange={(e) => setCaSourceId(e.target.value)} placeholder="qd_01 or sev_01" className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Due date</label><input type="date" value={caDue} onChange={(e) => setCaDue(e.target.value)} className={inputCls()} /></div>
            <div className="col-span-2"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Description</label><textarea value={caDesc} onChange={(e) => setCaDesc(e.target.value)} rows={2} className="w-full border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-2.5 text-sm resize-none focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]" /></div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreateCA} disabled={crCA} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{crCA ? 'Creating…' : 'Create'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* TABLES */}
      {tab === 'inspections' && (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[2fr_120px_90px_100px_160px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Type', 'Scheduled', 'Status', 'Result', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>)}
          </div>
          {inspections.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-[var(--paper)]"><ClipboardCheck className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} /><p className="text-sm text-[var(--muted)]">No inspections.</p></div>
          ) : inspections.map((insp) => (
            <div key={insp.id} className="grid grid-cols-[2fr_120px_90px_100px_160px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <p className="text-sm truncate">{insp.inspectionType}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{insp.scheduledDate ?? '—'}</p>
              <span className={`inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit ${INSP_STATUS_BADGE[insp.status] ?? ''}`}>{insp.status}</span>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{insp.result ?? '—'}</p>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {insp.status === 'SCHEDULED' && <button onClick={() => transInsp({ orgId: orgId!, projectId: projectId!, inspectionId: insp.id, action: 'start' }).unwrap().then(() => toastOk('Started', '')).catch((e) => toastErr('Failed', toastErrorMessage(e)))} disabled={trInsp} className="font-mono text-[8px] uppercase border border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af] px-1.5 py-0.5 disabled:opacity-50">Start</button>}
                {insp.status === 'IN_PROGRESS' && <button onClick={() => transInsp({ orgId: orgId!, projectId: projectId!, inspectionId: insp.id, action: 'complete', result: 'PASS', performedDate: new Date().toISOString().split('T')[0] }).unwrap().then(() => toastOk('Completed', '')).catch((e) => toastErr('Failed', toastErrorMessage(e)))} disabled={trInsp} className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 disabled:opacity-50">Complete</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'deficiencies' && (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[2fr_90px_90px_100px_140px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Title', 'Severity', 'Due', 'Status', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>)}
          </div>
          {deficiencies.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-[var(--paper)]"><p className="text-sm text-[var(--muted)]">No deficiencies.</p></div>
          ) : deficiencies.map((def) => (
            <div key={def.id} className="grid grid-cols-[2fr_90px_90px_100px_140px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <p className="text-sm truncate font-medium">{def.title}</p>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{def.severity ?? '—'}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{def.dueDate ?? '—'}</p>
              <span className={`inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit ${DEF_STATUS_BADGE[def.status] ?? ''}`}>{def.status}</span>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {def.status === 'OPEN' && <button onClick={() => transDef({ orgId: orgId!, projectId: projectId!, deficiencyId: def.id, action: 'resolve' }).unwrap().then(() => toastOk('Resolved', '')).catch((e) => toastErr('Failed', toastErrorMessage(e)))} disabled={trDef} className="font-mono text-[8px] uppercase border border-[#bbf7d0] text-[#166534] px-1.5 py-0.5 disabled:opacity-50">Resolve</button>}
                {def.status === 'RESOLVED' && <button onClick={() => transDef({ orgId: orgId!, projectId: projectId!, deficiencyId: def.id, action: 'close' }).unwrap().then(() => toastOk('Closed', '')).catch((e) => toastErr('Failed', toastErrorMessage(e)))} disabled={trDef} className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 disabled:opacity-50">Close</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'actions' && (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[2fr_100px_90px_100px_140px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Title', 'Source', 'Due', 'Status', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>)}
          </div>
          {actions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-[var(--paper)]"><p className="text-sm text-[var(--muted)]">No corrective actions.</p></div>
          ) : actions.map((ca) => (
            <div key={ca.id} className="grid grid-cols-[2fr_100px_90px_100px_140px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <p className="text-sm truncate font-medium">{ca.title}</p>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{ca.sourceType.replace(/_/g,' ')}</p>
              <p className="font-mono text-[10px] text-[var(--muted)]">{ca.dueDate ?? '—'}</p>
              <span className={`inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit ${CA_STATUS_BADGE[ca.status] ?? ''}`}>{ca.status}</span>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {ca.status === 'OPEN' && <button onClick={() => transCA({ orgId: orgId!, projectId: projectId!, actionId: ca.id, action: 'complete' }).unwrap().then(() => toastOk('Completed', '')).catch((e) => toastErr('Failed', toastErrorMessage(e)))} disabled={trCA} className="font-mono text-[8px] uppercase border border-[#bbf7d0] text-[#166534] px-1.5 py-0.5 disabled:opacity-50">Complete</button>}
                {ca.status === 'COMPLETED' && <button onClick={() => transCA({ orgId: orgId!, projectId: projectId!, actionId: ca.id, action: 'verify' }).unwrap().then(() => toastOk('Verified', '')).catch((e) => toastErr('Failed', toastErrorMessage(e)))} disabled={trCA} className="font-mono text-[8px] uppercase border border-[#c7d2fe] bg-[#eef2ff] text-[#3730a3] px-1.5 py-0.5 disabled:opacity-50">Verify</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
