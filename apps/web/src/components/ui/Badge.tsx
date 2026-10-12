import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils/index';

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'active' | 'draft';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
}

export function Badge({ className, variant = 'default', children, ...props }: BadgeProps) {
  const getStyles = (v: BadgeVariant) => {
    switch (v) {
      case 'success':
      case 'active':
        return {
          backgroundColor: 'var(--success-bg)',
          color: 'var(--success)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
        };
      case 'warning':
        return {
          backgroundColor: 'var(--warning-bg)',
          color: 'var(--warning)',
          border: '1px solid rgba(245, 158, 11, 0.25)',
        };
      case 'danger':
        return {
          backgroundColor: 'var(--danger-bg)',
          color: 'var(--danger)',
          border: '1px solid rgba(239, 68, 68, 0.25)',
        };
      case 'info':
        return {
          backgroundColor: 'var(--info-bg)',
          color: 'var(--info)',
          border: '1px solid rgba(56, 189, 248, 0.25)',
        };
      case 'draft':
      default:
        return {
          backgroundColor: 'var(--surface-2)',
          color: 'var(--text-muted)',
          border: '1px solid var(--border)',
        };
    }
  };

  return (
    <span
      className={cn(
        'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider',
        className
      )}
      style={getStyles(variant)}
      {...props}
    >
      {children}
    </span>
  );
}
