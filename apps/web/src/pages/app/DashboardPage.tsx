import React from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Users,
  Settings,
  ArrowUpRight,
  Clock,
  FolderKanban,
  UserPlus,
  FileText,
  Activity,
} from 'lucide-react';
import { PermissionGate } from '../../components/guards/PermissionGate';
import { useOrgContext } from '../../features/org/useOrgContext';
import { useListMembersQuery } from '../../features/org/memberApi';
import { useListInvitationsQuery } from '../../features/org/invitationApi';
import { useListAuditLogsQuery, AUDIT_ACTION_LABELS } from '../../features/org/auditApi';
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

// Role badge colour
function roleBadgeClass(role: string): string {
  if (role === 'Organization Admin') return 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]';
  if (role === 'Project Manager') return 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]';
  if (role === 'Finance') return 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]';
  return 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]';
}

export const DashboardPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { org, membership } = useOrgContext();
  const canReadMembers = usePermission('member:read');
  const canReadAudit = usePermission('audit:read');
  const canProjects = usePermission('project:read');

  const { data: membersData } = useListMembersQuery(orgId!, { skip: !canReadMembers });
  const { data: invitationsData } = useListInvitationsQuery(orgId!, { skip: !canReadMembers });
  const { data: auditData } = useListAuditLogsQuery(
    { orgId: orgId!, limit: 6 },
    { skip: !canReadAudit },
  );

  const activeMembers = membersData?.members.filter((m) => m.status === 'ACTIVE') ?? [];
  const pendingInvites = invitationsData?.invitations.filter((i) => i.status === 'PENDING') ?? [];

  return (
    <div className="p-6 sm:p-8 space-y-8">
      {/* ── Workspace header ────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 pb-6 border-b border-[var(--hairline-2)]">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--muted)]">
            Workspace
          </p>
          <h1 className="mt-1 text-2xl font-medium tracking-[-0.04em]">{org?.name ?? '—'}</h1>
          <p className="mt-0.5 font-mono text-[10px] text-[var(--muted)]">{org?.slug}</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          {org?.status === 'ACTIVE' ? (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[#bbf7d0] bg-[#f0fdf4] text-[#166534] px-2 py-0.5">
              Active
            </span>
          ) : (
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] border border-[#fde68a] bg-[#fffbeb] text-[#92400e] px-2 py-0.5">
              {org?.status}
            </span>
          )}
          <span
            className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-2 py-0.5 ${roleBadgeClass(membership?.roleName ?? '')}`}
          >
            {membership?.roleName}
          </span>
        </div>
      </div>

      {/* ── Stats ────────────────────────────────────────────────────────── */}
      {canReadMembers && (
        <div className="grid grid-cols-2 gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-4">
          <div className="bg-[var(--paper)] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Active members
            </p>
            <p className="mt-2 text-3xl font-medium tracking-[-0.04em] text-[var(--ink)]">
              {activeMembers.length}
            </p>
          </div>
          <div className="bg-[var(--paper)] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Pending invites
            </p>
            <p
              className={`mt-2 text-3xl font-medium tracking-[-0.04em] ${pendingInvites.length > 0 ? 'text-[#92400e]' : 'text-[var(--ink)]'}`}
            >
              {pendingInvites.length}
            </p>
          </div>
          <div className="bg-[var(--paper)] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Your role
            </p>
            <p className="mt-2 text-base font-medium">{membership?.roleName ?? '—'}</p>
          </div>
          <div className="bg-[var(--paper)] p-5">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Account status
            </p>
            <div className="mt-2 flex items-center gap-2">
              <span className="h-2 w-2 bg-[#16a34a]" />
              <p className="text-base font-medium">{membership?.status ?? '—'}</p>
            </div>
          </div>
        </div>
      )}

      {/* ── Quick actions ─────────────────────────────────────────────────── */}
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] mb-4">
          Quick actions
        </p>
        <div className="grid gap-px border border-[var(--hairline-2)] bg-[var(--hairline-2)] sm:grid-cols-2 lg:grid-cols-3">
          <PermissionGate require="project:read">
            <Link
              to={`/org/${orgId}/projects`}
              className="group flex items-start justify-between gap-4 bg-[var(--paper)] p-5 hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
            >
              <div>
                <div className="flex h-9 w-9 items-center justify-center border border-[#bfdbfe] bg-[#eff6ff]">
                  <FolderKanban className="h-4 w-4 text-[#1e40af]" strokeWidth={1.75} />
                </div>
                <p className="mt-3 text-sm font-medium">View projects</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Open your active construction projects.
                </p>
              </div>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.6}
              />
            </Link>
          </PermissionGate>

          <PermissionGate require="member:invite">
            <Link
              to={`/org/${orgId}/members`}
              className="group flex items-start justify-between gap-4 bg-[var(--paper)] p-5 hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
            >
              <div>
                <div className="flex h-9 w-9 items-center justify-center border border-[#bbf7d0] bg-[#f0fdf4]">
                  <UserPlus className="h-4 w-4 text-[#166534]" strokeWidth={1.75} />
                </div>
                <p className="mt-3 text-sm font-medium">Invite a team member</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Add people to your workspace and assign roles.
                </p>
              </div>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.6}
              />
            </Link>
          </PermissionGate>

          <PermissionGate require="settings:update">
            <Link
              to={`/org/${orgId}/settings/profile`}
              className="group flex items-start justify-between gap-4 bg-[var(--paper)] p-5 hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
            >
              <div>
                <div className="flex h-9 w-9 items-center justify-center border border-[#fde68a] bg-[#fffbeb]">
                  <FileText className="h-4 w-4 text-[#92400e]" strokeWidth={1.75} />
                </div>
                <p className="mt-3 text-sm font-medium">Complete your profile</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Add business details, address, and tax information.
                </p>
              </div>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.6}
              />
            </Link>
          </PermissionGate>

          <PermissionGate require="settings:read">
            <Link
              to={`/org/${orgId}/settings/sequences`}
              className="group flex items-start justify-between gap-4 bg-[var(--paper)] p-5 hover:bg-[var(--surface-2)] transition-colors duration-[120ms]"
            >
              <div>
                <div className="flex h-9 w-9 items-center justify-center border border-[var(--hairline-2)] bg-[var(--surface-2)]">
                  <Settings className="h-4 w-4 text-[var(--muted)]" strokeWidth={1.75} />
                </div>
                <p className="mt-3 text-sm font-medium">Document sequences</p>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Configure prefixes for invoices, POs, RFIs.
                </p>
              </div>
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                strokeWidth={1.6}
              />
            </Link>
          </PermissionGate>
        </div>
      </div>

      {/* ── Recent activity ───────────────────────────────────────────────── */}
      <PermissionGate require="audit:read">
        <div>
          <div className="flex items-center justify-between mb-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)]">
              Recent activity
            </p>
            <Link
              to={`/org/${orgId}/settings/audit`}
              className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--muted)] hover:text-[var(--ink)] transition-colors flex items-center gap-1"
            >
              Full log <ArrowUpRight className="h-3 w-3" strokeWidth={2} />
            </Link>
          </div>
          {auditData && auditData.logs.length > 0 ? (
            <div className="border border-[var(--hairline-2)] divide-y divide-[var(--hairline-2)]">
              {auditData.logs.map((log) => {
                const isDenied = log.action.includes('denied');
                return (
                  <div
                    key={log.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 bg-[var(--paper)] hover:bg-[var(--surface-2)] transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Activity
                        className={`h-3.5 w-3.5 shrink-0 ${isDenied ? 'text-[#991b1b]' : 'text-[var(--muted)]'}`}
                        strokeWidth={1.75}
                      />
                      <p
                        className={`text-sm truncate ${isDenied ? 'text-[#991b1b]' : 'text-[var(--ink)]'}`}
                      >
                        {AUDIT_ACTION_LABELS[log.action] ?? log.action}
                      </p>
                    </div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)] shrink-0 whitespace-nowrap">
                      {formatRelativeTime(log.createdAt)}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="border border-[var(--hairline-2)] bg-[var(--paper)] px-4 py-10 text-center">
              <Clock className="h-8 w-8 text-[var(--muted)] mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-[var(--muted)]">No activity recorded yet.</p>
            </div>
          )}
        </div>
      </PermissionGate>
    </div>
  );
};
