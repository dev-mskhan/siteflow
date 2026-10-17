export type TaskStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED';

export interface TaskDTO {
  id: string;
  taskCode: string;
  name: string;
  status: TaskStatus;
  phaseId: string;
  projectId: string;
}
