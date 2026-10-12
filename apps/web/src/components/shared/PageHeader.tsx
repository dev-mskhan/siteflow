import { type ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  description?: string;
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ title, description, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-2 pb-6 pt-2 border-b border-border mb-6" style={{ borderColor: 'var(--border)' }}>
      {breadcrumbs && <div className="text-xs text-text-muted">{breadcrumbs}</div>}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-text">{title}</h1>
          {description && <p className="text-sm text-text-muted mt-1">{description}</p>}
        </div>
        {actions && <div className="flex items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
