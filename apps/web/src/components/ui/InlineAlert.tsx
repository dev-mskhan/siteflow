/**
 * InlineAlert — form-level error/info/success banner.
 * Used for errors that aren't tied to a specific field:
 *   - "Invalid email or password" (inline on login — NOT a toast)
 *   - "Email already registered" (inline on register)
 *   - "Reset link has expired" (inline on reset-password)
 * Toast is reserved for transient background events (rate limits, 500s).
 */

import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '../../lib/cn';

type AlertVariant = 'error' | 'success' | 'info' | 'warning';

interface InlineAlertProps {
  variant?: AlertVariant;
  title?: string;
  message: string;
  onDismiss?: () => void;
  className?: string;
}

const config: Record<AlertVariant, {
  border: string;
  bg: string;
  text: string;
  icon: React.ElementType;
}> = {
  error: {
    border: 'border-[var(--color-status-delayed-border)]',
    bg: 'bg-[var(--color-status-delayed-bg)]',
    text: 'text-[var(--color-status-delayed)]',
    icon: AlertTriangle,
  },
  warning: {
    border: 'border-[var(--color-status-atrisk-border)]',
    bg: 'bg-[var(--color-status-atrisk-bg)]',
    text: 'text-[var(--color-status-atrisk)]',
    icon: AlertTriangle,
  },
  success: {
    border: 'border-[var(--color-status-ontrack-border)]',
    bg: 'bg-[var(--color-status-ontrack-bg)]',
    text: 'text-[var(--color-status-ontrack)]',
    icon: CheckCircle2,
  },
  info: {
    border: 'border-[var(--hairline-2)]',
    bg: 'bg-[var(--surface-2)]',
    text: 'text-[var(--ink)]',
    icon: Info,
  },
};

export const InlineAlert: React.FC<InlineAlertProps> = ({
  variant = 'error',
  title,
  message,
  onDismiss,
  className,
}) => {
  const { border, bg, text, icon: Icon } = config[variant];

  return (
    <div
      role="alert"
      className={cn(
        'flex items-start gap-3 border p-3.5',
        border, bg,
        className,
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0 mt-0.5', text)} strokeWidth={1.8} />
      <div className="flex-1 min-w-0">
        {title && (
          <p className={cn('text-sm font-medium leading-snug', text)}>{title}</p>
        )}
        <p className={cn('text-sm leading-snug', title ? 'mt-0.5 opacity-80' : '', text)}>
          {message}
        </p>
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={cn('shrink-0 opacity-60 hover:opacity-100 transition-opacity', text)}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      )}
    </div>
  );
};
