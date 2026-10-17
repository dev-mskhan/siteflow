import { createApi } from '@reduxjs/toolkit/query/react';
import { mockBaseQuery } from './mockBaseQuery';
import type { TaskDTO } from '../types/taskTypes';
import { MOCK_TASKS } from '../fixtures/task.fixtures';

export const taskApi = createApi({
  reducerPath: 'taskApi',
  baseQuery: mockBaseQuery,
  tagTypes: ['Task'],
  endpoints: (build) => ({
    listTasks: build.query<{ tasks: TaskDTO[] }, { orgId: string; projectId: string }>({
      queryFn: async ({ projectId }) => {
        await new Promise((r) => setTimeout(r, 150));
        const tasks = MOCK_TASKS[projectId] || [];
        return { data: { tasks } };
      },
      providesTags: (result, _error, { projectId }) => [
        { type: 'Task', id: 'LIST' },
        { type: 'Task', id: projectId },
      ],
    }),
  }),
});

export const { useListTasksQuery } = taskApi;
