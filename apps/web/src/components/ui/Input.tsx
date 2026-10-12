import React, { type InputHTMLAttributes } from 'react';
import { cn } from '../../lib/utils/index';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = 'text', label, error, helperText, id, required, ...props }, ref) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    return (
      <div className="w-full flex flex-col gap-1.5 text-left">
        {label && (
          <label htmlFor={inputId} className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            {label} {required && <span className="text-danger">*</span>}
          </label>
        )}
        <input
          id={inputId}
          ref={ref}
          type={type}
          required={required}
          aria-invalid={!!error}
          aria-describedby={error ? `${inputId}-error` : helperText ? `${inputId}-helper` : undefined}
          className={cn(
            'w-full px-3.5 py-2.5 rounded-lg text-sm bg-surface text-text border transition-colors outline-none',
            error ? 'border-danger focus:border-danger' : 'border-border focus:border-accent-1',
            'placeholder:text-text-dim',
            className
          )}
          style={{
            backgroundColor: 'var(--surface)',
            color: 'var(--text)',
            borderColor: error ? 'var(--danger)' : 'var(--border)',
          }}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="text-xs text-danger font-medium">
            {error}
          </p>
        )}
        {!error && helperText && (
          <p id={`${inputId}-helper`} className="text-xs text-text-muted">
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
