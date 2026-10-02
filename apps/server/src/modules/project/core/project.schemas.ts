// apps/server/src/modules/project/core/project.schemas.ts
// Re-exports from @siteflow/shared — single source of truth for validation
export {
  createProjectSchema,
  updateProjectSchema,
  listProjectsQuerySchema,
  PROJECT_TYPES,
  PROJECT_STATUSES,
  type CreateProjectInput,
  type UpdateProjectInput,
  type ListProjectsQuery,
} from '@siteflow/shared';
