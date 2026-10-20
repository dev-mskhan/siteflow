/**
 * PlatformSupportGrantsPage — /platform/support-grants
 * Request, approve, revoke, and use time-limited support grants.
 * Self-approval is blocked. Max duration 1440 minutes (24h).
 * Scopes: read:org_summary, read:org_subscription, read:org_entitlements
 */
import React, { useState } from 'react';
import { KeyRound, Shield, Clock, Check, X } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useRequestSupportGrantMutation,
  useApproveSupportGrantMutation,
  useRevokeSupportGrantMutation,
  useUseSupportGrantQuery,
} from '../../api/platformApi';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { LifecycleReasonCode, SupportGrantScope } from '../../types/platformTypes';

const REASON_CODES: LifecycleReasonCode[] = ['SECURITY_INCIDENT', 'FRAUD', 'POLICY_VIOLATION', 'CUSTOMER_REQUEST', 'OTHER'];
const SCOPES: SupportGrantScope[] = ['read:org_summary', 'read:org_subscription', 'read:org_entitlements'];

export const PlatformSupportGrantsPage: React.FC = () => {
  const { success: toastOk, error: toastErr } = useToast();

  // Request form
  const [operatorUserId, setOperatorUserId] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [selectedScopes, setSelectedScopes] = useState<SupportGrantScope[]>(['read:org_summary']);
  const [password, setPassword] = useState('');
  const [reasonCode, setReasonCode] = useState<LifecycleReasonCode>('CUSTOMER_REQUEST');
  const [reasonNote, setReasonNote] = useState('');

  // Approve form
  const [approveGrantId, setApproveGrantId] = useState('');
  const [approvePassword, setApprovePassword] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(60);

  // Revoke form
  const [revokeGrantId, setRevokeGrantId] = useState('');
  const [revokePassword, setRevokePassword] = useState('');

  // Use grant viewer
  const [useGrantId, setUseGrantId] = useState('');
  const [useScope, setUseScope] = useState<SupportGrantScope>('read:org_summary');

  const [requestGrant, { isLoading: requesting }] = useRequestSupportGrantMutation();
  const [approveGrant, { isLoading: approving }] = useApproveSupportGrantMutation();
  const [revokeGrant, { isLoading: revoking }] = useRevokeSupportGrantMutation();
  const { data: grantData, isLoading: grantLoading } = useUseSupportGrantQuery(
    { grantId: useGrantId, scope: useScope },
    { skip: !useGrantId },
  );

  const toggleScope = (scope: SupportGrantScope) => {
    setSelectedScopes((prev) => prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope]);
  };

  const onRequest = async () => {
    if (!operatorUserId.trim() || !organizationId.trim() || password.length < 1 || reasonNote.trim().length < 10 || selectedScopes.length === 0) {
      toastErr('Validation', 'All fields required. Reason note min 10 chars.'); return;
    }
    try {
      const result = await requestGrant({ operatorUserId: operatorUserId.trim(), organizationId: organizationId.trim(), scopes: selectedScopes, password, reasonCode, reasonNote: reasonNote.trim() }).unwrap();
      toastOk('Grant requested', `Grant ID: ${result.grantId}. A second operator must approve.`);
    } catch (err) { toastErr('Request failed', toastErrorMessage(err as never)); }
  };

  const onApprove = async () => {
    if (!approveGrantId.trim() || approvePassword.length < 1) { toastErr('Validation', 'Grant ID and password required'); return; }
    try {
      const result = await approveGrant({ grantId: approveGrantId.trim(), password: approvePassword, durationMinutes }).unwrap();
      toastOk('Grant approved', `Expires at ${new Date(result.expiresAt).toLocaleString()}`);
      setApproveGrantId(''); setApprovePassword(''); setDurationMinutes(60);
    } catch (err) { toastErr('Approve failed', toastErrorMessage(err as never)); }
  };

  const onRevoke = async () => {
    if (!revokeGrantId.trim() || revokePassword.length < 1) { toastErr('Validation', 'Grant ID and password required'); return; }
    try {
      await revokeGrant({ grantId: revokeGrantId.trim(), password: revokePassword }).unwrap();
      toastOk('Grant revoked', '');
      setRevokeGrantId(''); setRevokePassword('');
    } catch (err) { toastErr('Revoke failed', toastErrorMessage(err as never)); }
  };

  return (
    <div className="p-6 sm:p-8 max-w-3xl space-y-8">
      <div>
        <h2 className="text-lg font-medium tracking-[-0.03em]">Support grants</h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">Time-limited, scope-restricted access to organization data for support</p>
      </div>

      {/* Request grant */}
      <section className="space-y-4">
        <div className="border-b border-[var(--hairline-2)] pb-2 flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Request grant</p>
        </div>
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Operator user ID *</label><input value={operatorUserId} onChange={(e) => setOperatorUserId(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Organization ID *</label><input value={organizationId} onChange={(e) => setOrganizationId(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Password (re-auth) *</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Reason code *</label><select value={reasonCode} onChange={(e) => setReasonCode(e.target.value as LifecycleReasonCode)} className={inputCls()}>{REASON_CODES.map((r) => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}</select></div>
            <div className="col-span-2"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Reason note (min 10) *</label><input value={reasonNote} onChange={(e) => setReasonNote(e.target.value)} maxLength={500} className={inputCls()} /></div>
          </div>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-2">Scopes *</label>
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((scope) => (
                <button key={scope} type="button" onClick={() => toggleScope(scope)}
                  className={cn('font-mono text-[9px] uppercase tracking-[0.1em] border px-2 py-1 transition-colors',
                    selectedScopes.includes(scope) ? 'border-[var(--ink)] bg-[var(--ink)] text-white' : 'border-[var(--hairline-2)] text-[var(--muted)] hover:bg-[var(--surface-2)]')}>
                  {scope.replace(/[:_]/g, ' ')}
                </button>
              ))}
            </div>
          </div>
          <button onClick={onRequest} disabled={requesting}
            className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{requesting ? 'Requesting…' : 'Request grant'}</button>
        </div>
      </section>

      {/* Approve grant */}
      <section className="space-y-4">
        <div className="border-b border-[var(--hairline-2)] pb-2 flex items-center gap-2">
          <Check className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Approve grant</p>
        </div>
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <p className="text-sm text-[#92400e] bg-[#fffbeb] border border-[#fde68a] px-3 py-2">Self-approval is blocked. The approver must be a different operator from the requester.</p>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Grant ID *</label><input value={approveGrantId} onChange={(e) => setApproveGrantId(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Duration (minutes, max 1440) *</label><input type="number" value={durationMinutes} onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 60)} min={1} max={1440} className={inputCls()} /></div>
            <div className="col-span-2"><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Password (re-auth) *</label><input type="password" value={approvePassword} onChange={(e) => setApprovePassword(e.target.value)} className={inputCls()} /></div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onApprove} disabled={approving} className="min-h-9 bg-[var(--ink)] px-5 text-sm font-medium text-white disabled:opacity-50">{approving ? 'Approving…' : 'Approve grant'}</button>
            <span className="inline-flex items-center gap-1 font-mono text-[9px] text-[var(--muted)]"><Clock className="h-3 w-3" strokeWidth={2} /> Max 24h (1440 min)</span>
          </div>
        </div>
      </section>

      {/* Revoke grant */}
      <section className="space-y-4">
        <div className="border-b border-[var(--hairline-2)] pb-2 flex items-center gap-2">
          <X className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Revoke grant</p>
        </div>
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Grant ID *</label><input value={revokeGrantId} onChange={(e) => setRevokeGrantId(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Password (re-auth) *</label><input type="password" value={revokePassword} onChange={(e) => setRevokePassword(e.target.value)} className={inputCls()} /></div>
          </div>
          <button onClick={onRevoke} disabled={revoking} className="min-h-9 border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] px-5 text-sm font-medium hover:bg-[#fee2e2] disabled:opacity-50">{revoking ? 'Revoking…' : 'Revoke grant'}</button>
        </div>
      </section>

      {/* Use grant viewer */}
      <section className="space-y-4">
        <div className="border-b border-[var(--hairline-2)] pb-2 flex items-center gap-2">
          <Shield className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Use grant (read org data)</p>
        </div>
        <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Grant ID *</label><input value={useGrantId} onChange={(e) => setUseGrantId(e.target.value)} className={inputCls()} /></div>
            <div><label className="block font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1.5">Scope *</label><select value={useScope} onChange={(e) => setUseScope(e.target.value as SupportGrantScope)} className={inputCls()}>{SCOPES.map((s) => <option key={s} value={s}>{s.replace(/[:_]/g, ' ')}</option>)}</select></div>
          </div>
          {grantLoading && <div className="h-20 animate-pulse bg-[var(--surface-2)]" />}
          {grantData && (
            <div className="border border-[var(--hairline-2)] p-4 bg-[var(--surface-2)]">
              <pre className="font-mono text-[10px] whitespace-pre-wrap break-words">{JSON.stringify(grantData, null, 2)}</pre>
            </div>
          )}
        </div>
      </section>
    </div>
  );
};
