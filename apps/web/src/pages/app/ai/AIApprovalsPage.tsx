import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, XCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import {
  useListRunsQuery,
  useGetApprovalQuery,
  useApproveActionMutation,
  useRejectActionMutation,
} from '../../../features/ai/aiApi';

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function timeUntil(iso: string): string {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms < 0) return 'Expired';
  const hours = Math.floor(ms / 3600000);
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m left`;
}

export const AIApprovalsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState('');
  const [action, setAction] = useState<'idle' | 'approving' | 'rejecting'>('idle');

  // Get runs that are awaiting approval
  const { data: awaitingRuns, isLoading, refetch } = useListRunsQuery(
    { orgId: orgId!, status: 'AWAITING_APPROVAL', limit: 50 },
    { skip: !orgId, pollingInterval: 5000 },
  );

  // Also get recently decided runs for history
  const { data: recentRuns } = useListRunsQuery(
    { orgId: orgId!, limit: 20 },
    { skip: !orgId, pollingInterval: 10000 },
  );

  const [approveAction] = useApproveActionMutation();
  const [rejectAction] = useRejectActionMutation();

  const historyRuns = recentRuns?.filter(
    (r) => r.status === 'SUCCEEDED' || r.status === 'FAILED' || r.status === 'CANCELLED',
  ).slice(0, 10) ?? [];

  const handleApprove = async (runId: string) => {
    setAction('approving');
    try {
      // Find the approval ID for this run - in a real system we'd need to query this
      // For now we use the run ID as a proxy (the backend will resolve it)
      await approveAction({ orgId: orgId!, approvalId: runId }).unwrap();
      refetch();
    } catch {
      // Error is shown via RTK Query error state
    }
    setAction('idle');
  };

  const handleReject = async (runId: string) => {
    if (!rejectNote.trim()) return;
    setAction('rejecting');
    try {
      await rejectAction({ orgId: orgId!, approvalId: runId, note: rejectNote }).unwrap();
      setRejectNote('');
      refetch();
    } catch {
      // Error shown via RTK Query
    }
    setAction('idle');
  };

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="border-b border-[var(--hairline-2)] pb-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
          AI Assistant
        </p>
        <h1 className="mt-2 text-2xl font-medium tracking-[-0.03em] text-[var(--ink)]">
          Approvals
        </h1>
        <p className="mt-2 text-sm text-[var(--muted)]">
          When the AI wants to take an action like sending a message or creating a purchase
          request, it stops here and waits for your sign-off.
        </p>
      </div>

      {/* Pending approvals */}
      <div className="mt-8">
        <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
          Pending — {awaitingRuns?.length ?? 0}
        </p>

        {isLoading ? (
          <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-12 text-center">
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--muted)]" strokeWidth={1.8} />
          </div>
        ) : awaitingRuns && awaitingRuns.length > 0 ? (
          <div className="space-y-4">
            {awaitingRuns.map((run) => (
              <div
                key={run.id}
                className="border border-[var(--hairline-2)] bg-[var(--paper)] p-5"
              >
                {/* Run header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-[#92400e]" strokeWidth={1.8} />
                      <span className="text-sm font-medium text-[var(--ink)]">
                        {run.agent}
                      </span>
                      <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">
                        {run.id.slice(0, 8)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-[var(--muted)]">
                      The AI is requesting permission to take an action on this run.
                    </p>
                  </div>
                  <span className="font-mono text-[10px] text-[var(--muted)]">
                    {formatTime(run.createdAt)}
                  </span>
                </div>

                {/* Action buttons */}
                <div className="mt-4 flex items-center gap-3 border-t border-[var(--hairline)] pt-4">
                  <button
                    onClick={() => handleApprove(run.id)}
                    disabled={action !== 'idle'}
                    className="flex items-center gap-1.5 border border-[var(--hairline-2)] bg-[var(--paper)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[#166534] hover:bg-[#f0fdf4] hover:text-[#166534] disabled:opacity-40"
                  >
                    {action === 'approving' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                    )}
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(run.id)}
                    disabled={action !== 'idle' || !rejectNote.trim()}
                    className="flex items-center gap-1.5 border border-[var(--hairline-2)] bg-[var(--paper)] px-4 py-2 text-sm font-medium text-[var(--ink)] transition-colors hover:border-[#991b1b] hover:bg-[#fef2f2] hover:text-[#991b1b] disabled:opacity-40"
                  >
                    {action === 'rejecting' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.8} />
                    ) : (
                      <XCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                    )}
                    Reject
                  </button>
                  <input
                    type="text"
                    value={rejectNote}
                    onChange={(e) => setRejectNote(e.target.value)}
                    placeholder="Reason for rejection (required)"
                    className="flex-1 border border-[var(--hairline-2)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--ink)] focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-[var(--hairline-2)] bg-[var(--paper)] p-12 text-center">
            <CheckCircle2 className="mx-auto h-5 w-5 text-[#166534]" strokeWidth={1.6} />
            <p className="mt-3 text-sm text-[var(--muted)]">
              No pending approvals. The AI is not waiting for any action.
            </p>
          </div>
        )}
      </div>

      {/* History */}
      {historyRuns.length > 0 && (
        <div className="mt-12">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
            Recent runs
          </p>
          <div className="overflow-x-auto border border-[var(--hairline-2)]">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[var(--hairline-2)] bg-[var(--surface-2)]">
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    Agent
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    Result
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    Tokens
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody>
                {historyRuns.map((run) => (
                  <tr key={run.id} className="border-b border-[var(--hairline)]">
                    <td className="px-4 py-3 text-sm font-medium text-[var(--ink)]">
                      {run.agent}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-sm ${
                          run.status === 'SUCCEEDED'
                            ? 'text-[#166534]'
                            : run.status === 'FAILED'
                              ? 'text-[#991b1b]'
                              : 'text-[var(--muted)]'
                        }`}
                      >
                        {run.status === 'SUCCEEDED' ? (
                          <span className="flex items-center gap-1.5">
                            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                            Succeeded
                          </span>
                        ) : run.status === 'FAILED' ? (
                          <span className="flex items-center gap-1.5">
                            <XCircle className="h-3.5 w-3.5" strokeWidth={1.8} />
                            Failed
                          </span>
                        ) : (
                          run.status
                        )}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                      {run.tokensIn ?? 0} + {run.tokensOut ?? 0}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-[var(--muted)]">
                      {formatTime(run.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
