/**
 * RetainagePage — /org/:orgId/projects/:projectId/commercial/retainage
 *
 * Backend: retainage.routes.ts
 * - GET /retainage → list all held retainage records
 * - POST /payment-applications/:paId/retainage/hold → hold (idempotency-key required)
 * - GET /retainage/:retainageId/releases → list releases
 * - POST /retainage/:retainageId/release → release (idempotency-key + {expectedVersion, amount, reason})
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { cn } from '../../lib/cn';
import {
  useListRetainageQuery,
  useListRetainageReleasesQuery,
  useHoldRetainageMutation,
  useReleaseRetainageMutation,
  useListPaymentApplicationsQuery,
} from '../../features/project/commercialApi';
import { usePermission } from '../../hooks/usePermission';
import { useToast } from '../../components/ui/Toast';
import { toastErrorMessage } from '../../lib/authErrors';
import { inputCls } from '../../components/ui/FormField';
import type { RetainageStatus } from '../../types/commercialTypes';

const STATUS_BADGE: Record<RetainageStatus, string> = {
  HELD:               'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
  PARTIALLY_RELEASED: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
  RELEASED:           'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
};

// Releases sub-panel
const ReleasesPanel: React.FC<{ orgId: string; projectId: string; retainageId: string; version: number; remaining: string; currency: string; canRelease: boolean }> = ({
  orgId, projectId, retainageId, version, remaining, currency, canRelease,
}) => {
  const { data } = useListRetainageReleasesQuery({ orgId, projectId, retainageId });
  const [releaseRetainage, { isLoading }] = useReleaseRetainageMutation();
  const { success: toastOk, error: toastErr } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [amount, setAmount]   = useState('');
  const [reason, setReason]   = useState('');

  const onRelease = async () => {
    if (!amount || !reason.trim()) { toastErr('Amount and reason required', ''); return; }
    try {
      await releaseRetainage({ orgId, projectId, retainageId, expectedVersion: version, amount, reason }).unwrap();
      toastOk('Retainage released', '');
      setShowForm(false); setAmount(''); setReason('');
    } catch (err) { toastErr('Release failed', toastErrorMessage(err as never)); }
  };

  const releases = data?.items ?? [];
  return (
    <div className="px-4 pb-4 bg-[var(--paper)]">
      <div className="flex items-center justify-between py-3 border-b border-[var(--hairline-2)]">
        <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
          Releases ({releases.length}) · Remaining: {currency} {parseFloat(remaining).toLocaleString()}
        </p>
        {canRelease && parseFloat(remaining) > 0 && !showForm && (
          <button type="button" onClick={() => setShowForm(true)}
            className="font-mono text-[9px] uppercase border border-[var(--hairline-2)] px-3 py-1 hover:bg-[var(--surface-2)]">
            Release retainage
          </button>
        )}
      </div>
      {showForm && (
        <div className="mt-3 space-y-3 border border-[var(--hairline-2)] p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">New release (idempotent)</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Amount *</label>
              <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className={inputCls()} />
            </div>
            <div>
              <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1">Reason *</label>
              <input value={reason} onChange={(e) => setReason(e.target.value)} maxLength={500} className={inputCls()} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onRelease} disabled={isLoading}
              className="font-mono text-[9px] uppercase bg-[var(--ink)] text-white px-4 py-1.5 disabled:opacity-50">
              {isLoading ? 'Releasing…' : 'Confirm release'}
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}
      {releases.length > 0 ? (
        <div className="mt-2 space-y-1.5">
          {releases.map((r) => (
            <div key={r.id} className="flex items-center justify-between text-sm border border-[var(--hairline-2)] px-3 py-2">
              <span className="font-mono text-[10px] font-medium">{currency} {parseFloat(r.amount).toLocaleString()}</span>
              <span className="text-sm text-[var(--muted)] truncate max-w-xs">{r.reason}</span>
              <span className="font-mono text-[9px] text-[var(--muted)]">{new Date(r.releasedAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-[var(--muted)]">No releases yet.</p>
      )}
    </div>
  );
};

export const RetainagePage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { success: toastOk, error: toastErr } = useToast();
  const canHold    = usePermission('project.retainage.hold');
  const canRelease = usePermission('project.retainage.release');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [holdingPaId, setHoldingPaId] = useState('');
  const [showHold, setShowHold]       = useState(false);

  const { data, isLoading } = useListRetainageQuery({ orgId: orgId!, projectId: projectId! });
  const { data: paData }    = useListPaymentApplicationsQuery({ orgId: orgId!, projectId: projectId! });
  const [holdRetainage, { isLoading: holding }] = useHoldRetainageMutation();

  const approvedPAs = (paData?.items ?? []).filter((p) => p.status === 'APPROVED' || p.status === 'PARTIALLY_APPROVED');
  const retainages  = data?.items ?? [];

  const totalHeld      = retainages.reduce((a, r) => a + parseFloat(r.accruedAmount), 0);
  const totalReleased  = retainages.reduce((a, r) => a + parseFloat(r.releasedAmount), 0);
  const totalRemaining = retainages.reduce((a, r) => a + parseFloat(r.remainingAmount), 0);

  const onHold = async () => {
    if (!holdingPaId) { toastErr('Select a payment application', ''); return; }
    try {
      await holdRetainage({ orgId: orgId!, projectId: projectId!, paymentApplicationId: holdingPaId }).unwrap();
      toastOk('Retainage held', '');
      setShowHold(false); setHoldingPaId('');
    } catch (err) { toastErr('Hold failed', toastErrorMessage(err as never)); }
  };

  return (
    <div className="p-6 sm:p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Retainage</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{retainages.length} record{retainages.length !== 1 ? 's' : ''}</p>
        </div>
        {canHold && !showHold && approvedPAs.length > 0 && (
          <button type="button" onClick={() => setShowHold(true)}
            className="inline-flex items-center gap-2 min-h-9 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0">
            <Lock className="h-4 w-4" strokeWidth={2} /> Hold retainage
          </button>
        )}
      </div>

      {/* Summary strip */}
      {retainages.length > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total held',     value: totalHeld.toLocaleString() },
            { label: 'Total released', value: totalReleased.toLocaleString() },
            { label: 'Net retainage',  value: totalRemaining.toLocaleString() },
          ].map(({ label, value }) => (
            <div key={label} className="border border-[var(--hairline-2)] bg-[var(--paper)] p-4">
              <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)] mb-1">{label}</p>
              <p className="font-mono text-base font-medium">PKR {value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Hold form */}
      {showHold && (
        <div className="mb-6 border border-[var(--hairline-2)] bg-[var(--paper)] p-4 space-y-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">Hold retainage from approved payment application</p>
          <p className="text-sm text-[var(--muted)]">
            This is idempotent — calling it again with the same payment application will not create a duplicate.
          </p>
          <div>
            <label className="block font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] mb-1.5">Payment application *</label>
            <select value={holdingPaId} onChange={(e) => setHoldingPaId(e.target.value)} className={inputCls()}>
              <option value="">Select…</option>
              {approvedPAs.map((pa) => (
                <option key={pa.id} value={pa.id}>{pa.applicationNumber} — {pa.currencyCode} {parseFloat(pa.retainageAmount).toLocaleString()} retainage</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onHold} disabled={holding}
              className="font-mono text-[9px] uppercase bg-[var(--ink)] text-white px-4 py-1.5 disabled:opacity-50">
              {holding ? 'Holding…' : 'Confirm hold'}
            </button>
            <button type="button" onClick={() => setShowHold(false)} className="text-sm text-[var(--muted)] hover:text-[var(--ink)]">Cancel</button>
          </div>
        </div>
      )}

      {/* Retainage list */}
      {isLoading ? (
        [1, 2].map((i) => <div key={i} className="h-16 animate-pulse bg-[var(--surface-2)] border border-[var(--hairline-2)] mb-2" />)
      ) : retainages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-[var(--hairline-2)] bg-[var(--paper)]">
          <Lock className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">No retainage held yet.</p>
          <p className="font-mono text-[9px] text-[var(--muted)] mt-1">Approve a payment application then use "Hold retainage".</p>
        </div>
      ) : (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[28px_2fr_100px_110px_110px_110px_80px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['', 'PA', 'Status', 'Held', 'Released', 'Remaining', 'Currency'].map((h) => (
              <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
            ))}
          </div>
          {retainages.map((r) => (
            <div key={r.id}>
              <div className="grid grid-cols-[28px_2fr_100px_110px_110px_110px_80px] gap-3 items-center px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
                <button type="button" onClick={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  className="p-0.5 text-[var(--muted)] hover:text-[var(--ink)]">
                  {expandedId === r.id ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} /> : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />}
                </button>
                <p className="font-mono text-[9px] text-[var(--muted)] truncate">{r.paymentApplicationLineId.slice(0, 12)}…</p>
                <span className={`inline-block font-mono text-[9px] uppercase tracking-[0.1em] border px-1.5 py-0.5 w-fit ${STATUS_BADGE[r.status]}`}>
                  {r.status.replace('_', ' ')}
                </span>
                <p className="font-mono text-[10px]">{parseFloat(r.accruedAmount).toLocaleString()}</p>
                <p className="font-mono text-[10px]">{parseFloat(r.releasedAmount).toLocaleString()}</p>
                <p className={cn('font-mono text-[10px] font-medium', parseFloat(r.remainingAmount) > 0 ? 'text-[#92400e]' : 'text-[#166534]')}>
                  {parseFloat(r.remainingAmount).toLocaleString()}
                </p>
                <p className="font-mono text-[10px] text-[var(--muted)]">{r.currencyCode}</p>
              </div>
              {expandedId === r.id && (
                <ReleasesPanel
                  orgId={orgId!} projectId={projectId!} retainageId={r.id}
                  version={r.version} remaining={r.remainingAmount} currency={r.currencyCode}
                  canRelease={canRelease}
                />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
