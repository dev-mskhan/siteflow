import React from 'react';
import type { ProjectRole } from '../../features/project/projectTypes';

const LABELS: Record<ProjectRole, string> = {
  PROJECT_MANAGER: 'Project Manager',
  SITE_SUPERVISOR: 'Site Supervisor',
  PROJECT_MEMBER:  'Member',
  FINANCE:         'Finance',
  PROCUREMENT:     'Procurement',
  SUBCONTRACTOR:   'Subcontractor',
  CLIENT:          'Client',
};

export const ProjectRoleBadge: React.FC<{ role: ProjectRole; className?: string }> = ({ role, className = '' }) => (
  <span className={`font-mono text-[9px] uppercase tracking-[0.12em] border border-[var(--hairline-2)] bg-[var(--surface-2)] px-1.5 py-0.5 text-[var(--muted)] ${className}`}>
    {LABELS[role]}
  </span>
);
