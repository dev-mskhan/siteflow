/**
 * MembersPage — /org/:orgId/members
 * Two tabs: Members | Pending Invitations
 *
 * Permission gates:
 *   Entire page  → member:read  (PermissionGate fallback shows NoAccess banner)
 *   Invite button → member:invite
 *   Change role / Suspend / Reactivate → member:update
 *   Remove → member:remove
 *   Cancel invitation → invitation:cancel
 */
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { UserPlus, Trash2, ChevronDown, MailX } from 'lucide-react';
import { PermissionGate } from '../../components/guards/PermissionGate';
import { useOrgContext } from '../../features/org/useOrgContext';
import { usePermission } from '../../features/org/usePermission';
import {
  useListMembersQuery,
  useUpdateMemberMutation,
  useRemoveMemberMutation,
} from '../../features/org/memberApi';
import {
  useListInvitationsQuery,
  useCancelInvitationMutation,
} from '../../features/org/invitationApi';
import { InlineAlert } from '../../components/ui/InlineAlert';
import { useToast } from '../../components/ui/Toast';
import { getServerError, isInlineError, toastErrorMessage } from '../../lib/authErrors';
import { InviteMemberModal } from './InviteMemberModal';
import type { MemberDTO } from '../../features/org/orgSlice';

// ─── Status badge ──────────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const map: Record<string, string> = {
    ACTIVE: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
    SUSPENDED: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]',
    REMOVED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
    PENDING: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]',
    ACCEPTED: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]',
    EXPIRED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
    CANCELLED: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]',
  };
  return (
    <span
      className={`font-mono text-[9px] uppercase tracking-[0.12em] border px-1.5 py-0.5 ${map[status] ?? ''}`}
    >
      {status}
    </span>
  );
};

// ─── Member row ────────────────────────────────────────────────────────────────

