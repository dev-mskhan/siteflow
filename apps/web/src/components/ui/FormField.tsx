/**
 * FormField — labelled wrapper for all auth form inputs.
 * Renders label, input slot, and optional inline error message.
 * Follows the Vault style: mono eyebrow label, 0px radius, hairline borders.
 */

import React, { useId } from 'react';
import { cn } from '../../lib/cn';

interface FormFieldProps {
  label: string;
  error?: string;
  hint?: string;
  required?: boolean;
  children: (id: string, errorId: string, hintId: string) => React.ReactNode;
  className?: string;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  error,
  hint,
  required,
  children,
  className,
}) => {
  const id = useId();
  const errorId = `${id}-error`;
  const hintId = `${id}-hint`;

  return (
    <div data-form-field className={cn('flex flex-col gap-1.5', className)}>
      <label
        htmlFor={id}
        className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--muted)] select-none"
      >
        {label}
        {required && <span className="ml-1 text-[var(--ink)]">*</span>}
      </label>

      {children(id, errorId, hintId)}

      {hint && !error && (
        <p id={hintId} className="font-mono text-[10px] text-[var(--muted)]">
          {hint}
        </p>
      )}

      {error && (
        <p
          id={errorId}
          role="alert"
          aria-live="polite"
          className="font-mono text-[10px] text-[var(--color-status-delayed)] flex items-center gap-1"
        >
          <span aria-hidden>⚠</span>
          {error}
        </p>
      )}
    </div>
  );
};

// ─── Shared input class string ─────────────────────────────────────────────────
// Re-exported so every input/select/textarea can use the same baseline styles.

export function inputCls(hasError?: boolean): string {
  return cn(
    'w-full border bg-[var(--paper)] px-3 py-2.5 text-sm text-[var(--ink)]',
    'placeholder:text-[var(--muted)]',
    'focus:outline focus:outline-2 focus:outline-offset-[-1px] focus:outline-[var(--ink)]',
    'transition-colors duration-[120ms]',
    'disabled:opacity-50 disabled:cursor-not-allowed',
    hasError
      ? 'border-[var(--color-status-delayed-border)] focus:outline-[var(--color-status-delayed)]'
      : 'border-[var(--hairline-2)]',
  );
}
