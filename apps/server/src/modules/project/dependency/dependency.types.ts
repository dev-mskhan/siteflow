// apps/server/src/modules/project/dependency/dependency.types.ts

export type DependencyType = 'FS' | 'SS' | 'FF' | 'SF';

export interface DependencyDTO {
  id: string;
  organizationId: string;
  projectId: string;
  taskId: string;
  predecessorId: string;
  dependencyType: DependencyType;
  lagDays: number;
  createdAt: string;
}

export interface CreateDependencyInput {
  taskId: string;
  predecessorId: string;
  dependencyType?: DependencyType;
  lagDays?: number;
}

export interface DeleteDependencyInput {
  dependencyId: string;
}

export interface ListDependenciesInput {
  projectId: string;
  taskId?: string; // optional: filter by task
}
