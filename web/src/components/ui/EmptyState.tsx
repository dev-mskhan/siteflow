import React from 'react';
import { cn } from '../../lib/cn';
import { Button } from './Button';
import { FolderPlus } from 'lucide-react';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'p-8 sm:p-12 text-center rounded-md border border-dashed border-border bg-surface flex flex-col items-center justify-center max-w-lg mx-auto',
        className
      )}
    >
      <div className="w-12 h-12 rounded-md bg-surface-muted text-accent flex items-center justify-center mb-4">
        {icon || <FolderPlus className="w-6 h-6" />}
      </div>

      <h3 className="font-heading text-base font-bold text-text mb-1">
        {title}
      </h3>

      <p className="text-xs text-text-muted max-w-sm mb-6 leading-relaxed">
        {description}
      </p>

      {actionLabel && onAction && (
        <Button variant="primary" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
