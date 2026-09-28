// apps/server/src/modules/project/issue/issue.types.ts

export type IssueStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

export interface IssueDTO {
  id: string;
  organizationId: string;
  projectId: string;
  title: string;
  description: string | null;
  status: IssueStatus;
  reportedImpactDays: number;
  approvedImpactDays: number;
  assignedTo: string | null;
  createdAt: string;
}

export interface CreateIssueInput {
  title: string;
  description?: string;
  reportedImpactDays?: number;
  assignedTo?: string;
}

export interface UpdateIssueInput {
  title?: string;
  description?: string;
  reportedImpactDays?: number;
  approvedImpactDays?: number;
  assignedTo?: string | null;
}