const MemberRow: React.FC<{
  member: MemberDTO;
  isCurrentUser: boolean;
  orgId: string;
  roles: { id: string; name: string }[];
}> = ({ member, isCurrentUser, orgId, roles }) => {
  const [actionOpen, setActionOpen] = useState(false);
  const { error: toastErr, success: toastOk } = useToast();
  const canUpdate = usePermission('member:update');
  const canRemove = usePermission('member:remove');

  const [updateMember, { isLoading: updating, error: updateError }] = useUpdateMemberMutation();
  const [removeMember, { isLoading: removing }] = useRemoveMemberMutation();

  const inlineErr = isInlineError(updateError) ? getServerError(updateError) : null;

  const handleUpdate = async (body: { roleId?: string; status?: 'ACTIVE' | 'SUSPENDED' }) => {
    try {
      await updateMember({ orgId, memberId: member.id, body }).unwrap();
      toastOk('Member updated', 'Changes have been saved.');
      setActionOpen(false);
    } catch (err) {
      if (!isInlineError(err as never)) {
        toastErr('Update failed', toastErrorMessage(err as never));
      }
    }
  };

  const handleRemove = async () => {
    if (
      !confirm(`Remove ${member.userFirstName} ${member.userLastName ?? ''} from this workspace?`)
    )
      return;
    try {
      await removeMember({ orgId, memberId: member.id }).unwrap();
      toastOk('Member removed', 'They no longer have access to this workspace.');
    } catch (err) {
      toastErr('Remove failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="flex items-center gap-4 px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0">
      {/* Avatar */}
      <div className="flex h-8 w-8 shrink-0 items-center justify-center bg-[var(--ink)] text-white font-mono text-[10px] font-bold">
        {[member.userFirstName[0], member.userLastName?.[0]].filter(Boolean).join('').toUpperCase()}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-[var(--ink)]">
            {member.userFirstName} {member.userLastName}
            {isCurrentUser && (
              <span className="ml-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-[var(--muted)]">
                (you)
              </span>
            )}
          </p>
          <StatusBadge status={member.status} />
        </div>
        <p className="font-mono text-[10px] text-[var(--muted)] truncate">{member.userEmail}</p>
      </div>

      {/* Role */}
      <p className="hidden sm:block text-sm text-[var(--muted)] shrink-0">{member.roleName}</p>

      {/* Actions */}
      {!isCurrentUser && (canUpdate || canRemove) && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setActionOpen((v) => !v)}
            className="p-1.5 text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
          >
            <ChevronDown className="h-4 w-4" strokeWidth={1.8} />
          </button>

          {actionOpen && (
            <div className="absolute right-0 top-[calc(100%+2px)] z-20 w-48 border border-[var(--ink)] bg-[var(--paper)]">
              {inlineErr && (
                <div className="px-3 py-2 border-b border-[var(--hairline-2)]">
                  <p className="font-mono text-[9px] text-[#991b1b]">{inlineErr.message}</p>
                </div>
              )}

              {/* Change role */}
              {canUpdate &&
                roles.map(
                  (role) =>
                    role.name !== member.roleName && (
                      <button
                        key={role.id}
                        type="button"
                        disabled={updating}
                        onClick={() => handleUpdate({ roleId: role.id })}
                        className="w-full px-3 py-2 text-left text-sm text-[var(--ink)] hover:bg-[var(--surface-2)] transition-colors"
                      >
                        Set as {role.name}
                      </button>
                    ),
                )}

              {/* Suspend / Reactivate */}
              {canUpdate && member.status === 'ACTIVE' && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdate({ status: 'SUSPENDED' })}
                  className="w-full px-3 py-2 text-left text-sm text-[#92400e] hover:bg-[var(--surface-2)] transition-colors border-t border-[var(--hairline-2)]"
                >
                  Suspend member
                </button>
              )}
              {canUpdate && member.status === 'SUSPENDED' && (
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdate({ status: 'ACTIVE' })}
                  className="w-full px-3 py-2 text-left text-sm text-[#166534] hover:bg-[var(--surface-2)] transition-colors border-t border-[var(--hairline-2)]"
                >
                  Reactivate member
                </button>
              )}

              {/* Remove */}
              {canRemove && (
                <button
                  type="button"
                  disabled={removing}
                  onClick={handleRemove}
                  className="w-full px-3 py-2 text-left text-sm text-[#991b1b] hover:bg-[#fef2f2] transition-colors border-t border-[var(--hairline-2)] flex items-center gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.8} />
                  Remove from workspace
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ─── Main page ─────────────────────────────────────────────────────────────────

export const MembersPage: React.FC = () => {
  const { orgId } = useParams<{ orgId: string }>();
  const { membership, org } = useOrgContext();
  const canInvite = usePermission('member:invite');
  const canCancel = usePermission('invitation:cancel');

  const [tab, setTab] = useState<'members' | 'invitations'>('members');
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data: membersData, isLoading: membersLoading } = useListMembersQuery(orgId!);
  const { data: invitationsData, isLoading: invitesLoading } = useListInvitationsQuery(orgId!);
  const [cancelInvitation, { isLoading: cancelling }] = useCancelInvitationMutation();
  const { error: toastErr, success: toastOk } = useToast();

  const members = membersData?.members.filter((m) => m.status !== 'REMOVED') ?? [];
  const pendingInvites = invitationsData?.invitations.filter((i) => i.status === 'PENDING') ?? [];

  // Derive role list for the role-change dropdown
  // Roles are embedded as roleName in members — unique role names
  const roleNames = [...new Set(members.map((m) => m.roleName))];
  const roles = roleNames.map((name) => ({ id: name, name }));

  const handleCancelInvite = async (id: string) => {
    try {
      await cancelInvitation({ orgId: orgId!, id }).unwrap();
      toastOk('Invitation cancelled', 'The invitation has been revoked.');
    } catch (err) {
      toastErr('Cancel failed', toastErrorMessage(err as never));
    }
  };

  return (
    <div className="p-6 sm:p-8">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-medium tracking-[-0.03em]">Members</h1>
          <p className="mt-0.5 text-sm text-[var(--muted)]">
            {members.length} active member{members.length !== 1 ? 's' : ''}
            {pendingInvites.length > 0 && ` · ${pendingInvites.length} pending`}
          </p>
        </div>
        <PermissionGate require="member:invite">
          <button
            type="button"
            onClick={() => setInviteOpen(true)}
            className="inline-flex items-center gap-2 min-h-10 bg-[var(--ink)] px-4 text-sm font-medium text-white transition-transform hover:-translate-y-0.5 active:translate-y-0"
          >
            <UserPlus className="h-4 w-4" strokeWidth={1.8} />
            Invite member
          </button>
        </PermissionGate>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-[var(--hairline-2)] mb-0">
        {(['members', 'invitations'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors duration-[120ms] ${
              tab === t
                ? 'border-[var(--ink)] text-[var(--ink)]'
                : 'border-transparent text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
          >
            {t === 'members' ? 'Members' : 'Pending invitations'}
            {t === 'invitations' && pendingInvites.length > 0 && (
              <span className="ml-1.5 font-mono text-[9px] bg-[var(--surface-2)] border border-[var(--hairline-2)] px-1.5 py-0.5">
                {pendingInvites.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Members tab */}
      {tab === 'members' && (
        <div className="border border-[var(--hairline-2)] border-t-0">
          {membersLoading ? (
            <div className="space-y-0">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse bg-[var(--surface-2)] border-b border-[var(--hairline-2)]"
                />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              No members found.
            </div>
          ) : (
            members.map((m) => (
              <MemberRow
                key={m.id}
                member={m}
                isCurrentUser={m.userId === membership?.userId}
                orgId={orgId!}
                roles={roles}
              />
            ))
          )}
        </div>
      )}

      {/* Invitations tab */}
      {tab === 'invitations' && (
        <div className="border border-[var(--hairline-2)] border-t-0">
          {invitesLoading ? (
            <div className="h-14 animate-pulse bg-[var(--surface-2)]" />
          ) : pendingInvites.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[var(--muted)]">
              No pending invitations.
            </div>
          ) : (
            pendingInvites.map((inv) => (
              <div
                key={inv.id}
                className="flex items-center gap-4 px-4 py-3.5 border-b border-[var(--hairline-2)] last:border-b-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--ink)] truncate">{inv.email}</p>
                  <p className="font-mono text-[10px] text-[var(--muted)]">
                    {inv.roleName} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <StatusBadge status={inv.status} />
                <PermissionGate require="invitation:cancel">
                  <button
                    type="button"
                    disabled={cancelling}
                    onClick={() => handleCancelInvite(inv.id)}
                    aria-label="Cancel invitation"
                    className="p-1.5 text-[var(--muted)] hover:text-[#991b1b] transition-colors"
                  >
                    <MailX className="h-4 w-4" strokeWidth={1.8} />
                  </button>
                </PermissionGate>
              </div>
            ))
          )}
        </div>
      )}

      {/* Invite modal */}
      {inviteOpen && (
        <InviteMemberModal
          orgId={orgId!}
          orgName={org?.name}
          inviterName={`${membership?.userFirstName ?? ''} ${membership?.userLastName ?? ''}`.trim()}
          onClose={() => setInviteOpen(false)}
        />
      )}
    </div>
  );
};
