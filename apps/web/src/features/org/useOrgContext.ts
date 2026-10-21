import { useAppSelector } from '../../app/store';
import type { OrgDTO, MemberDTO } from './orgSlice';
import type { PermissionKey } from '../../lib/permissions';

export interface OrgContext {
  org: OrgDTO | null;
  membership: MemberDTO | null;
  permissions: PermissionKey[];
  isOrgInitialized: boolean;
  isOrgLoading: boolean;
}

export function useOrgContext(): OrgContext {
  const org = useAppSelector((s) => s.org.activeOrg);
  const membership = useAppSelector((s) => s.org.membership);
  const permissions = useAppSelector((s) => s.org.permissions);
  const isOrgInitialized = useAppSelector((s) => s.org.isOrgInitialized);
  const isOrgLoading = useAppSelector((s) => s.org.isOrgLoading);
  return { org, membership, permissions, isOrgInitialized, isOrgLoading };
}
