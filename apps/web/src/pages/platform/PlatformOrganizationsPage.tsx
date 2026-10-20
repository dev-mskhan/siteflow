/**
 * PlatformOrganizationsPage — /platform/organizations
 * List orgs, search by slug prefix, suspend/reactivate.
 * Suspension requires two operators: request → approve.
 */
import React, { useState } from 'react';
import { Search, Building2 } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListOrganizationsQuery,
  useRequestOrgSuspensionMutation,
  useReactivateOrgMutation,
} from '../../api/platformApi';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { LifecycleReasonCode, OrgStatus } from '../../types/platformTypes';

const STATUS_BADGE: Record<OrgStatus, string> = {
  ACTIVE:    'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
  SUSPENDED: 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]',
  ARCHIVED:  'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
};

const REASON_CODES: LifecycleReasonCode[] = ['SECURITY_INCIDENT', 'FRAUD', 'POLICY_VIOLATION', 'CUSTOMER_REQUEST', 'OTHER'];

interface ActionState {
  orgId: string;
  action: 'suspend' | 'reactivate';
}

export const PlatformOrganizationsPage: React.FC = () => {
  const { success: toastOk, error: toastErr } = useToast();
  const [search, setSearch] = useState('');
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [password, setPassword] = useState('');
  const [reasonCode, setReasonCode] = useState<LifecycleReasonCode>('SECURITY_INCIDENT');
  const [reasonNote, setReasonNote] = useState('');

  const { data, isLoading } = useListOrganizationsQuery({ search: search.trim() || undefined });
  const [requestSuspend, { isLoading: suspending }]   = useRequestOrgSuspensionMutation();
  const [reactivateOrg, { isLoading: reactivating }]   = useReactivateOrgMutation();

  const onSuspend = async () => {
    if (!actionState || password.length < 1 || reasonNote.trim().length < 10) {
      toastErr('Validation', 'Password and reason note (min 10 chars) required'); return;
    }
    try {
      const result = await requestSuspend({ orgId: actionState.orgId, password, reasonCode, reasonNote: reasonNote.trim() }).unwrap();
      toastOk('Suspension requested', `Approval ID: ${result.approvalId}. A second operator must approve.`);
      setActionState(null); setPassword(''); setReasonNote('');
    } catch (err) { toastErr('Failed', toastErrorMessage(err as never)); }
  };

  const onReactivate = async () => {
    if (!actionState || password.length < 1 || reasonNote.trim().length < 10) {
      toastErr('Validation', 'Password and reason note (min 10 chars) required'); return;
    }
    try {
      await reactivateOrg({ orgId: actionState.orgId, password, reasonCode, reasonNote: reasonNote.trim() }).unwrap();
      toastOk('Organization reactivated', '');
      setActionState(null); setPassword(''); setReasonNote('');
    } catch (err) { toastErr('Failed', toastErrorMessage(err as never)); }
  };

  const orgs = data?.organizations ?? [];

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Organizations</h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{orgs.length} total · platform-wide</p>
      </div>

      {/* Search */}
      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={2} />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by slug prefix…"
          className={cn(inputCls(), 'pl-9')}
        />
      </div>

      {/* Action panel */}
      {actionState && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            {actionState.action === 'suspend' ? 'Request organization suspension' : 'Reactivate organization'}
          </p>
          {actionState.action === 'suspend' && (
            <p className="text-sm text-[#92400e] bg-[#fffbeb] border border-[#fde68a] px-3 py-2">
              Suspension requires approval from a second operator. You cannot approve your own request.
            </p>
          )}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Password (re-authentication) *</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Reason code *</label>
              <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value as LifecycleReasonCode)} className={inputCls()}>
                {REASON_CODES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Reason note (min 10 chars) *</label>
              <input value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} maxLength={500} className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-[var(--hairline-2)]">
            <button
              onClick={actionState.action === 'suspend' ? onSuspend : onReactivate}
              disabled={suspending || reactivating || password.length < 1 || reasonNote.trim().length < 10}
              className={cn('min-h-9 px-5 text-sm font-medium text-white disabled:opacity-50',
                actionState.action === 'suspend' ? 'bg-[#991b1b] hover:bg-[#7f1d1d]' : 'bg-[var(--ink)]')}>
              {suspending || reactivating ? 'Processing…' : `Confirm ${actionState.action}`}
            </button>
            <button type="button" onClick={() => { setActionState(null); setPassword(''); setReasonNote(''); }} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[2fr_1fr_100px_80px_120px_140px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Name', 'Slug', 'Status', 'Members', 'Owner', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>)}
        </div>
        {isLoading ? [1,2,3].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />) :
        orgs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <Building2 className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No organizations found.</p>
          </div>
        ) : orgs.map((org) => (
          <div key={org.id} className="grid grid-cols-[2fr_1fr_100px_80px_120px_140px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
            <p className="text-sm font-medium truncate">{org.name}</p>
            <p className="font-mono text-[10px] text-[var(--muted)] truncate">{org.slug}</p>
            <span className={cn('inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit', STATUS_BADGE[org.status])}>{org.status}</span>
            <p className="font-mono text-[10px]">{org.memberCount}</p>
            <p className="font-mono text-[9px] text-[var(--muted)] truncate">{org.ownerEmailMasked ?? '—'}</p>
            <div className="flex gap-1">
              {org.status === 'ACTIVE' && (
                <button onClick={() => { setActionState({ orgId: org.id, action: 'suspend' }); setPassword(''); setReasonNote(''); }}
                  className="font-mono text-[8px] uppercase border border-[#fecaca] text-[#991b1b] px-1.5 py-0.5 hover:bg-[#fef2f2]">Suspend</button>
              )}
              {org.status === 'SUSPENDED' && (
                <button onClick={() => { setActionState({ orgId: org.id, action: 'reactivate' }); setPassword(''); setReasonNote(''); }}
                  className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7]">Reactivate</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
