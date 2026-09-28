// apps/server/src/modules/project/schedule-history/schedule-history.types.ts

export type ScheduleSourceType =
  | 'USER'
  | 'ISSUE'
  | 'RFI'
  | 'CHANGE_ORDER'
  | 'MATERIAL_DELAY'
  | 'WEATHER'
  | 'SYSTEM_CALCULATION';

export interface ScheduleChangeDTO {
  id: string;
  organizationId: string;
  projectId: string;
  taskId: string;
  sourceType: ScheduleSourceType;
  sourceId: string | null;
  oldStartDate: string | null;
  oldFinishDate: string | null;
  newStartDate: string | null;
  newFinishDate: string | null;
  reason: string | null;
  actorUserId: string | null;
  createdAt: string;
}
