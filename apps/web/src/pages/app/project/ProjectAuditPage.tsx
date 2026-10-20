/**
 * ProjectAuditPage — /org/:orgId/projects/:projectId/audit
 * Backend: GET /:orgId/projects/:projectId/audit  permission: project.audit:read
 * Cursor-paginated audit event log for the project.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { mockBaseQuery } from '../../api/mockBaseQuery';

interface AuditEvent {
  id: string;
  projectId: string;
  entityType: string;
  entityId: string;
  action: string;
  actorId: string;
  actorName: string | null;
  metadata: Record<string, unknown>;
  occurredAt: string;
}

const MOCK_AUDIT: AuditEvent[] = [
  { id: 'pa_01', projectId: 'proj_01', entityType: 'Project', entityId: 'proj_01', action: 'ACTIVATED', actorId: 'usr_01', actorName: 'Tariq Mehmood', metadata: {}, occurredAt: '2024-01-20T10:00:00.000Z' },
  { id: 'pa_02', projectId: 'proj_01', entityType: 'Task', entityId: 'task_01', action: 'CREATED', actorId: 'usr_01', actorName: 'Tariq Mehmood', metadata: { taskCode: 'T-001', name: 'Site mobilisation' }, occurredAt: '2024-02-01T08:00:00.000Z' },
  { id: 'pa_03', projectId: 'proj_01', entityType: 'ChangeOrder', entityId: 'co_01', action: 'EFFECTED', actorId: 'usr_01', actorName: 'Tariq Mehmood', metadata: { changeOrderNumber: 'CO-2024-001', revisedAmount: '291500000.00' }, occurredAt: '2024-03-20T14:00:00.000Z' },
  { id: 'pa_04', projectId: 'proj_01', entityType: 'Payment', entityId: 'pmt_01', action: 'EXECUTED', actorId: 'usr_01', actorName: 'Tariq Mehmood', metadata: { paymentNumber: 'PMT-2024-001', amount: '116289687.50' }, occurredAt: '2024-05-02T11:00:00.000Z' },
  { id: 'pa_05', projectId: 'proj_01', entityType: 'Document', entityId: 'doc_01', action: 'UPLOADED', actorId: 'usr_01', actorName: 'Tariq Mehmood', metadata: { fileName: 'foundation-layout-rev-c.pdf', version: 2 }, occurredAt: '2024-02-10T10:00:00.000Z' },
];

export const ProjectAuditPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const events = MOCK_AUDIT.filter((e) => e.projectId === projectId);

  return (
    <div className="p-6 sm:p-8">
      <div className="mb-6">
        <h2 className="text-lg font-medium tracking-[-0.03em]">Audit log</h2>
        <p className="mt-0.5 text-sm text-[var(--muted)]">{events.length} events</p>
      </div>

      {events.length === 0 ? (
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
                {new Date(ev.occurredAt).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </p>
              <p className="font-mono text-[9px] uppercase text-[var(--muted)]">{ev.entityType}</p>
              <p className="font-mono text-[9px] uppercase text-[var(--ink)]">{ev.action}</p>
              <p className="text-sm text-[var(--muted)] truncate">
                {Object.entries(ev.metadata).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}
              </p>
              <p className="font-mono text-[9px] text-[var(--muted)] truncate">{ev.actorName ?? ev.actorId}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
