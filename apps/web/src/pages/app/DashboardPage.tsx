/**
 * DashboardPage — /org/:orgId/dashboard
 *
 * Shows:
 *  - Org header (name, slug, status badge)
 *  - Quick-action cards gated by permission
 *  - Recent audit events (audit:read only)
 *  - Member count + pending invitations count
 */
import React from 'react';
import { Link, useParams } from 'react-router-dom';
import { Users, Settings, ArrowUpRight, Clock } from 'lucide-react';
import { PermissionGate } from '../../components/guards/PermissionGate';
import { useOrgContext } from '../../features/org/useOrgContext';
import { useListMembersQuery } from '../../features/org/memberApi';
import { useListInvitationsQuery } from '../../features/org/invitationApi';
import { useListAuditLogsQuery } from '../../features/org/auditApi';
import { AUDIT_ACTION_LABELS } from '../../features/org/auditApi';
import { usePermission } from '../../features/org/usePermission';

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export const DashboardPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { org, membership } = useOrgContext();
  const canReadMembers = usePermission('member:read');
  const canReadAudit   = usePermission('audit:read');
  const canInvite      = usePermission('member:invite');
  const canSettings    = usePermission('settings:read');

  const { data: membersData }     = useListMembersQuery(orgId!, { skip: !canReadMembers });
  const { data: invitationsData } = useListInvitationsQuery(orgId!, { skip: !canReadMembers });
  const { data: auditData }       = useListAuditLogsQuery({ orgId: orgId!, limit: 5 }, { skip: !canReadAudit });

  const activeMembers   = membersData?.members.filter((m) => m.status === 'ACTIVE') ?? [];
  const pendingInvites  = invitationsData?.invitations.filter((i) => i.status === 'PENDING') ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-[1320px] space-y-8">

      {/* Org header */}
      <div className="border-b border-[var(--hairline-2)] pb-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
              Workspace
            </p>
            <h1 className="mt-1 text-2xl font-medium tracking-[-0.04em]">
              {org?.name ?? '—'}
            </h1>
            <p className="mt-0.5 font-mono text-[10px] text-[var(--muted)]">
              {org?.slug}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {org?.status !== 'ACTIVE' && (
              <span className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-1.5 py-0.5">
                {org?.status}
              </span>
            )}
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[var(--muted)]">
              {membership?.roleName}
            </span>
          </div>
        </div>
      </div>

      {/* Stats row */}
      {canReadMembers && (
        <div className="grid grid-cols-2 gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-4">
          {[
            { label: 'Active members',      value: activeMembers.length },
            { label: 'Pending invitations', value: pendingInvites.length },
            { label: 'Your role',           value: membership?.roleName ?? '—' },
            { label: 'Status',              value: membership?.status ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[var(--paper)] p-4">
              <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">{label}</p>
              <p className="mt-2 text-xl font-medium tracking-[-0.03em]">{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-4">
          Quick actions
        </p>
        <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-2 lg:grid-cols-3">

          <PermissionGate require="member:invite">
            <Link
              to={`/org/${orgId}/members`}
              className="group flex items-start justify-between gap-4 bg-[var(--paper)] p-5 hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
            >
              <div>
                <Users className="h-5 w-5 text-[var(--muted)]" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium">Invite a team member</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Add people to your workspace and assign roles.</p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.6} />
            </Link>
          </PermissionGate>

          <PermissionGate require="settings:update">
            <Link
              to={`/org/${orgId}/settings/profile`}
              className="group flex items-start justify-between gap-4 bg-[var(--paper)] p-5 hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
            >
              <div>
                <Settings className="h-5 w-5 text-[var(--muted)]" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium">Complete your profile</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Add your business details, address, and contact info.</p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.6} />
            </Link>
          </PermissionGate>

          <PermissionGate require="settings:read">
            <Link
              to={`/org/${orgId}/settings/sequences`}
              className="group flex items-start justify-between gap-4 bg-[var(--paper)] p-5 hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
            >
              <div>
                <Settings className="h-5 w-5 text-[var(--muted)]" strokeWidth={1.5} />
                <p className="mt-3 text-sm font-medium">Configure document sequences</p>
                <p className="mt-1 text-xs text-[var(--muted)]">Set prefixes for invoices, POs, RFIs, and more.</p>
              </div>
              <ArrowUpRight className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" strokeWidth={1.6} />
            </Link>
          </PermissionGate>

        </div>
      </div>

      {/* Recent activity */}
      <PermissionGate require="audit:read">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-4">
            Recent activity
          </p>
          {auditData && auditData.logs.length > 0 ? (
            <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
              {auditData.logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between gap-4 px-4 py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" strokeWidth={1.75} />
                    <p className="text-sm text-[var(--ink)] truncate">
                      {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                    </p>
                  </div>
                  <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] shrink-0">
                    {formatRelativeTime(log.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No activity recorded yet.</p>
          )}
          <Link
            to={`/org/${orgId}/settings/audit`}
            className="mt-3 inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors"
          >
            View full audit log <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
          </Link>
        </div>
      </PermissionGate>

    </div>
  );
};
