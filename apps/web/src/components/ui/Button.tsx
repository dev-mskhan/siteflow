import React, { type ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/utils/index';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading = false, disabled, children, ...props }, ref) => {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed select-none';

    const variants = {
      primary: 'bg-gradient-brand text-white shadow-sm hover:brightness-110 active:brightness-95 border-0 focus:ring-orange-500',
      secondary: 'bg-surface-2 text-text hover:bg-surface-3 active:bg-surface border border-border focus:ring-blue-500',
      outline: 'bg-transparent text-text hover:bg-surface-2 active:bg-surface border border-border focus:ring-orange-500',
      ghost: 'bg-transparent text-text-muted hover:text-text hover:bg-surface-2 border-0 focus:ring-slate-500',
      danger: 'bg-danger text-white hover:bg-red-600 border-0 focus:ring-red-500',
    };

    const sizes = {
      sm: 'text-xs px-2.5 py-1.5 gap-1.5',
      md: 'text-sm px-4 py-2.5 gap-2',
      lg: 'text-base px-6 py-3.5 gap-2.5 font-semibold',
    };

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        style={{
          background: variant === 'primary' ? 'var(--gradient-brand)' : undefined,
          color: variant === 'primary' ? '#FFFFFF' : undefined,
        }}
        {...props}
      >
        {isLoading && (
          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
