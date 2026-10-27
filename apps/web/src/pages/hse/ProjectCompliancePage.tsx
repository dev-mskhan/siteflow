/**
 * ProjectCompliancePage — /org/:orgId/projects/:projectId/compliance
 * Tabs: Permits | Records | Inspections | Expiring
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, AlertTriangle, Shield } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListPermitsQuery, useCreatePermitMutation, useTransitionPermitMutation,
  useListComplianceRecordsQuery, useCreateComplianceRecordMutation, useVerifyComplianceRecordMutation,
  useListComplianceInspectionsQuery, useCreateComplianceInspectionMutation,
  useListExpiringQuery,
} from '../../features/project/hseApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { PermitStatus } from '../../types/hseTypes';

type Tab = 'permits' | 'records' | 'inspections' | 'expiring';
const TabBtn: React.FC<{ label: string; active: boolean; onClick: () => void; warn?: boolean }> = ({ label, active, onClick, warn }) => (
  <button type="button" onClick={onClick}
    className={`px-4 py-2 font-mono text-[10px] uppercase tracking-[0.12em] border-b-2 transition-colors ${active ? 'border-[var(--ink)] text-[var(--ink)]' : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'}`}>
    {label}{warn && <span className="ml-1 h-1.5 w-1.5 rounded-full bg-[#991b1b] inline-block" />}
  </button>
);

const PERMIT_STATUS_BADGE: Record<PermitStatus, string> = {
  PENDING:   'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  APPLIED:   'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  ISSUED:    'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  ACTIVE:    'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  EXPIRED:   'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  REVOKED:   'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  CANCELLED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)] opacity-60',
};

const PERMIT_NEXT: Record<PermitStatus, PermitStatus[]> = {
  PENDING: ['APPLIED'],
  APPLIED: ['ISSUED'],
  ISSUED: ['ACTIVE'],
  ACTIVE: ['REVOKED'],
  EXPIRED: [],
  REVOKED: [],
  CANCELLED: [],
};

export const ProjectCompliancePage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const canManagePermit  = usePermission('project.permit.manage');
  const canManageRecord  = usePermission('project.compliance_record.manage');
  const canManageInsp    = usePermission('project.compliance_inspection.manage');

  const [tab, setTab] = useState<Tab>('permits');
  const [showCreate, setShowCreate] = useState(false);

  // Permit form
  const [pType, setPType] = useState('');
  const [pRef, setPRef]   = useState('');
  const [pAuth, setPAuth] = useState('');
  const [pIssue, setPIssue] = useState('');
  const [pExpiry, setPExpiry] = useState('');

  // Record form
  const [rType, setRType] = useState('');
  const [rExpiry, setRExpiry] = useState('');
  const [rRef, setRRef] = useState('');

  // Inspection form
  const [iType, setIType] = useState('');
  const [iDate, setIDate] = useState('');

  const { data: permitsData, isLoading: permLoading } = useListPermitsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: recordsData }  = useListComplianceRecordsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: inspData }     = useListComplianceInspectionsQuery({ orgId: orgId!, projectId: projectId! });
  const { data: expiringData } = useListExpiringQuery({ orgId: orgId!, projectId: projectId!, days: 30 });

  const [createPermit, { isLoading: crPerm }] = useCreatePermitMutation();
  const [transPermit, { isLoading: trPerm }]  = useTransitionPermitMutation();
  const [createRecord, { isLoading: crRec }]  = useCreateComplianceRecordMutation();
  const [verifyRecord, { isLoading: vrRec }]  = useVerifyComplianceRecordMutation();
  const [createInsp, { isLoading: crInsp }]   = useCreateComplianceInspectionMutation();

  const onCreatePermit = async () => {
    if (!pType.trim()) return;
    try {
      await createPermit({ orgId: orgId!, projectId: projectId!, input: { permitType: pType.trim(), referenceNumber: pRef || undefined, issuingAuthority: pAuth || undefined, issueDate: pIssue || undefined, expiryDate: pExpiry || undefined } }).unwrap();
      toastOk('Permit created', ''); setShowCreate(false); setPType(''); setPRef(''); setPAuth(''); setPIssue(''); setPExpiry('');
    } catch (err) { toastErr('Failed', toastErrorMessage(err as never)); }
  };

  const onCreateRecord = async () => {
    if (!rType.trim()) return;
    try {
      await createRecord({ orgId: orgId!, projectId: projectId!, input: { requirementType: rType.trim(), expiryDate: rExpiry || undefined, verificationRef: rRef || undefined } }).unwrap();
      toastOk('Record created', ''); setShowCreate(false); setRType(''); setRExpiry(''); setRRef('');
    } catch (err) { toastErr('Failed', toastErrorMessage(err as never)); }
  };

  const onCreateInsp = async () => {
    if (!iType.trim()) return;
    try {
      await createInsp({ orgId: orgId!, projectId: projectId!, input: { inspectionType: iType.trim(), scheduledDate: iDate || undefined } }).unwrap();
      toastOk('Inspection created', ''); setShowCreate(false); setIType(''); setIDate('');
    } catch (err) { toastErr('Failed', toastErrorMessage(err as never)); }
  };

  const permits = permitsData?.data ?? [];
  const records = recordsData?.data ?? [];
  const inspections = inspData?.data ?? [];
  const expiring = expiringData?.items ?? [];

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Compliance</h2>
        {tab !== 'expiring' && !showCreate && (
          <button type="button" onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5">
            <Plus className="h-4 w-4" strokeWidth={2} /> New {tab.replace('s','')}
          </button>
        )}
      </div>

      <div className="flex border-b border-[var(--hairline-2)] mb-6">
        <TabBtn label="Permits" active={tab === 'permits'} onClick={() => { setTab('permits'); setShowCreate(false); }} />
        <TabBtn label="Records" active={tab === 'records'} onClick={() => { setTab('records'); setShowCreate(false); }} />
        <TabBtn label="Inspections" active={tab === 'inspections'} onClick={() => { setTab('inspections'); setShowCreate(false); }} />
        <TabBtn label="Expiring" active={tab === 'expiring'} onClick={() => setTab('expiring')} warn={expiring.length > 0} />
      </div>

      {/* Create forms */}
      {showCreate && tab === 'permits' && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New permit</p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="sm:col-span-2"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Permit type *</label><input value={pType} onChange={(e) => setPType(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Reference no.</label><input value={pRef} onChange={(e) => setPRef(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Issuing authority</label><input value={pAuth} onChange={(e) => setPAuth(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Issue date</label><input type="date" value={pIssue} onChange={(e) => setPIssue(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Expiry date</label><input type="date" value={pExpiry} onChange={(e) => setPExpiry(e.target.value)} className={inputCls()} /></div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreatePermit} disabled={crPerm} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{crPerm ? 'Creating…' : 'Create'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {showCreate && tab === 'records' && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New compliance record</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Requirement type *</label><input value={rType} onChange={(e) => setRType(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Expiry date</label><input type="date" value={rExpiry} onChange={(e) => setRExpiry(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Verification reference</label><input value={rRef} onChange={(e) => setRRef(e.target.value)} className={inputCls()} /></div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreateRecord} disabled={crRec} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{crRec ? 'Creating…' : 'Create'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {showCreate && tab === 'inspections' && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">New compliance inspection</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Inspection type *</label><input value={iType} onChange={(e) => setIType(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Scheduled date</label><input type="date" value={iDate} onChange={(e) => setIDate(e.target.value)} className={inputCls()} /></div>
          </div>
          <div className="flex gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button onClick={onCreateInsp} disabled={crInsp} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{crInsp ? 'Creating…' : 'Create'}</button>
            <button type="button" onClick={() => setShowCreate(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* PERMITS TABLE */}
      {tab === 'permits' && (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[2fr_100px_90px_100px_100px_160px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Permit type', 'Reference', 'Status', 'Issue date', 'Expiry', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>)}
          </div>
          {permits.length === 0 ? <div className="flex flex-col items-center justify-center py-12 bg-[var(--paper)]"><Shield className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} /><p className="text-sm text-[var(--muted)]">No permits.</p></div> :
          permits.map((p) => (
            <div key={p.id} className="grid grid-cols-[2fr_100px_90px_100px_100px_160px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <div><p className="text-sm font-medium truncate">{p.permitType}</p>{p.issuingAuthority && <p className="font-mono text-[9px] text-[var(--muted)]">{p.issuingAuthority}</p>}</div>
              <p className="font-mono text-[9px] text-[var(--muted)]">{p.referenceNumber ?? '—'}</p>
              <span className={`inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit ${PERMIT_STATUS_BADGE[p.status]}`}>{p.status}</span>
              <p className="font-mono text-[10px] text-[var(--muted)]">{p.issueDate ?? '—'}</p>
              <p className={cn('font-mono text-[10px]', p.expiryDate && new Date(p.expiryDate).getTime() - Date.now() < 30 * 86400000 ? 'text-[#92400e]' : 'text-[var(--muted)]')}>{p.expiryDate ?? '—'}</p>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {PERMIT_NEXT[p.status].map((next) => (
                  <button key={next} onClick={() => transPermit({ orgId: orgId!, projectId: projectId!, permitId: p.id, status: next }).unwrap().then(() => toastOk('Updated', '')).catch((e) => toastErr('Failed', toastErrorMessage(e)))} disabled={trPerm}
                    className="font-mono text-[8px] uppercase border border-[var(--hairline-2)] px-1.5 py-0.5 hover:bg-[var(--surface-2)] disabled:opacity-50">
                    {next}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* RECORDS TABLE */}
      {tab === 'records' && (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[2fr_100px_100px_100px_120px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Requirement', 'Status', 'Effective', 'Expiry', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>)}
          </div>
          {records.length === 0 ? <div className="py-12 text-center"><p className="text-sm text-[var(--muted)]">No compliance records.</p></div> :
          records.map((r) => (
            <div key={r.id} className="grid grid-cols-[2fr_100px_100px_100px_120px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <p className="text-sm font-medium truncate">{r.requirementType}</p>
              <span className={cn('inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit', r.status === 'VERIFIED' ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]' : r.status === 'EXPIRED' ? 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]' : 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]')}>{r.status}</span>
              <p className="font-mono text-[10px] text-[var(--muted)]">{r.effectiveDate ?? '—'}</p>
              <p className={cn('font-mono text-[10px]', r.expiryDate && new Date(r.expiryDate).getTime() - Date.now() < 30 * 86400000 ? 'text-[#92400e]' : 'text-[var(--muted)]')}>{r.expiryDate ?? '—'}</p>
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                {r.status === 'ACTIVE' && <button onClick={() => verifyRecord({ orgId: orgId!, projectId: projectId!, recordId: r.id }).unwrap().then(() => toastOk('Verified', '')).catch((e) => toastErr('Failed', toastErrorMessage(e)))} disabled={vrRec} className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 disabled:opacity-50">Verify</button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* INSPECTIONS TABLE */}
      {tab === 'inspections' && (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[2fr_100px_100px_100px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Type', 'Status', 'Scheduled', 'Result'].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>)}
          </div>
          {inspections.length === 0 ? <div className="py-12 text-center"><p className="text-sm text-[var(--muted)]">No compliance inspections.</p></div> :
          inspections.map((i) => (
            <div key={i.id} className="grid grid-cols-[2fr_100px_100px_100px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)]">
              <p className="text-sm font-medium truncate">{i.inspectionType}</p>
              <span className="font-mono text-[9px] uppercase text-[var(--muted)]">{i.status}</span>
              <p className="font-mono text-[10px] text-[var(--muted)]">{i.scheduledDate ?? '—'}</p>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{i.result ?? '—'}</p>
            </div>
          ))}
        </div>
      )}

      {/* EXPIRING PANEL */}
      {tab === 'expiring' && (
        expiring.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 border border-[var(--hairline-2)] bg-[var(--paper)]">
            <Shield className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No items expiring in the next 30 days.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {expiring.map((item) => (
              <div key={item.entityId} className={cn('flex items-center justify-between border px-4 py-3', item.daysUntilExpiry <= 7 ? 'border-[#fecaca] bg-[#fef2f2]' : 'border-[#fde68a] bg-[#fffbeb]')}>
                <div>
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{item.entityType.replace('_', ' ')} · expires {item.expiryDate}</p>
                </div>
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-[#92400e]" strokeWidth={2} />
                  <p className={cn('font-mono text-[10px] font-medium', item.daysUntilExpiry <= 7 ? 'text-[#991b1b]' : 'text-[#92400e]')}>
                    {item.daysUntilExpiry} days
                  </p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
};
