import React from 'react';
import { cn } from '../../lib/cn';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'ontrack' | 'atrisk' | 'delayed' | 'neutral' | 'accent';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  className,
  variant = 'neutral',
  size = 'md',
  icon,
  ...props
}) => {
  const baseStyles =
    'inline-flex items-center font-heading font-semibold rounded-sm border transition-colors select-none';

  const variantStyles = {
    ontrack:
      'bg-status-ontrack-bg text-status-ontrack border-status-ontrack-border',
    atrisk:
      'bg-status-atrisk-bg text-status-atrisk border-status-atrisk-border',
    delayed:
      'bg-status-delayed-bg text-status-delayed border-status-delayed-border',
    neutral:
      'bg-status-neutral-bg text-status-neutral border-status-neutral-border',
    accent:
      'bg-accent-subtle text-accent border-accent-border',
  };

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-xs gap-1.5',
  };

  return (
    <span
      className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
