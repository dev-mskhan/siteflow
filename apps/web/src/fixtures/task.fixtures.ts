import type { TaskDTO } from '../types/taskTypes';

export const MOCK_TASKS: Record<string, TaskDTO[]> = {
  proj_01: [
    {
      id: 'task_01_1',
      taskCode: 'TASK-001',
      name: 'Sub-Structure Foundation',
      status: 'IN_PROGRESS',
      phaseId: 'phase_01_1',
      projectId: 'proj_01',
    },
    {
      id: 'task_01_2',
      taskCode: 'TASK-002',
      name: 'Pile Driving',
      status: 'IN_PROGRESS',
      phaseId: 'phase_01_1',
      projectId: 'proj_01',
    },
    {
      id: 'task_01_3',
      taskCode: 'TASK-003',
      name: 'Ground Slab Concrete Pour',
      status: 'NOT_STARTED',
      phaseId: 'phase_01_1',
      projectId: 'proj_01',
    },
    {
      id: 'task_01_4',
      taskCode: 'TASK-004',
      name: 'Column RC Frame G+1',
      status: 'NOT_STARTED',
      phaseId: 'phase_01_2',
      projectId: 'proj_01',
    },
    {
      id: 'task_01_5',
      taskCode: 'TASK-005',
      name: 'Beam & Slab Level 1',
      status: 'NOT_STARTED',
      phaseId: 'phase_01_2',
      projectId: 'proj_01',
    },
  ],
};
