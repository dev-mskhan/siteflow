import { useAppSelector } from '../../app/store';

export function useActiveProject() {
  return useAppSelector((s) => s.project);
}
