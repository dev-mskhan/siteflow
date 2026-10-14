import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { ProjectDTO } from './projectTypes';

interface ProjectState {
  /**
   * The project currently open in /org/:orgId/projects/:projectId.
   * Cleared when navigating away.
   */
  activeProject: ProjectDTO | null;

  /**
   * Internal optimistic-lock version for the active project.
   * NOT present on ProjectDTO (server strips it) — tracked separately here.
   * Source: MOCK_PROJECT_VERSIONS during mock phase;
   *         will come from a dedicated /projects/:id?includeVersion=true
   *         endpoint or be tracked from the last known mutation response.
   */
  activeProjectVersion: number;

  isProjectLoading: boolean;
}

const initialState: ProjectState = {
  activeProject: null,
  activeProjectVersion: 1,
  isProjectLoading: false,
};

const projectSlice = createSlice({
  name: 'project',
  initialState,
  reducers: {
    projectLoaded: (
      state,
      action: PayloadAction<{ project: ProjectDTO; version: number }>,
    ) => {
      state.activeProject = action.payload.project;
      state.activeProjectVersion = action.payload.version;
      state.isProjectLoading = false;
    },
    projectLoadingStarted: (state) => {
      state.isProjectLoading = true;
    },
    projectCleared: (state) => {
      state.activeProject = null;
      state.activeProjectVersion = 1;
      state.isProjectLoading = false;
    },
    /** Called after a successful PATCH to bump the tracked version */
    projectVersionBumped: (state, action: PayloadAction<number>) => {
      state.activeProjectVersion = action.payload;
    },
  },
});

export const {
  projectLoaded,
  projectLoadingStarted,
  projectCleared,
  projectVersionBumped,
} = projectSlice.actions;

export default projectSlice.reducer;
