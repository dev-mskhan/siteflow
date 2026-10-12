import React from 'react';
import { cn } from '../../lib/cn';

export interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'rectangular' | 'text' | 'circular';
}

export const Skeleton: React.FC<SkeletonProps> = ({
  className,
  variant = 'rectangular',
  ...props
}) => {
  const variantStyles = {
    rectangular: 'rounded-md',
    text: 'rounded-sm h-4 w-full',
    circular: 'rounded-full',
  };

  return (
    <div
      className={cn(
        'bg-surface-hover/80 animate-pulse pointer-events-none',
        variantStyles[variant],
        className
      )}
      {...props}
    />
  );
};
