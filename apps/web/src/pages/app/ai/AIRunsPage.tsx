import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { Activity, Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useListRunsQuery, useCancelRunMutation } from '../../../features/ai/aiApi';
import type { AIRun } from '../../../features/ai/aiApi';

const STATUS_CONFIG: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  QUEUED: { icon: Clock, color: 'text-[var(--muted)]', label: 'Queued' },
  RUNNING: { icon: Loader2, color: 'text-[#1e40af]', label: 'Running' },
  SUCCEEDED: { icon: CheckCircle2, color: 'text-[#166534]', label: 'Succeeded' },
  FAILED: { icon: XCircle, color: 'text-[#991b1b]', label: 'Failed' },
  CANCELLED: { icon: XCircle, color: 'text-[var(--muted)]', label: 'Cancelled' },
  AWAITING_APPROVAL: { icon: AlertCircle, color: 'text-[#92400e]', label: 'Awaiting approval' },
};

function formatTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const AIRunsPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data: runs, isLoading, refetch } = useListRunsQuery(
    { orgId: orgId!, status: statusFilter || undefined, limit: 50 },
    { skip: !orgId, pollingInterval: 5000 },
  );
  const [cancelRun] = useCancelRunMutation();

  const handleCancel = async (runId: string) => {
    await cancelRun({ orgId: orgId!, runId });
    refetch();
  };

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[var(--hairline-2)] pb-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            AI Assistant
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.03em] text-[var(--ink)]">
            Agent Runs
          </h1>
          <p className="mt-2 text-sm text-[var(--muted)]">
            Every AI agent run with live status, token usage, and cost tracking.
          </p>
        </div>
        <button
          onClick={refetch}
          className="border border-[var(--hairline-2)] bg-[var(--paper)] px-3 py-1.5 text-sm text-[var(--muted)] transition-colors hover:border-[var(--ink)] hover:text-[var(--ink)]"
        >
          Refresh
        </button>
      </div>

      {/* Status filter */}
      <div className="mt-6 flex gap-2">
        {['', 'RUNNING', 'SUCCEEDED', 'FAILED', 'AWAITING_APPROVAL'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors ${
              statusFilter === s
                ? 'border-[var(--ink)] bg-[var(--ink)] text-white'
                : 'border-[var(--hairline-2)] bg-[var(--paper)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)]'
            }`}
          >
            {s || 'All'}
          </button>
        ))}
      </div>

      {/* Runs table */}
      <div className="mt-6 overflow-x-auto border border-[var(--hairline-2)]">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[var(--hairline-2)] bg-[var(--surface-2)]">
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Agent
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Status
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Tokens
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Cost
              </th>
              <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Created
              </th>
              <th className="px-4 py-3 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)]">
                Action
              </th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-[var(--muted)]" strokeWidth={1.8} />
                </td>
              </tr>
            ) : runs && runs.length > 0 ? (
              runs.map((run: AIRun) => {
                const cfg = STATUS_CONFIG[run.status] ?? STATUS_CONFIG.QUEUED;
                const Icon = cfg.icon;
                const canCancel = run.status === 'QUEUED' || run.status === 'RUNNING' || run.status === 'AWAITING_APPROVAL';
                return (
                  <tr key={run.id} className="border-b border-[var(--hairline)]">
                    <td className="px-4 py-3">
                      <span className="text-sm font-medium text-[var(--ink)]">{run.agent}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`flex items-center gap-1.5 text-sm ${cfg.color}`}>
                        <Icon className={`h-3.5 w-3.5 ${run.status === 'RUNNING' ? 'animate-spin' : ''}`} strokeWidth={1.8} />
                        {cfg.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {run.tokensIn ?? 0} → {run.tokensOut ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[var(--muted)]">
                        ${run.costUsd ?? '0.000000'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-[var(--muted)]">
                        {formatTime(run.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canCancel && (
                        <button
                          onClick={() => handleCancel(run.id)}
                          className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] transition-colors hover:text-[#991b1b]"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center">
                  <Activity className="mx-auto h-5 w-5 text-[var(--muted)]" strokeWidth={1.6} />
                  <p className="mt-3 text-sm text-[var(--muted)]">No agent runs yet</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
