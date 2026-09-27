// apps/server/src/modules/project/index.ts
// Public surface of the project module — other modules import ONLY from here.
// Internal repos, services, middleware are not re-exported intentionally.

export { projectService } from './core/project.service.js';
// projectService exposes:
//   .getProject(orgId, projectId): Promise<ProjectDTO>
//   .requireProject(orgId, projectId): Promise<Project>   ← domain type with version
//   .assertProjectAccess(orgId, projectId, userId, requiredRole?): Promise<void>
//   .createProject(...)
//   .listProjects(...)
//   .updateProject(...)

export { projectSettingsService } from './settings/project-settings.service.js';
// projectSettingsService exposes:
//   .getEffectiveSettings(orgId, projectId): Promise<EffectiveProjectSettings>

export type {
  ProjectDTO,
  ProjectListDTO,
  ProjectContext,
  ProjectStatus,
  ProjectRole,
} from './core/project.types.js';
export type { EffectiveProjectSettings } from './settings/project-settings.service.js';
