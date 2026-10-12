import React, { forwardRef } from 'react';
import { cn } from '../../lib/cn';
import { ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options?: SelectOption[];
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, hint, error, options, children, id, disabled, ...props }, ref) => {
    const selectId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5">
        {label && (
          <label
            htmlFor={selectId}
            className="text-xs font-heading font-semibold text-text flex items-center justify-between"
          >
            <span>{label}</span>
            {hint && <span className="text-[11px] font-normal text-text-subtle">{hint}</span>}
          </label>
        )}

        <div className="relative flex items-center">
          <select
            ref={ref}
            id={selectId}
            disabled={disabled}
            className={cn(
              'w-full min-h-[40px] px-3 py-2 pr-9 text-sm rounded-md border bg-surface text-text transition-all duration-snappy appearance-none cursor-pointer',
              'focus:outline-none focus:ring-2 focus:ring-accent focus:border-accent',
              'disabled:bg-surface-muted disabled:text-text-subtle disabled:cursor-not-allowed',
              error
                ? 'border-status-delayed focus:ring-status-delayed focus:border-status-delayed'
                : 'border-border hover:border-border-strong',
              className
            )}
            {...props}
          >
            {options
              ? options.map((opt) => (
                  <option key={opt.value} value={opt.value} disabled={opt.disabled}>
                    {opt.label}
                  </option>
                ))
              : children}
          </select>

          <div className="absolute right-3 flex items-center pointer-events-none text-text-muted">
            <ChevronDown className="w-4 h-4" />
          </div>
        </div>

        {error && (
          <p className="text-xs font-medium text-status-delayed mt-0.5">
            {error}
          </p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
