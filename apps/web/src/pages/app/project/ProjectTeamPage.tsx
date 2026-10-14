/**
 * ProjectTeamPage — /org/:orgId/projects/:projectId/team
 * Lists project-level members (ProjectRole, not OrgRole).
 * Add member, change role, remove. Last-PM guard: 422 → inline toast.
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { UserPlus, ChevronDown, Trash2, Check, X } from 'lucide-react';
import {
  useListProjectMembersQuery,
  useUpdateMemberRoleMutation,
  useRemoveProjectMemberMutation,
} from '../../../features/project/projectMemberApi';
import { ProjectRoleBadge } from '../../../components/project/ProjectRoleBadge';
import { useToast } from '../../../components/ui/Toast';
import { toastErrorMessage, getServerError, isInlineError } from '../../../lib/authErrors';
import type { ProjectRole, ProjectMemberDTO } from '../../../features/project/projectTypes';
import { useOrgContext } from '../../../features/org/useOrgContext';

const ALL_ROLES: ProjectRole[] = [
  'PROJECT_MANAGER', 'SITE_SUPERVISOR', 'PROJECT_MEMBER',
  'FINANCE', 'PROCUREMENT', 'SUBCONTRACTOR', 'CLIENT',
];

const ROLE_LABELS: Record<ProjectRole, string> = {
  PROJECT_MANAGER: 'Project Manager', SITE_SUPERVISOR: 'Site Supervisor',
  PROJECT_MEMBER: 'Member', FINANCE: 'Finance',
  PROCUREMENT: 'Procurement', SUBCONTRACTOR: 'Subcontractor', CLIENT: 'Client',
};

const MemberRow: React.FC<{ member: ProjectMemberDTO; isCurrentUser: boolean; orgId: string; projectId: string }> = ({
  member, isCurrentUser, orgId, projectId,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const { success: toastOk, error: toastErr } = useToast();
  const [updateRole, { isLoading: updating, error: updateError }] = useUpdateMemberRoleMutation();
  const [removeMember, { isLoading: removing }] = useRemoveProjectMemberMutation();

  const inlineErr = isInlineError(updateError) ? getServerError(updateError) : null;

  const handleRoleChange = async (role: ProjectRole) => {
    try {
      await updateRole({ orgId, projectId, userId: member.userId, body: { role } }).unwrap();
      toastOk('Role updated', '');
      setMenuOpen(false);
    } catch (err) {
      const e = getServerError(err as never);
      toastErr('Role change failed', e?.message ?? toastErrorMessage(err as never));
    }
  };

  const handleRemove = async () => {
    if (!confirm(`Remove ${member.user.firstName} from this project?`)) return;
    try {
      await removeMember({ orgId, projectId, userId: member.userId }).unwrap();
      toastOk('Member removed', '');
    } catch (err) {
      const e = getServerError(err as never);
      toastErr('Remove failed', e?.message ?? toastErrorMessage(err as never));
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--ink)] text-white font-mono text-[10px] font-bold">
        {[member.user.firstName[0], member.user.lastName?.[0]].filter(Boolean).join('').toUpperCase()}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[var(--ink)]">{member.user.firstName} {member.user.lastName}</p>
          {isCurrentUser && <span className="font-mono text-[9px] text-[var(--muted)]">(you)</span>}
        </div>
        <p className="font-mono text-[10px] text-[var(--muted)] truncate">{member.user.email}</p>
      </div>
      <ProjectRoleBadge role={member.role} />

      {!isCurrentUser && (
        <div className="relative shrink-0">
          <button type="button" onClick={() => setMenuOpen((v) => !v)} className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
            <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-[calc(100%+2px)] z-20 w-52 border border-[var(--ink)] bg-[var(--paper)]">
              {inlineErr && <div className="px-3 py-2 border-b border-[var(--hairline-2)]"><p className="font-mono text-[9px] text-[#991b1b]">{inlineErr.message}</p></div>}
              <div className="py-1">
                {ALL_ROLES.filter((r) => r !== member.role).map((role) => (
                  <button key={role} type="button" disabled={updating} onClick={() => handleRoleChange(role)}
                    className="w-full px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors disabled:opacity-50">
                    Set as {ROLE_LABELS[role]}
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--hairline-2)] py-1">
                <button type="button" disabled={removing} onClick={handleRemove}
                  className="w-full px-3 py-2 text-left text-sm text-[#991b1b] hover:bg-[#fef2f2] transition-colors flex items-center gap-2 disabled:opacity-50">
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} /> Remove from project
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const ProjectTeamPage: React.FC = () => {
  const { orgId, projectId } = useParams<{ orgId: string; projectId: string }>();
  const { membership } = useOrgContext();
  const { data, isLoading } = useListProjectMembersQuery({ orgId: orgId!, projectId: projectId! });
  const members = data?.members ?? [];

  return (
    <div className="p-6 sm:p-8 max-w-[1320px]">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-medium tracking-[-0.03em]">Project team</h2>
          <p className="mt-0.5 text-sm text-[var(--muted)]">{members.length} member{members.length !== 1 ? 's' : ''}</p>
        </div>
        {/* Add member button — wires to org member list in next iteration */}
        <button type="button" className="inline-flex items-center gap-2 min-h-9 border border-[var(--hairline-2)] bg-[var(--paper)] px-4 text-sm font-medium text-[var(--muted)] hover:border-[var(--ink)] hover:text-[var(--ink)] transition-colors">
          <UserPlus className="h-4 w-4" strokeWidth={1.8} /> Add member
        </button>
      </div>

      <div className="border border-[var(--hairline-2)]">
        {/* Header */}
        <div className="grid grid-cols-[1fr_auto_auto] border-b border-[var(--hairline-2)] bg-[var(--surface-2)] px-4 py-2">
          {['Member', 'Role', ''].map((h) => (
            <p key={h} className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--muted)]">{h}</p>
          ))}
        </div>

        {isLoading ? (
          [1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]" />)
        ) : members.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">No team members assigned to this project yet.</div>
        ) : (
          members.map((m) => (
            <MemberRow
              key={m.id}
              member={m}
              isCurrentUser={m.userId === membership?.userId}
              orgId={orgId!}
              projectId={projectId!}
            />
          ))
        )}
      </div>
    </div>
  );
};
