import React from 'react';
import { cn } from '../../lib/cn';
import { Button } from './Button';
import { AlertTriangle } from 'lucide-react';

export interface ErrorStateProps {
  title?: string;
  message?: string;
  retryLabel?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Something went wrong',
  message = 'We could not load this information right now. Check your connection and try again.',
  retryLabel = 'Try again',
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'p-8 sm:p-10 text-center rounded-md border border-status-delayed-border bg-status-delayed-bg/40 flex flex-col items-center justify-center max-w-lg mx-auto',
        className
      )}
    >
      <div className="w-12 h-12 rounded-md bg-status-delayed-bg text-status-delayed flex items-center justify-center mb-4">
        <AlertTriangle className="w-6 h-6" />
      </div>

      <h3 className="font-heading text-base font-bold text-text mb-1">
        {title}
      </h3>

      <p className="text-xs text-text-muted max-w-sm mb-6 leading-relaxed">
        {message}
      </p>

      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </div>
  );
};
