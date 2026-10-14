import React from 'react';
import type { ProjectStatus } from '../../features/project/projectTypes';

const CONFIG: Record<ProjectStatus, { label: string; cls: string }> = {
  DRAFT:     { label: 'Draft',     cls: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)]' },
  ACTIVE:    { label: 'Active',    cls: 'border-[#bbf7d0] bg-[#f0fdf4] text-[#166534]' },
  ON_HOLD:   { label: 'On hold',   cls: 'border-[#fde68a] bg-[#fffbeb] text-[#92400e]' },
  COMPLETED: { label: 'Completed', cls: 'border-[#bfdbfe] bg-[#eff6ff] text-[#1e40af]' },
  CANCELLED: { label: 'Cancelled', cls: 'border-[#fecaca] bg-[#fef2f2] text-[#991b1b]' },
  ARCHIVED:  { label: 'Archived',  cls: 'border-[var(--hairline-2)] bg-[var(--surface-2)] text-[var(--muted)] opacity-60' },
};

export const ProjectStatusBadge: React.FC<{ status: ProjectStatus; className?: string }> = ({ status, className = '' }) => {
  const { label, cls } = CONFIG[status];
  return (
    <span className={`font-mono text-[9px] uppercase tracking-[0.14em] border px-1.5 py-0.5 ${cls} ${className}`}>
      {label}
    </span>
  );
};
