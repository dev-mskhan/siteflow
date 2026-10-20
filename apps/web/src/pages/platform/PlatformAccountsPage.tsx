/**
 * PlatformAccountsPage — /platform/accounts
 * List user accounts, search by email prefix, suspend/reactivate.
 * Cannot suspend self. Sessions revoked on suspend.
 */
import React, { useState } from 'react';
import { Search, Users } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListAccountsQuery,
  useSuspendAccountMutation,
  useReactivateAccountMutation,
} from '../../api/platformApi';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { LifecycleReasonCode } from '../../types/platformTypes';

const REASON_CODES: LifecycleReasonCode[] = ['SECURITY_INCIDENT', 'FRAUD', 'POLICY_VIOLATION', 'CUSTOMER_REQUEST', 'OTHER'];

interface ActionState { userId: string; userName: string; action: 'suspend' | 'reactivate' }

export const PlatformAccountsPage: React.FC = () => {
  const { success: toastOk, error: toastErr } = useToast();
  const [search, setSearch] = useState('');
  const [actionState, setActionState] = useState<ActionState | null>(null);
  const [password, setPassword] = useState('');
  const [reasonCode, setReasonCode] = useState<LifecycleReasonCode>('SECURITY_INCIDENT');
  const [reasonNote, setReasonNote] = useState('');

  const { data, isLoading } = useListAccountsQuery({ emailPrefix: search.trim() || undefined });
  const [suspend, { isLoading: suspending }]       = useSuspendAccountMutation();
  const [reactivate, { isLoading: reactivating }]  = useReactivateAccountMutation();

  const onAction = async () => {
    if (!actionState || password.length < 1 || reasonNote.trim().length < 10) {
      toastErr('Validation', 'Password and reason note (min 10 chars) required'); return;
    }
    try {
      if (actionState.action === 'suspend') {
        await suspend({ userId: actionState.userId, password, reasonCode, reasonNote: reasonNote.trim() }).unwrap();
        toastOk('Account suspended', 'All sessions have been revoked.');
      } else {
        await reactivate({ userId: actionState.userId, password, reasonCode, reasonNote: reasonNote.trim() }).unwrap();
        toastOk('Account reactivated', '');
      }
      setActionState(null); setPassword(''); setReasonNote('');
    } catch (err) { toastErr('Failed', toastErrorMessage(err as never)); }
  };

  const accounts = data?.accounts ?? [];

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Accounts</h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{accounts.length} total · platform-wide</p>
      </div>

      <div className="relative mb-6 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" strokeWidth={2} />
        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by email prefix…" className={cn(inputCls(), 'pl-9')} />
      </div>

      {actionState && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            {actionState.action === 'suspend' ? 'Suspend account' : 'Reactivate account'} — {actionState.userName}
          </p>
          {actionState.action === 'suspend' && (
            <p className="text-sm text-[#92400e] bg-[#fffbeb] border border-[#fde68a] px-3 py-2">
              All active sessions will be immediately revoked. You cannot suspend your own account.
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
            <button onClick={onAction} disabled={suspending || reactivating || password.length < 1 || reasonNote.trim().length < 10}
              className={cn('min-h-9 px-5 text-sm font-medium text-white disabled:opacity-50',
                actionState.action === 'suspend' ? 'bg-[#991b1b] hover:bg-[#7f1d1d]' : 'bg-[var(--ink)]')}>
              {suspending || reactivating ? 'Processing…' : `Confirm ${actionState.action}`}
            </button>
            <button type="button" onClick={() => { setActionState(null); setPassword(''); setReasonNote(''); }} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      <div className="border border-[var(--hairline-2)]">
        <div className="grid grid-cols-[1fr_2fr_90px_80px_120px_120px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
          {['Email (masked)', 'Name', 'Status', 'Members', 'Last login', ''].map((h) => <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>)}
        </div>
        {isLoading ? [1,2,3].map((i) => <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />) :
        accounts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 bg-[var(--paper)]">
            <Users className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
            <p className="text-sm text-[var(--muted)]">No accounts found.</p>
          </div>
        ) : accounts.map((acct) => (
          <div key={acct.id} className="grid grid-cols-[1fr_2fr_90px_80px_120px_120px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
            <p className="font-mono text-[10px] truncate">{acct.emailMasked}</p>
            <p className="text-sm truncate">{acct.firstName} {acct.lastName}</p>
            <span className={cn('inline-block font-mono text-[9px] uppercase border px-1.5 py-0.5 w-fit',
              acct.status === 'ACTIVE' ? 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]' : 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]')}>
              {acct.status}
            </span>
            <p className="font-mono text-[10px]">{acct.membershipCount}</p>
            <p className="font-mono text-[9px] text-[var(--muted)]">{acct.lastLoginAt ? new Date(acct.lastLoginAt).toLocaleDateString('en', { day: 'numeric', month: 'short' }) : '—'}</p>
            <div className="flex gap-1">
              {acct.status === 'ACTIVE' && (
                <button onClick={() => { setActionState({ userId: acct.id, userName: `${acct.firstName} ${acct.lastName}`, action: 'suspend' }); setPassword(''); setReasonNote(''); }}
                  className="font-mono text-[8px] uppercase border border-[#fecaca] text-[#991b1b] px-1.5 py-0.5 hover:bg-[#fef2f2]">Suspend</button>
              )}
              {acct.status === 'SUSPENDED' && (
                <button onClick={() => { setActionState({ userId: acct.id, userName: `${acct.firstName} ${acct.lastName}`, action: 'reactivate' }); setPassword(''); setReasonNote(''); }}
                  className="font-mono text-[8px] uppercase border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-1.5 py-0.5 hover:bg-[#dcfce7]">Reactivate</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
