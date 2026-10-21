/**
 * ProjectAuditPage — /org/:orgId/projects/:projectId/audit
 * Backend: GET /:orgId/projects/:projectId/audit  permission: project.audit:read
 * Cursor-paginated audit event log for the project.
 */
import React from 'react';
import { useParams } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { useListProjectAuditQuery } from '../../../features/project/projectAuditApi';

export const ProjectAuditPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { data, isLoading, isError } = useListProjectAuditQuery(
    { orgId: orgId!, projectId: projectId! },
    { skip: !orgId || !projectId },
  );
  const events = data?.auditLogs ?? [];

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Audit log</h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{events.length} events</p>
      </div>

      {isLoading ? (
        <p className="text-sm text-[var(--muted)]">Loading audit log…</p>
      ) : isError ? (
        <p className="text-sm text-[var(--danger,#b91c1c)]">Could not load the audit log.</p>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 border border-[var(--hairline-2)] bg-[var(--paper)]">
          <ScrollText className="h-10 w-10 text-[var(--muted)] mb-3" strokeWidth={1.5} />
          <p className="text-sm text-[var(--muted)]">No audit events yet.</p>
        </div>
      ) : (
        <div className="border border-[var(--hairline-2)]">
          <div className="grid grid-cols-[130px_100px_100px_2fr_100px] gap-3 px-4 py-2 bg-[var(--surface-2)] border-b border-[var(--hairline-2)]">
            {['Date', 'Entity', 'Action', 'Details', 'Actor'].map((h) => (
              <p key={h} className="font-mono text-[9px] uppercase tracking-[0.14em] text-[var(--muted)]">{h}</p>
            ))}
          </div>
          {events.map((ev) => (
            <div key={ev.id} className="grid grid-cols-[130px_100px_100px_2fr_100px] gap-3 items-center px-4 py-3 border-b border-[var(--hairline-2)] last:border-b-0 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors">
              <p className="font-mono text-[9px] text-[var(--muted)]">
                {new Date(ev.createdAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{ev.resourceType ?? '—'}</p>
              <p className="font-mono text-[9px] uppercase text-[var(--ink)]">{ev.action}</p>
              <p className="text-sm text-[var(--muted)] truncate">
                {Object.entries(ev.metadata ?? {}).map(([k, v]) => `${k}: ${String(v)}`).join(' · ') || '—'}
              </p>
              <p className="font-mono text-[9px] text-[var(--muted)] truncate">{ev.actorUserId ?? '—'}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
