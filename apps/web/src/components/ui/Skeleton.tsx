import { type HTMLAttributes } from 'react';
import { cn } from '../../lib/utils/index';

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-surface-2', className)}
      style={{
        backgroundColor: 'var(--surface-2)',
      }}
      {...props}
    />
  );
}

export function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeMap = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-10 h-10',
  };

  return (
    <div className="flex items-center justify-center p-4">
      <svg className={cn('animate-spin text-accent-1', sizeMap[size])} fill="none" viewBox="0 0 24 24" style={{ color: 'var(--accent-1)' }}>
        <circle className="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
        <path className="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
    </div>
  );
}
