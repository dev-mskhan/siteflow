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
  return useAppSelector((s) => s.org);
}
