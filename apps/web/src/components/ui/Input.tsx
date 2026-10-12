import React, { forwardRef } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
  leftAddon?: React.ReactNode;
  rightAddon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, hint, error, leftAddon, rightAddon, id, disabled, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-heading font-semibold text-text flex items-center justify-between"
          >
            <span>{label}</span>
            {hint && <span className="text-[11px] font-normal text-text-subtle">{hint}</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftAddon && (
            <div className="absolute left-3 flex items-center pointer-events-none text-text-muted">
              {leftAddon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            className={cn(
              'w-full min-h-[40px] px-3 py-2 text-sm rounded-md border bg-surface text-text placeholder:text-text-subtle transition-all duration-snappy',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent',
              'disabled:bg-surface-muted disabled:text-text-subtle disabled:cursor-not-allowed',
              error
                ? 'border-status-delayed focus:ring-status-delayed focus:border-status-delayed'
                : 'border-border hover:border-border-strong',
              leftAddon && 'pl-9',
              rightAddon && 'pr-9',
              className
            )}
            {...props}
          />

          {rightAddon && (
            <div className="absolute right-3 flex items-center pointer-events-none text-text-muted">
              {rightAddon}
            </div>
          )}
        </div>

        {error && (
          <p className="text-xs font-medium text-status-delayed flex items-center gap-1 mt-0.5">
            <span>{error}</span>
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
