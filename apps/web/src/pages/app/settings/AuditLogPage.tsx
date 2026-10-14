/**
 * AuditLogPage — /org/:orgId/settings/audit
 * GET /organizations/:orgId/audit-logs?limit=50&offset=0
 * Permission: audit:read
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useListAuditLogsQuery, AUDIT_ACTION_LABELS, type AuditLogDTO } from '../../../features/org/auditApi';

const LIMIT = 50;

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso));
}

const ActionBadge: React.FC<{ action: string }> = ({ action }) => {
  const isError = action.includes('denied') || action.includes('failed');
  return (
    <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 ${
      isError
        ? 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]'
        : 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]'
    }`}>
      {AUDIT_ACTION_LABELS[action] ?? action}
    </span>
  );
};

export const AuditLogPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const [offset, setOffset] = useState(0);

  const { data, isLoading, isFetching } = useListAuditLogsQuery({
    orgId: orgId!,
    limit: LIMIT,
    offset,
  });

  const logs = data?.logs ?? [];
  const hasNext = logs.length === LIMIT;
  const hasPrev = offset > 0;

  return (
    <div className="max-w-3xl">
      <p className="text-sm text-[var(--muted)] mb-6">
        A tamper-evident record of all significant actions in this workspace.
      </p>

      <div className="border border-[var(--hairline-2)]">
        {/* Table header */}
        <div className="grid grid-cols-[1fr_1.2fr_1.2fr_0.8fr] gap-0 border-b border-[var(--hairline-2)] bg-[var(--surface-2)] px-4 py-2">
          {['Time', 'Action', 'Resource', 'IP'].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading || isFetching ? (
          <div className="space-y-0">
            {[1,2,3,4,5].map((i) => (
              <div key={i} className="h-12 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />
            ))}
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">No audit records found.</div>
        ) : (
          logs.map((log: AuditLogDTO) => (
            <div key={log.id} className="grid grid-cols-[1fr_1.2fr_1.2fr_0.8fr] gap-0 items-center border-b border-[var(--hairline-2)] last:border-b-0 px-4 py-3">
              <p className="font-mono text-[10px] text-[var(--muted)]">{formatDateTime(log.createdAt)}</p>
              <ActionBadge action={log.action} />
              <p className="font-mono text-[10px] text-[var(--muted)] truncate">
                {log.resourceType ?? '—'}{log.resourceId ? ` #${log.resourceId.slice(-6)}` : ''}
              </p>
              <p className="font-mono text-[10px] text-[var(--muted)] truncate">{log.ipAddress ?? '—'}</p>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between pt-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--muted)]">
          Showing {offset + 1}–{offset + logs.length}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={!hasPrev || isFetching}
            onClick={() => setOffset((o) => Math.max(0, o - LIMIT))}
            className="p-1.5 border border-[var(--hairline-2)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <button
            type="button"
            disabled={!hasNext || isFetching}
            onClick={() => setOffset((o) => o + LIMIT)}
            className="p-1.5 border border-[var(--hairline-2)] text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>
      </div>
    </div>
  );
};
